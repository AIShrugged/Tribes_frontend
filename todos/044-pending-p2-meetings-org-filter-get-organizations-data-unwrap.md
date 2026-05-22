---
id: '044'
priority: P2
status: pending
area: meetings
file: app/dashboard/meetings/list/page.tsx
---

# `getOrganizations()` return value requires `.data ?? []` unwrap

## Problem

The plan's `Promise.all` code sample destructures `getOrganizations()` directly
into `organizations`:

```ts
const [organizations, cookieOrgId] = await Promise.all([
  getOrganizations(),
  getOrganizationId(),
]);
```

`getOrganizations()` returns `ApiResponse<OrganizationProps[]>` (the standard
backend envelope), not `OrganizationProps[]`. Passing the raw `ApiResponse`
object as the `organizations` prop to `MeetingsListFiltersBar` would produce a
TypeScript type error and runtime breakage.

## Required Fix

Unwrap the data after the `Promise.all`:

```ts
const [orgsResponse, cookieOrgId] = await Promise.all([
  getOrganizations(),
  getOrganizationId(),
]);
const organizations = orgsResponse.data ?? [];
```

Or inline:

```ts
const [[organizations], cookieOrgId] = await Promise.all([
  getOrganizations().then((r) => [r.data ?? []]),
  getOrganizationId(),
]);
```

The first form (unwrap after) is more readable and matches the pattern used in
`app/dashboard/issues/(tabs)/layout.tsx`.
