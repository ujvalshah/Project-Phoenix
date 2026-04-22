import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { normalizeDoc, normalizeDocs, normalizeArticleDocs } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { updateUserSchema } from '../utils/validation.js';
import { createSearchRegex } from '../utils/escapeRegExp.js';
import { resolveTagNamesToIds } from '../utils/tagHelpers.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import { accessUserMutation } from '../utils/userAccess.js';
import { auditAdminAction } from '../utils/auditAdminAction.js';
import { revokeAllRefreshTokens } from '../services/tokenService.js';
import { sendVerificationEmail, sendEmailChangedNoticeEmail } from '../services/emailService.js';
import { generateEmailVerificationToken } from '../utils/jwt.js';
import { getEnv } from '../config/envValidation.js';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    // Email is only searchable by admins to reduce user-enumeration risk.
    const authRole = (req as { user?: { role?: string } }).user?.role;
    const includeEmailInSearch = authRole === 'admin';
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      query.$or = [
        { 'profile.displayName': regex },
        { 'profile.username': regex },
        ...(includeEmailInSearch ? [{ 'auth.email': regex }] : []),
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ 'auth.createdAt': -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      data: normalizeDocs(users),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get users error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Public read-only profile for SPA (profiles, collection contributors).
 * Same shape as normalizeDoc but auth.email is redacted. Not for admin bulk operations.
 */
export const getPublicUserProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const doc = normalizeDoc(user) as Record<string, unknown>;
    if (doc?.auth && typeof doc.auth === 'object') {
      (doc.auth as Record<string, unknown>).email = '';
    }
    res.json(doc);
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as { user?: { userId?: string } }).user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get public profile error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(normalizeDoc(user));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get user by ID error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = updateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // Don't allow password updates through this endpoint (use separate change password endpoint)
    const { password, ...updateData } = validationResult.data;

    const authUserId = (req as { user?: { userId?: string; role?: string } }).user?.userId;
    const authRole = (req as { user?: { userId?: string; role?: string } }).user?.role;
    const targetUserId = req.params.id;
    const access = accessUserMutation(authUserId, authRole, targetUserId);
    if (access === 'unauthenticated') {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (access === 'forbid') {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }

    // Non-admins cannot change role (prevents privilege escalation)
    if (authRole !== 'admin') {
      delete (updateData as { role?: unknown }).role;
    }

    const userId = targetUserId;

    // Load a snapshot of the prior user state when we'll need it: either to
    // populate AdminAuditLog before/after diffs (admin-on-other) OR to
    // decide whether the requested email is actually a change (any caller).
    // Self-edits without an email change skip the read.
    const isAdminOnOther = authRole === 'admin' && authUserId !== targetUserId;
    const needPriorSnapshot = isAdminOnOther || updateData.email !== undefined;
    const priorUser = needPriorSnapshot
      ? await User.findById(userId).select('role auth.email auth.emailVerified profile.displayName profile.username tokenVersion')
      : null;

    // Check for email uniqueness if email is being updated
    if (updateData.email) {
      const normalizedEmail = updateData.email.toLowerCase();
      const existingUser = await User.findOne({ 
        'auth.email': normalizedEmail,
        _id: { $ne: userId } // Exclude current user
      });
      if (existingUser) {
        return res.status(409).json({ 
          message: 'Email already registered',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }
    
    // Check for username uniqueness if username is being updated
    if (updateData.profile?.username) {
      const normalizedUsername = updateData.profile.username.toLowerCase().trim();
      const existingUsername = await User.findOne({ 
        'profile.username': normalizedUsername,
        _id: { $ne: userId } // Exclude current user
      });
      if (existingUsername) {
        return res.status(409).json({ 
          message: 'Username already taken',
          code: 'USERNAME_ALREADY_EXISTS'
        });
      }
      // Normalize username in update data
      updateData.profile.username = normalizedUsername;
    }
    
    // Build update object for nested structure
    const updateObj: any = {};
    
    // Handle flat fields that map to nested structure (for backward compatibility)
    if (updateData.name) {
      updateObj['profile.displayName'] = updateData.name;
    }
    // Email change semantics (PR6):
    // - Treat case-only differences as no-op (auth.email is stored lowercase).
    // - On a real change, drop emailVerified back to false so the new address
    //   has to prove ownership before it's trusted again. Without this, a
    //   compromised account could be retargeted to an attacker-controlled
    //   address while keeping the verified flag.
    // - tokenVersion is bumped so any access token still encoding the OLD
    //   email payload claim cannot ride past the change.
    let emailChanged = false;
    if (updateData.email) {
      const normalizedNewEmail = updateData.email.toLowerCase();
      emailChanged = !!priorUser && priorUser.auth?.email !== normalizedNewEmail;
      updateObj['auth.email'] = normalizedNewEmail;
      updateObj['auth.updatedAt'] = new Date().toISOString();
      if (emailChanged) {
        updateObj['auth.emailVerified'] = false;
      }
    }
    if (updateData.role !== undefined) {
      updateObj.role = updateData.role;
    }
    // Bump tokenVersion (and revoke refresh tokens after save) whenever the
    // request meaningfully changes a security-relevant fact about the user:
    //   - admin demotion/promotion (role change, admin-on-other only)
    //   - email change (anyone — self or admin-on-other; the new address
    //     hasn't been re-verified, so any token still encoding the old
    //     email claim must die)
    // Tracked as a boolean so the $inc is applied at the Mongo update site
    // rather than being accidentally nested inside $set.
    const roleChanged =
      isAdminOnOther &&
      updateData.role !== undefined &&
      priorUser !== null &&
      priorUser.role !== updateData.role;
    const bumpTokenVersion = roleChanged || emailChanged;
    if (updateData.preferences) {
      updateObj['preferences.interestedCategories'] = updateData.preferences.interestedCategories;
    }
    if (updateData.lastFeedVisit) {
      updateObj['appState.lastLoginAt'] = updateData.lastFeedVisit;
    }
    // Handle legacy flat profile fields
    if (updateData.bio !== undefined) {
      updateObj['profile.bio'] = updateData.bio;
    }
    if (updateData.location !== undefined) {
      updateObj['profile.location'] = updateData.location;
    }
    if (updateData.website !== undefined) {
      updateObj['profile.website'] = updateData.website;
    }
    if (updateData.avatarUrl !== undefined) {
      updateObj['profile.avatarUrl'] = updateData.avatarUrl;
    }
    if (updateData.title !== undefined) {
      updateObj['profile.title'] = updateData.title;
    }
    if (updateData.company !== undefined) {
      updateObj['profile.company'] = updateData.company;
    }
    if (updateData.twitter !== undefined) {
      updateObj['profile.twitter'] = updateData.twitter;
    }
    if (updateData.linkedin !== undefined) {
      updateObj['profile.linkedin'] = updateData.linkedin;
    }
    if (updateData.youtube !== undefined) {
      updateObj['profile.youtube'] = updateData.youtube;
    }
    if (updateData.instagram !== undefined) {
      updateObj['profile.instagram'] = updateData.instagram;
    }
    if (updateData.facebook !== undefined) {
      updateObj['profile.facebook'] = updateData.facebook;
    }
    
    // Handle direct nested updates if provided
    if (updateData.profile) {
      Object.assign(updateObj, Object.keys(updateData.profile).reduce((acc, key) => {
        acc[`profile.${key}`] = (updateData.profile as any)[key];
        return acc;
      }, {} as any));
    }
    if (updateData.preferences && typeof updateData.preferences === 'object') {
      Object.keys(updateData.preferences).forEach(key => {
        if (key === 'notifications') {
          Object.keys((updateData.preferences as any).notifications || {}).forEach(nKey => {
            updateObj[`preferences.notifications.${nKey}`] = (updateData.preferences as any).notifications[nKey];
          });
        } else {
          updateObj[`preferences.${key}`] = (updateData.preferences as any)[key];
        }
      });
    }
    
    const updateOp: Record<string, unknown> = { $set: updateObj };
    if (bumpTokenVersion) {
      updateOp.$inc = { tokenVersion: 1 };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateOp,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // A bumped tokenVersion invalidates every live access token for this
    // user. Refresh tokens live in Redis and don't carry tokenVersion, so
    // revoke them too — otherwise the very next /auth/refresh would mint a
    // fresh access token for the now-stale role/email.
    if (bumpTokenVersion) {
      try {
        await revokeAllRefreshTokens(targetUserId);
      } catch (revokeErr) {
        // Non-fatal: tokenVersion enforcement still revokes access tokens.
        // Log so we can see Redis-related coverage gaps.
        const requestLogger = createRequestLogger(req.id || 'unknown', authUserId, req.path);
        requestLogger.warn({
          msg: '[TokenVersion] Failed to revoke refresh tokens after security-relevant update',
          targetUserId,
          roleChanged,
          emailChanged,
          err: revokeErr instanceof Error ? { message: revokeErr.message, name: revokeErr.name } : { message: String(revokeErr) },
        });
      }
    }

    // Email change side-effects (PR6): fire-and-forget verification to the
    // new address and a notice to the old one. Failures here MUST NOT undo
    // the email change — the user can re-request verification later, and
    // the change is already audit-logged below. We log delivery failures
    // explicitly so SMTP outages are visible rather than swallowed.
    if (emailChanged && priorUser) {
      const newEmail = updateObj['auth.email'] as string;
      const oldEmail = priorUser.auth?.email;
      const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationToken = generateEmailVerificationToken(targetUserId, newEmail);
      const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;

      void sendVerificationEmail(newEmail, verificationUrl).catch((err: Error) => {
        const requestLogger = createRequestLogger(req.id || 'unknown', authUserId, req.path);
        requestLogger.warn({
          msg: 'Failed to send post-change verification email to new address',
          targetUserId,
          err: { message: err.message, name: err.name },
        });
      });

      if (oldEmail && oldEmail !== newEmail) {
        void sendEmailChangedNoticeEmail(oldEmail, { newEmail }).catch((err: Error) => {
          const requestLogger = createRequestLogger(req.id || 'unknown', authUserId, req.path);
          requestLogger.warn({
            msg: 'Failed to send change-notice email to old address',
            targetUserId,
            err: { message: err.message, name: err.name },
          });
        });
      }
    }

    // Audit admin-on-other mutations. Two events because the AdminAuditLog
    // enum splits role and profile actions, and an admin doing both in one
    // request should leave both rows for the security timeline.
    if (isAdminOnOther && priorUser) {
      const roleChanged =
        updateData.role !== undefined && priorUser.role !== user.role;

      const profileFieldDiff: Record<string, { from: unknown; to: unknown }> = {};
      if (
        updateData.email !== undefined &&
        priorUser.auth?.email !== user.auth?.email
      ) {
        profileFieldDiff.email = { from: priorUser.auth?.email, to: user.auth?.email };
      }
      if (
        (updateData.name !== undefined || (updateData.profile as { displayName?: string } | undefined)?.displayName !== undefined) &&
        priorUser.profile?.displayName !== user.profile?.displayName
      ) {
        profileFieldDiff.displayName = {
          from: priorUser.profile?.displayName,
          to: user.profile?.displayName,
        };
      }
      if (
        updateData.profile?.username !== undefined &&
        priorUser.profile?.username !== user.profile?.username
      ) {
        profileFieldDiff.username = {
          from: priorUser.profile?.username,
          to: user.profile?.username,
        };
      }

      if (roleChanged) {
        await auditAdminAction(req, {
          action: 'UPDATE_USER_ROLE',
          targetType: 'user',
          targetId: userId,
          previousValue: { role: priorUser.role },
          newValue: { role: user.role },
          metadata: { targetEmail: user.auth?.email },
        });
      }
      if (Object.keys(profileFieldDiff).length > 0) {
        await auditAdminAction(req, {
          action: 'UPDATE_USER_PROFILE',
          targetType: 'user',
          targetId: userId,
          previousValue: Object.fromEntries(
            Object.entries(profileFieldDiff).map(([k, v]) => [k, v.from])
          ),
          newValue: Object.fromEntries(
            Object.entries(profileFieldDiff).map(([k, v]) => [k, v.to])
          ),
          metadata: { changedFields: Object.keys(profileFieldDiff) },
        });
      }
    }

    res.json(normalizeDoc(user));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Update user error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      let code = 'EMAIL_ALREADY_EXISTS';
      let message = 'Email already registered';
      
      if (keyPattern['auth.email']) {
        code = 'EMAIL_ALREADY_EXISTS';
        message = 'Email already registered';
      } else if (keyPattern['profile.username']) {
        code = 'USERNAME_ALREADY_EXISTS';
        message = 'Username already taken';
      }
      
      return res.status(409).json({ 
        message,
        code
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as { user?: { userId?: string; role?: string } }).user?.userId;
    const authRole = (req as { user?: { userId?: string; role?: string } }).user?.role;
    const targetUserId = req.params.id;
    const access = accessUserMutation(authUserId, authRole, targetUserId);
    if (access === 'unauthenticated') {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (access === 'forbid') {
      return res.status(403).json({ message: 'You can only delete your own account' });
    }

    const isAdminOnOther = authRole === 'admin' && authUserId !== targetUserId;

    const user = await User.findByIdAndDelete(targetUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Refresh tokens live in Redis keyed by userId. The User document is now
    // gone, but the refresh tokens would still rotate into fresh access
    // tokens until their TTL expires — revoke them explicitly. Once PR7
    // converts this to soft delete, the tokenVersion bump will cover access
    // tokens too; for now (hard delete), there's no DB row left to bump
    // against, but we still want refresh tokens dead.
    try {
      await revokeAllRefreshTokens(targetUserId);
    } catch (revokeErr) {
      const requestLogger = createRequestLogger(req.id || 'unknown', authUserId, req.path);
      requestLogger.warn({
        msg: '[TokenVersion] Failed to revoke refresh tokens after delete',
        targetUserId,
        err: revokeErr instanceof Error ? { message: revokeErr.message, name: revokeErr.name } : { message: String(revokeErr) },
      });
    }

    if (isAdminOnOther) {
      await auditAdminAction(req, {
        action: 'DELETE_USER',
        targetType: 'user',
        targetId: targetUserId,
        previousValue: {
          email: user.auth?.email,
          username: user.profile?.username,
          displayName: user.profile?.displayName,
          role: user.role,
        },
      });
    }

    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Delete user error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPersonalizedFeed = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Authz: only the owner or an admin may read another user's personalized
    // feed. Without this any authenticated user could enumerate another
    // user's interest tags AND forge their `appState.lastLoginAt` (which
    // corrupts dormancy and security-event signals).
    const authUserId = (req as { user?: { userId?: string; role?: string } }).user?.userId;
    const authRole = (req as { user?: { userId?: string; role?: string } }).user?.role;
    const access = accessUserMutation(authUserId, authRole, userId);
    if (access === 'unauthenticated') {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (access === 'forbid') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's interested tags from nested preferences (previously interestedCategories)
    const tagNames = user.preferences?.interestedCategories || [];
    const lastVisit = user.appState?.lastLoginAt
      ? new Date(user.appState.lastLoginAt)
      : new Date(0);

    // P2-7: Resolve user preference tag names to tagIds
    const resolvedTagIds = tagNames.length > 0
      ? await resolveTagNamesToIds(tagNames)
      : [];

    // Build MongoDB query for articles matching user's interests
    // PRIVACY FIX: Only show public articles in personalized feed
    const articleQuery: any = {
      visibility: 'public',
    };
    if (resolvedTagIds.length > 0) {
      articleQuery.tagIds = { $in: resolvedTagIds };
    }
    
    // Find articles matching user's interests (only public)
    const articles = await Article.find(articleQuery)
      .sort({ publishedAt: -1 })
      .limit(50); // Limit to 50 articles

    // Count new articles since last feed visit using MongoDB query (more efficient)
    // PRIVACY FIX: Ensure privacy filter is applied to count query
    const countQuery = {
      ...articleQuery,
      publishedAt: { $gt: lastVisit.toISOString() }
    };
    const newCount = await Article.countDocuments(countQuery);

    // Only the owner's own feed read advances lastLoginAt. Admin reads of
    // another user's feed are observation-only — overwriting lastLoginAt
    // there would silently mask user dormancy.
    if (authUserId === userId) {
      await User.findByIdAndUpdate(
        userId,
        { $set: { 'appState.lastLoginAt': new Date().toISOString() } },
        { new: false } // Don't need to return updated document
      );
    }

    res.json({
      articles: await normalizeArticleDocs(articles),
      newCount
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get personalized feed error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};
