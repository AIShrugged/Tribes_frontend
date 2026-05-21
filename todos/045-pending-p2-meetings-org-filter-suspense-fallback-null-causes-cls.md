---
id: "045"
priority: P2
status: pending
area: meetings
file: app/dashboard/meetings/list/page.tsx
---

# `<Suspense fallback={null}>` for filter bar causes CLS — use height-preserving skeleton

## Problem

The plan wraps `MeetingsListFiltersBar` in `<Suspense fallback={null}>` to satisfy the `useSearchParams()` build requirement. However, `fallback={null}` renders nothing while the boundary is suspended, then the filter bar (~48-56 px tall, `py-3 border-b`) pops in and shifts the meetings list content downward. This is a textbook Cumulative Layout Shift (CLS) defect visible on initial page load.

The plan mentions `<FiltersBarSkeleton />` as an option but uses `null` in every concrete code example, leaving the decision ambiguous.

## Required Fix

Use a height-preserving placeholder instead of `null`:

```tsx
<Suspense fallback={<div className="h-14 border-b border-border bg-card" />}>
  <MeetingsListFiltersBar key={cookieOrgId} cookieOrgId={cookieOrgId} ... />
</Suspense>
```

Or extract a proper `<MeetingsListFiltersBarSkeleton />` component if the filter bar has varying height. The placeholder must match the rendered filter bar height so layout does not shift when the real component appears.

Apply this to both Suspense wrappers (one per render branch — see todo 041).
