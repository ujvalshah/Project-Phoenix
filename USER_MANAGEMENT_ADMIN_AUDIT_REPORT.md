# User Management Audit Report (Admin Capability)

Date: 2026-04-22  
Project: Project-Phoenix  
Scope: Admin UI, backend APIs, data model, auth/session, RBAC, auditability/export, compliance/privacy, lifecycle controls

## 1) Executive Summary

The current User Management capability is partially functional but not enterprise-ready. Core visibility is broken in the Admin UI (email not actually shown in the list), export/download for users is not implemented end-to-end, lifecycle controls are incomplete, and there are critical authorization and auditability gaps.

Most urgent risks:

- P0 authz bug: `/api/admin/stats` is not admin-gated.
- P0 authorization flaw: `/api/users/:id/feed` allows any authenticated user to access another user's feed context and mutate that user's `lastLoginAt`.
- P0 audit gap: sensitive user mutations are not comprehensively logged in admin audit logs.
- P0 ops gap: user status/suspension appears in UI but backend does not support it.

---

## 2) Current-State Findings (What Exists)

### Admin UI

- Users directory exists: `src/admin/pages/AdminUsersPage.tsx`
- Basic search/filter/sort UI exists (role/date/search; client-side enhancements).
- Drawer-style user detail view exists (not a full dedicated detail page).
- Role/status controls appear in table and drawer.
- Bulk action controls appear but are not implemented.

### Backend APIs

- Admin user list and details endpoints exist:
  - `GET /api/users` (admin-only)
  - `GET /api/users/:id` (admin-only)
- Update/delete endpoints exist:
  - `PUT /api/users/:id`
  - `DELETE /api/users/:id`
- Admin verify-email endpoint exists:
  - `PATCH /api/admin/users/:userId/verify-email`

### Data Model

- User model has key fields:
  - `auth.email`, `auth.emailVerified`, `auth.provider`
  - `profile.username`, `profile.displayName`
  - `role`, `appState.lastLoginAt`, `security.mfaEnabled`
- Unique constraints on email/username exist.

### Auth/Session Foundation

- Refresh token rotation, token reuse detection, lockout, logout-all, session listing exist.
- CSRF middleware exists and is globally applied to `/api`.
- Helmet/CORS/compression are present in server bootstrap.

### Audit Model

- `AdminAuditLog` model exists with useful fields (`adminId`, action, target, old/new, ip/user-agent, timestamp).
- Logging coverage is currently limited to a small subset of admin actions.

---

## 3) Missing Capabilities

### Must-Have Missing

- Real user export/download pipeline (UI + API + backend job + access controls).
- Backend support for lifecycle status model (`active/suspended/banned/deactivated/deleted`).
- Fine-grained RBAC (beyond `admin|user`) with separation-of-duty.
- Complete admin audit trail for all user-management mutations.
- Admin controls for session revocation/force logout on target user.

### Should-Have Missing

- Dedicated user detail page with structured identity/security/session panes.
- Robust server-side user filtering/sorting facets (status/provider/verification/last login bucket/dormant).
- Reason capture for suspension/ban/role changes/deletion.
- Safer destructive confirmations (typed confirmation where needed).

### Optional Missing

- Internal notes/tags on user records.
- Saved views/filters.
- Controlled impersonation flow with strong safeguards and audit.

---

## 4) Security and Privacy Loopholes

## Critical (P0)

1. `/api/admin/stats` is only protected by authentication, not admin authorization.
   - File: `server/src/routes/admin.ts`
   - Current route: `router.get('/stats', authenticateToken, getAdminStats);`
   - Risk: any authenticated non-admin can access admin-level stats.

2. `/api/users/:id/feed` lacks owner/admin access check.
   - Files: `server/src/routes/users.ts`, `server/src/controllers/usersController.ts`
   - Risk: authenticated users can query another user's personalized feed and mutate that user's `appState.lastLoginAt`.

## High

- Sensitive user mutations (`PUT /users/:id`, `DELETE /users/:id`) are not consistently written to `AdminAuditLog`.
- UI presents status/role controls without complete backend parity and governance.

## Medium

- Coarse RBAC model (`admin|user`) is insufficient for enterprise least privilege.
- Potential overexposure of user payload in admin list/details without permission-tiered field minimization.
- No step-up authentication requirement for high-risk admin actions (export, role elevation, delete).

---

## 5) UX and Operational Gaps

- "Email" column does not render email addresses; it renders verification status only.
- Bulk actions are visible but non-functional.
- Admin "Edit profile" save path is local-state only and does not persist via API.
- No explicit reason capture for punitive/irreversible actions.
- No operational user timeline panel (security + admin actions + status changes).
- No clear dormant/unverified/suspended risk dashboards for support workflows.

---

## 6) Recommended Admin Actions to Add

### Must-Have

- Suspend/unsuspend
- Ban/unban
- Deactivate/reactivate
- Force logout / revoke all sessions for target user
- Admin-triggered password reset flow
- Resend verification and policy-gated manual verify
- Export selected/all users with strict controls and logging
- Soft delete with restore window

### Should-Have

- Bulk actions with preview/confirmation
- Role/permission assignment workflows with rationale capture
- Internal notes/tags for support and trust/safety operations

### Optional

- Secure impersonation with visible banner, strict TTL, and comprehensive logging

---

## 7) Recommended Schema and API Changes

### User Schema Additions

- `status` enum: `active|suspended|banned|deactivated|pending_verification`
- `suspension`: `{ reason, by, at, expiresAt }`
- `ban`: `{ reason, by, at, expiresAt? }`
- `deletedAt`, `deletedBy`, `deletionReason`, `purgeAfter`
- `sessionRevokedAt` or `tokenVersion`
- Optional business fields if applicable: `plan`, `subscriptionStatus`, `billingRef`
- Optional risk/governance fields: `riskFlags`, `lastRiskEventAt`, consent/retention markers

### API Additions

- `GET /api/admin/users` (strong filter/sort/paginate contract)
- `GET /api/admin/users/:id` (enriched detail payload)
- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/users/:id/revoke-sessions`
- `POST /api/admin/users/:id/reset-password`
- `POST /api/admin/users/export` (async export job)
- `GET /api/admin/exports/:jobId`
- `POST /api/admin/users/bulk-actions`

### Index Recommendations

- Add/verify indexes for admin list performance:
  - `auth.createdAt`
  - compound indexes aligned to filters (e.g. `status+role+lastLoginAt`)

---

## 8) Recommended RBAC Model

Move from binary role model to permission-based RBAC:

- Roles:
  - `support_admin`
  - `content_admin`
  - `security_admin`
  - `ops_admin`
  - `finance_admin`
  - `super_admin`
- Permission units:
  - `users.read_basic`
  - `users.read_pii`
  - `users.status.change`
  - `users.role.change`
  - `users.export`
  - `users.delete`
  - `users.sessions.revoke`
- Enforce on server-side policy middleware/service layer, not just UI.
- Add step-up authentication for high-risk permissions.

---

## 9) Recommended Audit-Log Model and Coverage

### Keep and Extend `AdminAuditLog`

Required event fields for every sensitive admin action:

- actor id/role
- action name
- target type/id
- previous value -> new value
- reason
- request id / correlation id
- source ip / user-agent
- timestamp

### Coverage Requirements

Log all of:

- role changes
- status/suspension/ban transitions
- profile edits by admins
- delete/restore/purge
- password/security actions
- session revocations
- export job create/download

### Hardening

- Add tamper-evidence strategy (append-only storage, hash-chaining, or immutable sink).
- Define retention and searchable exportable audit interfaces.

---

## 10) Recommended Export/Download Capability

Implement secure asynchronous export jobs:

1. Admin selects scope (filtered set / selected users / all users) and columns.
2. Backend validates permissions and field-level visibility.
3. Export generated in background and stored encrypted with TTL.
4. Download via signed URL/tokenized endpoint.
5. Audit events recorded for request and download.

Controls:

- limit max rows per role
- require explicit confirmation on large exports
- include watermark/trace metadata in export artifact
- rate-limit export endpoints

---

## 11) Prioritized Roadmap

### P0 (Critical)

- Fix Admin email visibility bug in user list/detail.
- Add `requireAdminRole` to `/api/admin/stats`.
- Add owner/admin authorization to `/api/users/:id/feed`.
- Implement backend user status model and status mutation endpoint.
- Remove/disable fake status mutations in UI until backend support exists.
- Enforce comprehensive audit logging for admin user mutations.
- Build secure user export API + backend job + UI integration.

### P1 (Important)

- Build full user detail page (identity, provider, sessions, security events, admin timeline).
- Add target-user session revocation action.
- Add reason capture + stronger destructive confirmations.
- Introduce permission-based RBAC.
- Expand server-side filtering/sorting/pagination for operations-grade directory.

### P2 (Nice-to-Have)

- Saved filters/views, notes/tags, segmentation.
- Controlled impersonation flow with strict governance.
- DSAR workflow orchestration (export/delete requests with approvals).

---

## 12) Key File and Endpoint References

### Frontend

- `src/admin/pages/AdminUsersPage.tsx`
- `src/admin/pages/AdminDownloadsPage.tsx`
- `src/admin/services/adminUsersService.ts`
- `src/admin/services/adminApiMappers.ts`
- `src/admin/auth/adminPermissions.ts`
- `src/admin/hooks/useAdminPermissions.ts`

### Backend

- `server/src/routes/users.ts`
- `server/src/controllers/usersController.ts`
- `server/src/routes/admin.ts`
- `server/src/controllers/adminController.ts`
- `server/src/models/User.ts`
- `server/src/models/AdminAuditLog.ts`
- `server/src/controllers/authController.ts`
- `server/src/middleware/csrf.ts`
- `server/src/middleware/rateLimiter.ts`
- `server/src/index.ts`

---

## Appendix: Direct Answer Snapshot

- Why email/username not visible in Admin?
  - Primary cause: UI bug/omission in `AdminUsersPage` where "Email" column renders verification badge instead of email value.
  - Secondary risk: adapter/public endpoint mixups can hide email if wrong endpoint is used.

- Can admins export/download users today?
  - Not fully. UI exists but backend export endpoint for users is missing; no true end-to-end export flow.

- Does current design meet enterprise least privilege/auditability standards?
  - Not yet. Requires RBAC hardening, server-side authorization fixes, complete audit coverage, and secure export governance.

