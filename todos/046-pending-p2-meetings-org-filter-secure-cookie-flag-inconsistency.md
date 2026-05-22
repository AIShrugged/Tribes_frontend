---
id: '046'
priority: P2
status: pending
area: organization
file: features/organization/api/organization.ts
---

# Fix `secure` cookie flag to include `NEXT_PUBLIC_APP_ENV` check

## Problem

`features/organization/api/organization.ts` (lines ~182-231) sets the
`organization_id` cookie with:

```ts
secure: process.env.NODE_ENV === 'production';
```

The auth module (`features/auth/api/auth.ts`) uses a more complete check:

```ts
secure: process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'production';
```

This means that on staging environments where `NEXT_PUBLIC_APP_ENV=production`
but `NODE_ENV=development`, the auth token cookie is marked `Secure` (correct)
but the `organization_id` cookie is not (incorrect). An insecure
`organization_id` cookie on a production-grade deployment is a minor but real
security inconsistency.

## Required Fix

In `features/organization/api/organization.ts`, update both
`setActiveOrganization` and `selectOrganizationAction` (or whatever functions
set the cookie):

```ts
secure: process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'production';
```

This is a 2-line change. Security sentinel flags it as a fix that should be
included in the meetings org-filter sync PR, not deferred.
