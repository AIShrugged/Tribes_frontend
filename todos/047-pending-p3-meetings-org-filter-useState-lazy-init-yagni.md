---
id: '047'
priority: P3
status: pending
area: meetings
file: features/meetings/ui/meetings-list-filters-bar.tsx
---

# Remove lazy `useState` initializer — direct `useState(cookieOrgId)` is sufficient

## Problem

The plan's code sample uses a lazy initializer for the `organizationId` state:

```ts
const [organizationId, setOrganizationId] = useState(() => cookieOrgId);
```

Lazy initializers exist to avoid re-running expensive computations on every
render. `cookieOrgId` is a plain string prop — there is no computation to
memoize. With `key={cookieOrgId}`, the component remounts when the org changes,
so the initializer runs exactly once regardless. The `() =>` wrapper is pure
noise.

## Required Fix

```ts
const [organizationId, setOrganizationId] = useState(cookieOrgId);
```

This also fixes the existing bug where the component used `organizations[0]?.id`
as the initial value instead of the cookie.
