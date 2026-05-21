---
id: "049"
priority: P3
status: pending
area: meetings
file: app/dashboard/meetings/list/page.tsx
---

# Do not add second `<Suspense>` boundary for meetings list content — YAGNI

## Problem

The plan suggests adding a second `<Suspense>` boundary around the meetings list content (below the filter bar) to "prevent full-page flash." The meetings list is server-rendered content that uses `loading.tsx` for streaming — it is not a Client Component using `useSearchParams()`. The `useSearchParams()` Suspense requirement only applies to the filter bar Client Component.

Adding a second Suspense boundary for the list content:
- Adds complexity without fixing a real problem
- Introduces a second fallback that may not match the existing `loading.tsx` skeleton
- Is not required by any build constraint

## Required Fix

Only add one `<Suspense>` wrapper, around `<MeetingsListFiltersBar>` (or two — one per render branch, per todo 041). Do not add a Suspense wrapper around the meetings list or date-column sections.
