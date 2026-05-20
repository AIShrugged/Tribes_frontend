---
status: pending
priority: p2
issue_id: '018'
tags: [code-review, filter-merge, kanban, ux-regression, issues]
dependencies: []
---

# Kanban tab silently ignores `author_id` and `epic_id` filters — becomes visible after merge

## Problem Statement

`IssuesKanbanTab` does not forward `author_id` or `epic_id` to `fetchKanbanIssues` (`issues-kanban-tab.tsx:55–67`). After the filter merge refactor, Author and Epic dropdowns are **always visible** in the filter bar (no longer hidden inside a collapsed section). Users will set those filters and switch to the Kanban tab expecting the board to update — but it silently ignores both values, showing unfiltered results.

This is a **pre-existing bug** but the filter merge makes it significantly more user-visible.

## Findings

`issues-kanban-tab.tsx` lines 55–67 — the `fetchKanbanIssues` call currently passes:
- `organization_id`
- `team_id`
- `type`
- `assignee_id`
- `unassigned`
- `search`

**Missing:** `author_id`, `epic_id`

Before the filter merge, these fields were hidden behind "Advanced filters" which was closed by default — most users never saw them. After the merge, they are row 4 of every filter panel, always visible on both List and Kanban tabs. The UX contract implied by the UI (all filters apply everywhere) is now broken.

## Proposed Solution

### Option A — Forward `author_id` and `epic_id` to the kanban API (Recommended if backend supports it)

**Step 1:** Check backend support — read `/Users/slavapopov/Documents/WandaAsk_backend/routes/api.php` for the kanban endpoint and the corresponding `FormRequest` to confirm `author_id` and `epic_id` are accepted query params.

**Step 2 (if supported):** Add the two fields to the fetch call in `issues-kanban-tab.tsx`:

```ts
const data = await fetchKanbanIssues({
  organization_id: filters.organization_id,
  team_id: filters.team_id,
  type: filters.type,
  assignee_id: filters.assignee_id === 'unassigned' ? '' : filters.assignee_id,
  unassigned: filters.assignee_id === 'unassigned',
  search: filters.search,
  author_id: filters.author_id,   // add
  epic_id: filters.epic_id,        // add
});
```

**Pros:** Fixes the bug, consistent UX across both tabs.
**Cons:** Requires backend to already support these params. Needs validation.
**Effort:** Small (2 lines if backend supports it; medium if backend needs updating).
**Risk:** Low if backend accepts the params; filters degrade gracefully if ignored.

### Option B — Add a visual hint on the Kanban tab that Author/Epic are not applied (fallback)

If backend does not support these params, add a tooltip or caption:

```tsx
<InputDropdown
  label='Author'
  // ...
  hint='Applies to list view only'  // if InputDropdown supports hint prop
/>
```

Or render a `(list only)` annotation next to the field labels when on the kanban tab.

**Pros:** Honest UX — no silent filtering mismatch.
**Cons:** Adds complexity, still doesn't fix the underlying limitation.
**Effort:** Small–medium.
**Risk:** Low.

### Option C — Disable Author/Epic on Kanban tab

Pass a `disabledFields: ['author_id', 'epic_id']` prop to `SharedFiltersBar` when on the kanban tab and visually grey out those fields.

**Pros:** Clear signal that these filters don't apply.
**Cons:** Requires new prop on `SharedFiltersBar`, expands scope.
**Effort:** Medium.
**Risk:** Low.

## Recommended Action

**Option A first** — check backend support (5 min) before doing anything else. If `/api/v1/issues/kanban` already accepts `author_id`/`epic_id` query params, Option A is a 2-line fix. Only fall back to B or C if the backend doesn't support them.

## Technical Details

- **Affected file:** `features/issues/ui/issues-kanban-tab.tsx` (lines 55–67)
- **Backend to check:** `/Users/slavapopov/Documents/WandaAsk_backend/routes/api.php` → kanban endpoint → FormRequest
- **Related:** `features/issues/api/kanban.ts` — `fetchKanbanIssues` function signature

## Acceptance Criteria

- [ ] Setting `author_id` filter and switching to Kanban tab produces filtered results (if Option A)
- [ ] OR: Author/Epic dropdowns show a clear indication they don't apply to Kanban (if Option B/C)
- [ ] No silent filtering mismatch between what the UI controls imply and what the API receives

## Work Log

- 2026-05-20: Found during architecture review of filter merge plan. Pre-existing bug; becomes user-visible after merge.
