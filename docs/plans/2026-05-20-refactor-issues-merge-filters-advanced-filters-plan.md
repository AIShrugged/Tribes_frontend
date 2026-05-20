---
title: "refactor: Merge Filters and Advanced Filters into a Single Visual Block on /dashboard/issues"
type: refactor
status: completed
date: 2026-05-20
---

## Enhancement Summary

**Deepened on:** 2026-05-20
**Agents used:** kieran-typescript-reviewer, design-guardian, code-simplicity-reviewer (×2), architecture-strategist, pattern-recognition-specialist

### Key Improvements Added
1. **Design alternative:** Use a visual separator ("More filters" divider) instead of full removal — preserves grouping without a second collapse trigger
2. **Active state signal must be preserved** — moving the violet dot to the outer "Filters" header is non-negotiable UX
3. **Stale closure bug found** in search `useEffect` — must fix `onChange` dep array in same PR
4. **DRY fix identified** — `personOptions` and `authorOptions` share identical `.map()` logic; extract once
5. **Pre-existing kanban gap** — `author_id`/`epic_id` not forwarded to kanban API; newly visible after this change; must be tracked

### New Considerations Discovered
- The violet dot active indicator cannot simply be removed — it must move to the outer collapsible header
- "9 filter fields" is incorrect — the issues layout shows **7** visible fields (Type hidden via `hasTypeToggle`)
- The kanban tab silently ignores `author_id` and `epic_id` today; this gap becomes more user-visible after the merge
- React Compiler handles option array memoization automatically — no explicit `useMemo` needed

---

# refactor: Merge Filters and Advanced Filters into a Single Visual Block

## Overview

The `/dashboard/issues` page currently shows **two nested collapsible sections** for filtering:

1. **"Filters"** — outer `CollapsibleSection` (Search, Assignee, Org, Team, Status)
2. **"Advanced filters"** — inner `CollapsibleSection` nested inside (Author, Epic)

The goal is to merge them into a **single flat filter block**: all controls visible in one cohesive area, no nested collapsible for advanced fields. The outer "Filters" collapsible wrapper can be kept (for the collapse-all behaviour) but the inner "Advanced filters" sub-collapsible must be dissolved.

> **Field count note:** The issues layout calls `SharedFiltersBar` with `hasTypeToggle={true}`, which suppresses the Type dropdown at runtime. So the visible field count is **7** (Search, Assignee, Organization, Team, Status, Author, Epic) — not 9.

---

## Why Were Advanced Filters Separated? (Historical Context)

The inner "Advanced filters" `CollapsibleSection` was added in `SharedFiltersBar` for a UX reason: **Author** and **Epic** are infrequently used secondary filters that would add visual clutter when empty. By nesting them behind a secondary collapsible:

- The filter bar stays compact by default (inner section collapsed when neither `author_id` nor `epic_id` is set).
- A violet dot indicator (`h-1.5 w-1.5 rounded-full bg-primary`) appears next to the "Advanced filters" label when either field has a value, so active state is visible even when collapsed.
- The outer "Filters" header remains short and scannable.

This was a reasonable trade-off at the time. However, the separation now causes friction:
- Two distinct collapse triggers confuse users ("why is there a sub-filter inside filters?").
- The visual inconsistency between a primary blue label ("Filters") and a plain grey sub-label ("Advanced filters") reads as two separate feature areas.
- Author and Epic are not meaningfully "more advanced" than Status or Assignee — the distinction is arbitrary.
- With the current small set of filter fields, the bar is not crowded enough to justify the nested structure.

---

## Current Component Tree

```
IssuesLayoutClient
└── CollapsibleSection label="Filters"           ← outer (issues-layout-client.tsx:223)
      extraContent: [FilterPresetsPanel, IssueCreateButton]
      └── SharedFiltersBar                         ← shared-filters-bar.tsx
            ├── Row 1: Search input + Assignee dropdown
            ├── Row 2: TenantScopeFields (Organization + Team)
            ├── Row 3: Status dropdown (Type hidden — hasTypeToggle=true)
            └── CollapsibleSection label="Advanced filters"  ← INNER (line 174)
                  defaultOpen={hasAdvancedFilters}
                  extraContent={violet dot indicator}
                  └── Row 4: Author dropdown + Epic dropdown
```

---

## Proposed Solution

### Option A — Full removal (Recommended)

Remove the inner `CollapsibleSection label="Advanced filters"` from `SharedFiltersBar` and render Author + Epic directly as another grid row — identical in style to the Status row. **Simultaneously move the active-state dot to the outer "Filters" header** (see Active State section below — this is mandatory).

### Option B — Visual separator (Alternative if UX regression is a concern)

Replace the inner collapsible with a thin labelled divider. Fields always visible, grouping preserved, zero interaction overhead:

```tsx
{/* After the Status row */}
<div className='flex items-center gap-3'>
  <div className='h-px flex-1 bg-border/50' />
  <span className='text-xs text-muted-foreground/60 shrink-0 select-none'>
    More filters
  </span>
  <div className='h-px flex-1 bg-border/50' />
</div>

<div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
  {/* Author, Epic */}
</div>
```

Uses only existing design tokens (`bg-border/50`, `text-muted-foreground/60`). No new dependencies.

### After (Option A)

```
IssuesLayoutClient
└── CollapsibleSection label="Filters"
      extraContent: [violet dot (when active), FilterPresetsPanel, IssueCreateButton]
      └── SharedFiltersBar
            ├── Row 1: Search input + Assignee dropdown
            ├── Row 2: TenantScopeFields (Organization + Team)
            ├── Row 3: Status dropdown
            └── Row 4: Author dropdown + Epic dropdown      ← plain div
```

The outer `CollapsibleSection label="Filters"` stays. Only the inner one is removed.

---

## Active State Indicator — Non-Negotiable

**Do not silently remove the violet dot without replacing it.** A user who filtered by Epic in a previous session (URL preserved) will see a filtered list with no hint why. This is a UX bug, not a UX simplification.

**Required:** Move the dot to the outer `CollapsibleSection`'s `extraContent` in `issues-layout-client.tsx`.

### Implementation in `issues-layout-client.tsx`

```tsx
// Derive active state from filters (add near other filter derivations)
const hasAdvancedFilters =
  filters.author_id.length > 0 || filters.epic_id.length > 0;

// In the outer CollapsibleSection extraContent:
extraContent={
  <div className='flex items-center gap-2'>
    {hasAdvancedFilters && (
      <span className='h-1.5 w-1.5 rounded-full bg-primary' />
    )}
    <FilterPresetsPanel
      currentFilters={filters}
      onApply={handleFiltersChange}
    />
    <IssueCreateButton />
  </div>
}
```

This is one addition to `issues-layout-client.tsx` — the plan was wrong to say that file needs no changes.

---

## Pre-existing Kanban Gap (Becomes More Visible)

`IssuesKanbanTab` does **not** forward `author_id` or `epic_id` to `fetchKanbanIssues` (`issues-kanban-tab.tsx:55–67`). After this refactor, those dropdowns are permanently visible, so users will set them and switch to Kanban expecting filtering — but the kanban board will silently ignore those values.

**This is a pre-existing bug, not introduced by this refactor.** It should be tracked as a follow-up issue but does not block this change. Add a code comment at the fetch call site so it is not forgotten.

---

## Files to Change

| File | Change |
|---|---|
| `features/issues/ui/shared-filters-bar.tsx` | Remove `CollapsibleSection` import (line 9), `hasAdvancedFilters` + `advancedIndicator` constants (lines 101–106), and the `<CollapsibleSection>` JSX wrapper (lines 174–201). Replace with plain `<div className='grid ...'>` row. Extract shared `persons.map()` into one intermediate array (see DRY fix below). Fix `useEffect` dep array (add `onChange`). |
| `features/issues/ui/issues-layout-client.tsx` | Add `hasAdvancedFilters` derivation and move the violet dot into the outer `CollapsibleSection`'s `extraContent`. |

No changes needed to:
- `filters-context.tsx` — state unchanged
- `entities/issue/model/types.ts` — `SharedFilters` interface unchanged
- `filter-presets-panel.tsx` — preset logic unchanged
- Tab components — they read from context, not from the bar

---

## Additional Code Improvements (Same PR)

### Fix 1 — Stale closure in search `useEffect`

**This bug pre-exists but must be fixed in the same diff** (ESLint `react-hooks/exhaustive-deps` will flag it after changes touch this file):

```tsx
// Current (buggy) — onChange missing from dep array
useEffect(() => {
  const timer = setTimeout(() => {
    onChange({ search: searchValue });
  }, 300);
  return () => { clearTimeout(timer); };
}, [searchValue]);

// Correct
useEffect(() => {
  const timer = setTimeout(() => {
    onChange({ search: searchValue });
  }, 300);
  return () => { clearTimeout(timer); };
}, [searchValue, onChange]);
```

`onChange` in `issues-layout-client.tsx` is already stabilised via `useCallback` (line 152), so adding it to the dep array is safe and will not cause the effect to fire on every render.

### Fix 2 — DRY: extract shared `persons.map()`

`personOptions` and `authorOptions` both `.map()` over the same `persons` prop with identical transform logic, differing only in the sentinel option:

```tsx
// Before — duplicated .map() body
const personOptions = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  ...persons.map((person) => ({
    value: String(person.id),
    label: person.email ? `${person.name} (${person.email})` : person.name,
  })),
];

const authorOptions = [
  { value: '', label: 'Any author' },
  ...persons.map((person) => ({
    value: String(person.id),
    label: person.email ? `${person.name} (${person.email})` : person.name,
  })),
];

// After — extract once
const mappedPersons = persons.map((person) => ({
  value: String(person.id),
  label: person.email ? `${person.name} (${person.email})` : person.name,
}));

const personOptions = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  ...mappedPersons,
];

const authorOptions = [{ value: '', label: 'Any author' }, ...mappedPersons];
```

React Compiler handles memoization automatically — no `useMemo` needed.

---

## Acceptance Criteria

- [x] The `/dashboard/issues` page shows a single flat filter area — no nested collapsible inside "Filters"
- [x] All 7 visible filter fields (Search, Assignee, Organization, Team, Status, Author, Epic) are accessible without an extra click
- [x] The outer "Filters" `CollapsibleSection` still collapses/expands all filters at once
- [x] `FilterPresetsPanel` and `IssueCreateButton` still appear in the outer header
- [x] A violet dot appears in the outer "Filters" header when `author_id` or `epic_id` is non-empty
- [x] Author and Epic dropdowns are styled identically to Status and Assignee dropdowns
- [x] Kanban tab behavior is unchanged from pre-refactor: `author_id`/`epic_id` remain in URL but are not forwarded to the kanban API (pre-existing limitation, tracked separately)
- [x] No regressions in filter URL sync (`author_id`, `epic_id` remain in search params)
- [x] Search debounce `useEffect` dep array includes `onChange`
- [x] `npm run lint` passes; no TypeScript errors
- [x] Dead import (`CollapsibleSection` in `shared-filters-bar.tsx`) is removed

---

## Implementation — Full Code Changes

### `features/issues/ui/shared-filters-bar.tsx`

**Step 1:** Remove from imports:
```tsx
// Delete this line:
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';
```

**Step 2:** Replace duplicated `.map()` with shared intermediate (lines 73–99):
```tsx
const mappedPersons = persons.map((person) => ({
  value: String(person.id),
  label: person.email ? `${person.name} (${person.email})` : person.name,
}));

const personOptions = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  ...mappedPersons,
];

const authorOptions = [{ value: '', label: 'Any author' }, ...mappedPersons];
```

**Step 3:** Delete lines 101–106 (hasAdvancedFilters + advancedIndicator).

**Step 4:** Fix `useEffect` dep array (line 71):
```tsx
}, [searchValue, onChange]);
```

**Step 5:** Replace the `<CollapsibleSection>` block (lines 174–201) with:
```tsx
<div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
  <InputDropdown
    label='Author'
    options={authorOptions}
    value={filters.author_id}
    onChange={(value) => {
      onChange({ author_id: value as string });
    }}
    searchable
    disabled={disabled}
  />
  <InputDropdown
    label='Epic'
    options={epicOptions}
    value={filters.epic_id}
    onChange={(value) => {
      onChange({ epic_id: value as string });
    }}
    searchable
    disabled={disabled}
  />
</div>
```

### `features/issues/ui/issues-layout-client.tsx`

Add `hasAdvancedFilters` derivation and dot to the outer collapsible's `extraContent` (around line 219):

```tsx
const hasAdvancedFilters =
  filters.author_id.length > 0 || filters.epic_id.length > 0;

// In the outer CollapsibleSection:
extraContent={
  <div className='flex items-center gap-2'>
    {hasAdvancedFilters && (
      <span className='h-1.5 w-1.5 rounded-full bg-primary' />
    )}
    <FilterPresetsPanel
      currentFilters={filters}
      onApply={handleFiltersChange}
    />
    <IssueCreateButton />
  </div>
}
```

---

## Non-Goals

- Reordering or reorganising filter fields — keep the existing row order
- Adding new filter fields
- Changing the outer `CollapsibleSection` or its `defaultOpen` behaviour
- Migrating filter state to `nuqs` (tracked in a separate plan)
- Fixing the kanban `author_id`/`epic_id` forwarding gap (tracked separately)

---

## Effort Estimate

**~30 minutes.** Two files. ~25 lines deleted, ~20 added. The stale closure fix and DRY cleanup add a few lines but are trivially mechanical.
