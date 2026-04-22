# User Management Audit Report (Enterprise SaaS)

Date: 2026-04-22  
Project: Project-Phoenix  
Scope: Admin UI, APIs, schema, authn/authz, RBAC, audit logs, export, lifecycle operations

## Executive Summary

Admin User Management is foundational but not enterprise-ready.  
Core visibility is incomplete, export is not implemented end-to-end, lifecycle actions are partial, and there are high-impact server-side authorization and auditability gaps.

Top material issues:

- P0: `/api/admin/stats` is not admin-enforced server-side.
- P0: `/api/users/:id/feed` appears accessible to any authenticated user for any target id.
- P0: Sensitive admin mutations are not comprehensively audit-logged.
- P0: UI exposes status/bulk controls that backend does not implement.

---

## What Exists

- Admin users directory and drawer detail UI: `src/admin/pages/AdminUsersPage.tsx`
- User list/get APIs with admin guard:
  - `GET /api/users`
  - `GET /api/users/:id`
  - Files: `server/src/routes/users.ts`, `server/src/controllers/usersController.ts`
- User model includes core identity fields:
  - `auth.email`, `profile.username`, `role`, `auth.provider`, `auth.emailVerified`, `appState.lastLoginAt`
  - File: `server/src/models/User.ts`
- Auth/session has strong primitives:
  - refresh rotation/reuse detection, lockout, logout-all, sessions
  - File: `server/src/controllers/authController.ts`
- Security middleware baseline present:
  - Helmet, CORS, compression, CSRF
  - File: `server/src/index.ts`
- Admin audit model exists:
  - File: `server/src/models/AdminAuditLog.ts`

---

## What Is Broken or Missing

- Email visibility bug in Admin list: “Email” column renders verification state, not email value.
  - File: `src/admin/pages/AdminUsersPage.tsx`
- Username/email not presented as clear first-class identity fields in detail drawer.
- Export/download is stubbed:
  - `src/admin/pages/AdminDownloadsPage.tsx` only toasts; no real user export API/job.
- Status lifecycle is not backend-backed:
  - `updateUserStatus` explicitly unsupported in `src/admin/services/adminUsersService.ts`
- Bulk actions are UI-only and not executed.
- Some edit UX is optimistic/local and not operationally reliable for admin workflows.

---

## Security / Privacy Risks

### Critical (P0)

1. Admin stats endpoint lacks admin authorization:
   - `server/src/routes/admin.ts`
   - `router.get('/stats', authenticateToken, getAdminStats);`
2. Personalized feed endpoint lacks owner/admin scope enforcement:
   - `server/src/routes/users.ts` + `server/src/controllers/usersController.ts`
3. Sensitive admin mutations are not fully covered by admin audit logging.

### High

- RBAC is too coarse (`admin|user`) for least-privilege enterprise control.
- Frontend permissions map `admin` effectively as `superadmin`:
  - `src/admin/auth/adminPermissions.ts`

### Medium

- PII field exposure is not role-tiered (support vs security vs super admin).
- No step-up auth for high-risk actions (export/delete/role elevation).

---

## UX / Operational Gaps

- Misleading “Email” column behavior.
- Non-functional bulk actions create operator risk.
- No reason capture for destructive/sensitive actions.
- No irreversible-action safeguards (typed confirmation/impact summary).
- No comprehensive user ops pane (sessions, security events, admin timeline).
- Limited server-side filtering/sorting/pagination depth for scaled support ops.

---

## Must-Have Additions

- Fix Admin email/username visibility in list and detail views.
- Add strict server-side admin checks for all admin endpoints (starting with `/api/admin/stats`).
- Add owner/admin checks for `/api/users/:id/feed`.
- Implement real user lifecycle state model and APIs:
  - suspend/unsuspend, ban/unban, deactivate/reactivate, soft delete
- Implement target-user session revocation / force logout.
- Implement secure end-to-end user export (async jobs + auditing + access controls).
- Make audit logging mandatory for all sensitive user/admin mutations.

---

## Should-Have Additions

- Permission-based RBAC with separation of duties.
- Reason capture for role/status/delete/export actions.
- Approval or step-up auth for highest-risk actions.
- Full user detail page with identity, provider links, session/device visibility, security and admin action timeline.
- Strong server-side directory filters/sorts/pagination for operations.

---

## Nice-to-Have Additions

- Saved views and operational filters.
- Internal notes/tags for support/security workflows.
- Controlled impersonation with explicit banner, strict TTL, and immutable logging.

---

## Recommended Schema/API Changes

### Schema

Add to `User`:

- `status`: `active|suspended|banned|deactivated|pending_verification`
- `suspension`: `{ reason, by, at, expiresAt }`
- `ban`: `{ reason, by, at, expiresAt? }`
- `deletedAt`, `deletedBy`, `deletionReason`, `purgeAfter`
- `sessionRevokedAt` or `tokenVersion`
- Optional governance/business fields as applicable: plan/subscription/risk markers

### API

Add:

- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/users/:id/revoke-sessions`
- `POST /api/admin/users/:id/reset-password`
- `POST /api/admin/users/export`
- `GET /api/admin/exports/:jobId`
- `POST /api/admin/users/bulk-actions`

### Indexes

- Add list-query aligned indexes (e.g. `auth.createdAt`, `status+role+lastLoginAt`).

---

## Recommended RBAC Changes

Replace coarse roles with permission-scoped roles:

- `support_admin`, `security_admin`, `ops_admin`, `finance_admin`, `super_admin`

Enforce server-side permissions:

- `users.read_basic`, `users.read_pii`, `users.status.change`, `users.role.change`, `users.export`, `users.delete`, `users.sessions.revoke`

Add step-up auth for high-risk permissions.

---

## Recommended Audit-Log Changes

Expand `AdminAuditLog` coverage to all sensitive actions:

- role changes
- status/suspension/ban transitions
- profile changes by admins
- delete/restore/purge
- password/security actions
- session revocations
- export request + download events

Required event fields:

- actor, action, target, before/after, reason, requestId, IP, user-agent, timestamp

Add tamper-resistance strategy and retention/search/export policy.

---

## Prioritized Roadmap

### P0 (Critical)

1. Fix email/username visibility in Admin UI.
2. Add `requireAdminRole` to `/api/admin/stats`.
3. Add owner/admin authz checks to `/api/users/:id/feed`.
4. Implement backend lifecycle status model and endpoints.
5. Remove/disable fake status/bulk UI until backend is live.
6. Add mandatory audit logging for sensitive mutations.
7. Implement secure user export end-to-end.

### P1 (Important)

1. Introduce permission-based RBAC and least-privilege field access.
2. Add target-user revoke-sessions / force logout action.
3. Add reason capture + safer destructive-action UX.
4. Improve server-side search/filter/sort/pagination.

### P2 (Nice-to-have)

1. Saved filters, notes/tags.
2. Controlled impersonation.
3. DSAR-style export/deletion orchestration with approvals.

