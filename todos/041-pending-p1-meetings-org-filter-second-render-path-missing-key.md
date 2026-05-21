---
id: "041"
priority: P1
status: pending
area: meetings
file: app/dashboard/meetings/list/page.tsx
---

# Both render paths in meetings list page must receive `key={cookieOrgId}`

## Problem

`app/dashboard/meetings/list/page.tsx` has **two separate `return` statements**, each rendering `MeetingsListFiltersBar`:

- Line ~53 (filtered mode — `filtersActive === true`) with a `Card` + search input layout
- Line ~92 (column mode — default, most common path) with a multi-column `Card` layout

The plan's fix adds `key={cookieOrgId}` and the `cookieOrgId` prop to only one render path. The second branch (column view, which is the default) continues initializing from `organizations[0]` with no key, meaning the org-filter sync fix is broken for the majority of users who land on the default view.

## Required Fix

Both return branches need:
1. `key={cookieOrgId}` on `<MeetingsListFiltersBar>`
2. `cookieOrgId` prop passed down
3. Their own `<Suspense>` wrapper (or hoist the Suspense above the conditional)

```tsx
// Both branches must look like this:
<Suspense fallback={<div className="h-14 border-b border-border bg-card" />}>
  <MeetingsListFiltersBar
    key={cookieOrgId}
    cookieOrgId={cookieOrgId}
    organizations={organizations}
    // ...other props
  />
</Suspense>
```

Consider extracting the `<Suspense><MeetingsListFiltersBar .../></Suspense>` block into a shared variable before the branching `return` to avoid duplicating the wrapper.

## Why Critical

Without this, the fix only applies to the filters-active view. Users who access the page fresh (no active filters, column layout) see the wrong org in the dropdown — the exact bug this PR is supposed to fix.
