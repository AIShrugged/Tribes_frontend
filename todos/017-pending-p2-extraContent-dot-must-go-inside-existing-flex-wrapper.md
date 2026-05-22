---
status: pending
priority: p2
issue_id: '017'
tags: [code-review, filter-merge, issues, regression-risk]
dependencies: []
---

# Violet dot must be inserted inside existing `extraContent` wrapper, not re-wrapped

## Problem Statement

The plan proposes adding the active-filter violet dot to the outer
`CollapsibleSection`'s `extraContent` in `issues-layout-client.tsx`. However,
the existing `extraContent` is already a
`<div className='flex items-center gap-2'>` that wraps `FilterPresetsPanel` and
`IssueCreateButton`. If the implementation naively assigns a new JSX tree to
`extraContent`, it will silently **discard** `FilterPresetsPanel` and
`IssueCreateButton`.

## Findings

Current `extraContent` in `issues-layout-client.tsx` (lines 226–234):

```tsx
extraContent={
  <div className='flex items-center gap-2'>
    <FilterPresetsPanel currentFilters={filters} onApply={handleFiltersChange} />
    <IssueCreateButton />
  </div>
}
```

The plan's proposed implementation section correctly shows the dot inserted
**inside** the existing div, but the overview section describes it ambiguously
as adding "a `<div className='flex items-center gap-2'>` wrapper around the
dot + existing buttons" — which could be read as adding a second wrapper.

Confirmed by pattern-recognition-specialist: `CollapsibleSection` renders
`{extraContent}` directly after the toggle button (collapsible-section.tsx:46),
so the outer wrapper must remain a single flat flex row.

## Proposed Solution

### Option A — Insert dot as first sibling inside existing div (Recommended)

```tsx
extraContent={
  <div className='flex items-center gap-2'>
    {hasAdvancedFilters && (
      <span className='h-1.5 w-1.5 rounded-full bg-primary' />
    )}
    <FilterPresetsPanel currentFilters={filters} onApply={handleFiltersChange} />
    <IssueCreateButton />
  </div>
}
```

**Pros:** No extra nesting, consistent with existing flex layout,
`FilterPresetsPanel` and `IssueCreateButton` are preserved. **Cons:** None.
**Effort:** Trivial — one span element added inside the existing div. **Risk:**
None.

### Option B — Extract `extraContent` to a local variable first

```tsx
const filtersHeaderExtra = (
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
);
// Then: extraContent={filtersHeaderExtra}
```

**Pros:** Easier to read long JSX. **Cons:** Slightly more verbose. React
Compiler handles memoization, so no perf difference. **Effort:** Trivial.
**Risk:** None.

## Recommended Action

Use **Option A** — insert the dot inside the existing div inline. Simple and
consistent with how `extraContent` is used throughout the codebase.

## Technical Details

- **Affected file:** `features/issues/ui/issues-layout-client.tsx` (lines
  226–234)
- **Risk if done wrong:** `FilterPresetsPanel` (saved filter presets) and
  `IssueCreateButton` disappear from the UI silently

## Acceptance Criteria

- [ ] The outer "Filters" header shows the violet dot when `author_id` or
      `epic_id` is non-empty
- [ ] `FilterPresetsPanel` ("Saved" button) is still visible in the header
- [ ] `IssueCreateButton` is still visible in the header
- [ ] The three elements are in a single `flex items-center gap-2` row (no
      nested wrapper)

## Work Log

- 2026-05-20: Found during multi-agent technical review of the filter merge
  plan.
