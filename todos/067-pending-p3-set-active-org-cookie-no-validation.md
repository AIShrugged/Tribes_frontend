---
status: pending
priority: p3
issue_id: "067"
tags: [code-review, security, organization, server-actions, authorization]
dependencies: []
---

# setActiveOrganization Writes Cookie Without Membership Validation

## Problem Statement

`setActiveOrganization` and `selectOrganizationAction` in `features/organization/api/organization.ts` write the `organization_id` cookie from user-supplied `FormData` input without validating that the authenticated user is actually a member of the submitted organization. An authenticated user can invoke these Server Actions with any arbitrary org ID.

The backend's `TenantScopeValidator` catches unauthorized access at the API call level (returns 422), so no data is actually accessed across org boundaries. However, the frontend will temporarily display UI scoped to an org the user does not belong to, and any subsequent `createChat` call (with the proposed plan) would fail with a 422.

## Findings

`setActiveOrganization` (lines 182–205 of `organization.ts`):
```typescript
const id = formData.get('organization_id') as string;  // raw, unvalidated
cookieStore.set({ name: 'organization_id', value: id, httpOnly: true, ... });
// No membership check before writing
```

`selectOrganizationAction` (lines 212–235): Same pattern — cookie written before any validation. The subsequent `getOrganization(id)` call fetches the org but does not explicitly check membership before the cookie is already committed.

**Risk:** Medium. The backend is the true last line of enforcement. Frontend inconsistency (wrong-org UI) is the main impact.

## Proposed Solutions

### Option 1 (Recommended): Validate against the org list before writing

```typescript
const organizations = await getOrganizations(); // returns only user's orgs
const isValidOrg = organizations.some(org => String(org.id) === id);
if (!isValidOrg) {
  return; // or return an error state
}
cookieStore.set({ name: 'organization_id', value: id, ... });
```

`getOrganizations()` already returns only orgs the authenticated user belongs to — use this as an allowlist.

**Effort:** Small | **Risk:** Low

### Option 2: Add integer validation only (minimal)

Validate that `id` is a positive integer string before writing, to prevent obviously bad values:
```typescript
const numId = Number(id);
if (!Number.isInteger(numId) || numId <= 0 || String(numId) !== id.trim()) {
  return; // reject malformed input
}
```

Does not prevent unauthorized org IDs but prevents garbage values.

**Effort:** Trivial | **Risk:** None

### Option 3: Accept as-is, rely on backend enforcement

The backend catches unauthorized org access. This is a defense-in-depth improvement, not a security fix.

**Effort:** None | **Risk:** Low (status quo)

## Recommended Action

Option 1 as a separate small PR. Not a blocker for the `createChat` plan.

## Technical Details

**Affected files:**
- `features/organization/api/organization.ts` — `setActiveOrganization` and `selectOrganizationAction`

## Acceptance Criteria

- [ ] Submitting an arbitrary `organization_id` to `setActiveOrganization` does not write a cookie if the user is not a member
- [ ] The validation uses the org list (from `getOrganizations()`) as an allowlist

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (security-sentinel)

Found as a pre-existing gap, surfaced during review of the `createChat` plan's cookie-trust model.
