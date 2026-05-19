---
title: feat: Epic/Task toggle for Kanban & List + child task binding in Epic form
type: feat
status: active
date: 2026-05-19
deepened: 2026-05-19
---

# Epic/Task Toggle for Kanban & List + Child Task Binding in Epic Form

## Enhancement Summary

**Deepened on:** 2026-05-19 **Agents used:** wanda-backend-navigator,
best-practices-researcher, kieran-typescript-reviewer, architecture-strategist,
performance-oracle, security-sentinel, code-simplicity-reviewer,
julik-frontend-races-reviewer

### Key Discoveries (Change the Entire Plan)

1. **`child_issue_ids` does not exist in the backend** — The parent-child
   relationship is child-side only. `epic_id` is set on child issues, not pushed
   from the parent epic. Bulk child assignment requires either per-child PATCH
   calls or a new backend endpoint.
2. **`exclude_type` filter does not exist** — The backend `type` filter is
   equality-only. "Tasks" mode (excluding epics) cannot be done server-side
   today. Options: client-side filter, or restrict toggle to "All | Epics".
3. **`MultiSelectDropdown` does not exist** — Use existing `InputDropdown` with
   `multiple={true}`.
4. **`EpicTaskToggle` in `shared/ui/` is an FSD violation** — Domain-specific
   components belong in `features/issues/ui/`.
5. **Two pre-existing race conditions** in `issues-page.tsx` that must not be
   worsened: missing cancellation in `showArchived` effect (HIGH), and
   duplicate-append race in `handleLoadMoreArchived` (HIGH).

---

## Readiness Assessment

### What is ALREADY implemented ✅

#### 1. Epic field in task create/edit form (`issue-form.tsx`)

- `epic_id` field is present in `IssueFormValues` (line 58)
- Default value is set from `issue.epic_id` (line 134)
- Payload sends `epic_id: values.epic_id === '' ? null : Number(values.epic_id)`
  — supports detach via `null` (line 201)
- A searchable dropdown is rendered when `type !== 'epic'` AND
  `epics.length > 0` (line 331–347) — autocomplete with team epics is working
- `getEpics()` server action exists in `features/issues/api/issues.ts:361`
- Pages `/dashboard/issues/create` and `/dashboard/issues/[id]` already pass
  `epics` prop to `<IssueForm>`

**Status: Feature 1 is FULLY implemented for tasks. The confirmed gap: when
`type === 'epic'`, there is no field to bind child tasks.**

#### 2. Kanban board with drag-n-drop (`kanban-board.tsx`)

- `KanbanBoard` with full HTML5 drag-n-drop, optimistic updates, rollback on
  failure
- Columns: `open` (To Do), `in_progress`, `review`, `paused`, `reopen`, `done`
- `moveKanbanCard` server action persists status changes

**Status: Kanban drag-n-drop is FULLY implemented.**

#### 3. List view with sorting and search (`issues-page.tsx`)

- Infinite-scroll table, sortable columns, shared search bar with debounce
- Epic badge already rendered in the issue row (line 588–602)

**Status: List view is FULLY implemented.**

---

### What is MISSING ❌

| Feature                                              | Status     | Backend constraint                                                |
| ---------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| epic_id field in task create/edit                    | ✅ Done    | —                                                                 |
| Epic autocomplete dropdown in task form              | ✅ Done    | —                                                                 |
| Detach epic (set to null)                            | ✅ Done    | —                                                                 |
| Kanban drag-n-drop                                   | ✅ Done    | —                                                                 |
| Kanban columns (To Do / In Progress / Review / Done) | ✅ Done    | —                                                                 |
| List view sorting by date/priority                   | ✅ Done    | —                                                                 |
| List view search by title/description                | ✅ Done    | —                                                                 |
| **Epic form: bind child tasks at creation**          | ❌ Missing | Backend has no `child_issue_ids` — needs per-child PATCH          |
| **Kanban toggle: Epics / Tasks**                     | ❌ Missing | No `exclude_type` filter — "Tasks" must be client-side or omitted |
| **List toggle: Epics / Tasks**                       | ❌ Missing | Same backend constraint                                           |

**Overall Readiness: ~60% complete**

---

## Backend Contract (Verified)

### Confirmed facts from `IssueRequest.php`, `IssueController.php`, `IssueResource.php`

**Child task binding:**

- `child_issue_ids` **does not exist** as a field in store/update rules
- The relationship is modeled child-side: child issue has `epic_id` pointing to
  parent
- `epic_id` validation on child: `nullable|integer|exists:issues,id,type,epic` —
  must be an existing epic
- `epic_id` is **prohibited** when the issue being created/updated is itself an
  epic
- **To link tasks to an epic at creation time**: create the epic first, then
  PATCH each child with `epic_id = <newEpicId>`

**Type filtering:**

- `type` filter is equality-only: `WHERE type = ?`
- **No `exclude_type`, `not_type`, or negation** support exists
- Valid canonical types: `development`, `organization`, `epic`
- Legacy type normalization: `frontend`/`backend`/`bug` → `development`, `task`
  → `organization`

**`child_issues` in response:**

- Only present in `show` (detail) response — NOT in list responses
- Loaded only when `childIssues` relation is eager-loaded (only in
  `IssueController::show`)
- Shape: recursive `IssueResource[]` — same structure as parent

**`epic` field in IssueResource:**

```typescript
epic?: {
  id: number;
  name: string;
  status: IssueStatus;
} | null;  // whenLoaded — only when `with=['epic']` is eager-loaded
```

---

## Implementation Plan (Revised)

### Step 1 — Epic form: child task binding via post-creation PATCH

Since the backend has no `child_issue_ids`, the UI flow must be:

1. User creates epic, selects child tasks in the form
2. Form submits `createIssue(epicPayload)` → receives `epic.id`
3. For each selected child task ID, call
   `updateIssue(childId, { ..., epic_id: epic.id })`
4. Navigate to the new epic's detail page

**Files to change:**

```
features/issues/ui/issue-form.tsx          # Add child task multi-select when type === 'epic'
features/issues/api/issues.ts              # Add getTasks() or reuse getEpics() pattern
```

**DO NOT add to `IssueUpsertDTO`** — the field does not exist in the backend.

**UI pattern** (using existing `InputDropdown` with `multiple`):

```tsx
// features/issues/ui/issue-form.tsx
// Add to IssueFormValues:
interface IssueFormValues {
  // ... existing fields ...
  child_issue_ids: number[];  // number[] not string[] — avoids type-lie, matches DTO
}

// Add to defaultValues:
child_issue_ids: issue?.child_issues?.map(c => c.id) ?? [],

// In JSX, after TenantScopeFields, when type === 'epic':
const watchedType = useWatch({ control, name: 'type' });      // useWatch NOT watch()
const watchedChildren = useWatch({ control, name: 'child_issue_ids' });

{watchedType === 'epic' && (
  <InputDropdown
    label='Child Tasks'
    options={tasks.map(t => ({ value: String(t.id), label: `#${t.id} ${t.name}` }))}
    value={watchedChildren.map(String)}   // InputDropdown accepts string[]
    multiple
    onChange={(values) => {
      const ids = (values as string[]).map(Number).filter(n => !Number.isNaN(n));
      setValue('child_issue_ids', ids, { shouldDirty: true });
    }}
    searchable
  />
)}
```

**CRITICAL: use `useWatch` not `watch()`** — `watch()` subscriptions in JSX
cause the entire form to re-render on every keystroke in any field.
`useWatch({ control, name: 'field' })` creates a field-scoped subscription.

**Submit handler changes:**

```typescript
// In startTransition(async () => { ... }) after createIssue succeeds:
if (!issue) {
  // Create epic first
  const result = await createIssue(epicPayload);
  if (result.error !== null) { ... return; }

  const epicId = result.data.id;

  // Link child tasks via individual PATCH calls
  const childIds = values.child_issue_ids;
  if (childIds.length > 0) {
    await Promise.all(
      childIds.map(childId =>
        updateIssue(childId, {
          // Must pass full payload — backend requires all fields
          // Fetch child issue data first OR require tasks prop to include full Issue objects
          epic_id: epicId,
          // ... other required fields
        })
      )
    );
  }

  isSubmittedRef.current = true;
  router.push(`${ROUTES.DASHBOARD.ISSUES}/${epicId}`);
}
```

**Problem with full-payload PATCH:** `updateIssue` requires the full
`IssueUpsertDTO`. The tasks multi-select only stores IDs — full issue objects
are needed to PATCH without overwriting other fields. **Two options:**

- **Option A (recommended):** Change `tasks` prop from `{ id, name }[]` to
  `Issue[]` (full objects) — pass the full task objects from the page so the
  form has everything needed for the PATCH
- **Option B:** Add a `setEpicId(epicId, childId)` server action that does a
  minimal update (requires a new, smaller backend endpoint)

**For the edit form (`issue` exists):** Existing `child_issues` from the detail
response (which DOES include `childIssues`) must be initialized in
`defaultValues.child_issue_ids`. On save, diff against current state and PATCH
added/removed children.

**Page changes:**

```typescript
// app/dashboard/issues/(create)/create/page.tsx
// Fetch tasks (non-epic issues) to pass to form
const tasks = await getIssuesByType({ type: 'development', organizationId, limit: 300 });
// ...
<IssueForm tasks={tasks} ... />

// Same for app/dashboard/issues/[id]/page.tsx
```

**New `getIssuesByType` function** (do NOT create a `getTasks()` duplicate):

```typescript
// features/issues/api/issues.ts
// Replace the pattern: getEpics() is `buildIssuesQuery({ type: 'epic', limit: 100 })`
// Add a generalized version:
export async function getIssuesByType(params: {
  type: string;
  organizationId?: number | null;
  limit?: number;
}): Promise<Issue[]> {
  try {
    const query = buildIssuesQuery({
      type: params.type,
      organization_id: params.organizationId ?? null,
      limit: params.limit ?? 300,
      offset: 0,
      exclude_archived: true,
    });
    const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);
    return result.data;
  } catch {
    return [];
  }
}
```

Cap at 300 items. If result is truncated, show a notice in the dropdown:
"Showing first 300 tasks. Use search to find more."

---

### Step 2 — Epic/Task toggle component

**Location: `features/issues/ui/issue-type-toggle.tsx`** (NOT `shared/ui/` — FSD
violation)

```typescript
// features/issues/ui/issue-type-toggle.tsx
'use client';

import { useCallback } from 'react';

// Do NOT create a ViewMode alias type — use SharedFilters.type directly
// Toggle maps: 'epic' → show epics only, '' → show all
// 'Tasks' mode maps to '' (all) until backend supports exclude_type

interface IssueTypeToggleProps {
  value: string;  // '' | 'epic' — same as SharedFilters.type
  onChange: (patch: Partial<{ type: string }>) => void;  // matches SharedFiltersBar pattern
}

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'epic', label: 'Epics' },
] as const;

export function IssueTypeToggle({ value, onChange }: IssueTypeToggleProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % OPTIONS.length;
      onChange({ type: OPTIONS[next].value });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index - 1 + OPTIONS.length) % OPTIONS.length;
      onChange({ type: OPTIONS[next].value });
    }
  }, [onChange]);

  return (
    <div
      role="radiogroup"
      aria-label="Issue type filter"
      className="inline-flex rounded-[var(--radius-button)] bg-[var(--surface-2)] p-[3px] gap-0.5"
    >
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          onClick={() => onChange({ type: opt.value })}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={[
            'rounded-[calc(var(--radius-button)-3px)] px-3 py-1.5 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

**Why no "Tasks" option:** The backend has no `exclude_type` parameter. Setting
`type = 'task'` would only work for orgs using exactly `'task'` as a type key —
not guaranteed. The simplest correct implementation is "All | Epics". If a
"Tasks" mode is needed later, add an `exclude_epics: boolean` to `SharedFilters`
and filter client-side in `filteredColumns` (kanban already does client-side
filtering) and in `issues-page.tsx`.

**ARIA requirements:**

- `role="radiogroup"` on the container (not Tabs — this filters same content,
  not navigates)
- `role="radio"` + `aria-checked` on each button
- Roving tabindex: active button has `tabIndex={0}`, others have `tabIndex={-1}`
- Arrow key navigation (ArrowLeft/Right/Up/Down)

---

### Step 3 — Wire toggle into Kanban tab

The toggle calls `handleFiltersChange({ type: 'epic' })` or
`handleFiltersChange({ type: '' })` via `FiltersContext`. This already
propagates to `IssuesKanbanTab` → `fetchKanbanIssues` → `setColumns`.

**Files to change:**

```
features/issues/ui/issues-kanban-tab.tsx    # Add IssueTypeToggle above KanbanBoard
```

```tsx
// features/issues/ui/issues-kanban-tab.tsx
import { IssueTypeToggle } from '@/features/issues/ui/issue-type-toggle';

// Inside IssuesKanbanTab render, before <KanbanBoard>:
const { filters, filtersVersion, columnsVersion, setShowArchived, handleFiltersChange } = useFiltersContext();

// (handleFiltersChange must be added to FiltersContextValue — see below)

return (
  <>
    <div className='flex items-center gap-3 px-2 py-2'>
      <IssueTypeToggle
        value={filters.type}
        onChange={handleFiltersChange}
      />
      {isTruncated && (
        <div className='...'>Some issues are not shown...</div>
      )}
    </div>
    <KanbanBoard ... />
  </>
);
```

**`FiltersContextValue` must expose `handleFiltersChange`** (currently it only
exposes `setShowArchived` and `bumpColumnsVersion`):

```typescript
// features/issues/model/filters-context.tsx
export interface FiltersContextValue {
  // ... existing fields ...
  handleFiltersChange: (patch: Partial<SharedFilters>) => void; // ADD THIS
}
```

Alternatively, the toggle can call `onChange` from a prop passed down from
`IssuesLayoutClient` rather than reading from context — keeping context surface
area minimal. Both are valid; the context approach is more consistent with
`SharedFiltersBar`.

---

### Step 4 — Wire toggle into List tab

Same pattern in `features/issues/ui/issues-list-tab.tsx`:

```tsx
import { IssueTypeToggle } from '@/features/issues/ui/issue-type-toggle';

export function IssuesListTab(...) {
  const { filters, filtersVersion, ... handleFiltersChange } = useFiltersContext();

  return (
    <div className='flex flex-col gap-4'>
      <div className='px-2'>
        <IssueTypeToggle value={filters.type} onChange={handleFiltersChange} />
      </div>
      <IssuesPage ... />
    </div>
  );
}
```

**Toggle state persists in URL** automatically because `IssuesLayoutClient`
already syncs `filters.type` to `?type=` in the URL and reads it back on mount.
The toggle is a view into existing state — no new URL param needed.

**Tab-switch persistence:** `PageTabsNav` with `preserveSearchParams` (already
used in the issues section) ensures `?type=epic` survives when the user switches
between List and Kanban tabs.

---

### Step 5 — Epic badge on Kanban cards (optional)

`KanbanCard` type currently lacks `epic_id`/`epic`. The
`IssueController::index()` eager-loads `['assignee', 'issueType', 'epic']` — so
`epic` IS returned in the list response. The frontend just doesn't use it.

**TypeScript change:**

```typescript
// features/kanban/model/types.ts
// Move EpicOption to entities/issue/model/types.ts first (it's shared domain type)
// Then:
import type { EpicOption } from '@/entities/issue'; // NOT from features/issues

export interface KanbanCard {
  // ... existing fields ...
  epic_id: number | null; // ADD
  epic?: EpicOption | null; // ADD — use EpicOption from entities/issue
}
```

**FSD note:** `EpicOption` must be moved from `features/issues/model/types.ts`
to `entities/issue/model/types.ts` and re-exported from
`entities/issue/index.ts` to avoid a cross-feature import (`features/kanban` →
`features/issues`).

**Render change in `kanban-card-item.tsx`:**

```tsx
{
  card.epic_id && (
    <span className='text-xs text-violet-400 truncate max-w-[140px]'>
      {card.epic?.name ? `Epic: ${card.epic.name}` : `Epic #${card.epic_id}`}
    </span>
  );
}
```

---

## Acceptance Criteria

### Feature 1 — Child task binding in epic form

- [ ] When creating/editing an issue of type `epic`, a searchable multi-select
      of non-epic issues appears
- [ ] Selected tasks are linked after epic creation via individual PATCH calls
      (`epic_id = newEpicId`)
- [ ] In edit mode, existing `child_issues` are pre-selected in the dropdown
- [ ] Deselecting tasks sends PATCH with `epic_id: null` on the removed children
- [ ] `epic-child-issues.tsx` renders correctly after save (triggers
      `router.refresh()`)
- [ ] Task list is capped at 300 items with a truncation notice

### Feature 2 — Kanban Epic/Task toggle

- [ ] Toggle "All | Epics" appears above the Kanban board
- [ ] "All" shows all issue types (default, `type: ''`)
- [ ] "Epics" shows only `type: 'epic'` issues
- [ ] Toggle state persists in URL as `?type=epic`
- [ ] Toggle state survives tab switches (via `preserveSearchParams`)
- [ ] Drag-n-drop continues to work in Epics mode
- [ ] `role="radiogroup"` with proper `aria-checked` and roving tabindex

### Feature 3 — List Epic/Task toggle

- [ ] Same "All | Epics" toggle appears above the list table
- [ ] Toggle filters correctly, sortable columns remain functional
- [ ] Epic badge shown in rows ✅ (already done)

---

## Dependencies & Risks

### Risk 1 — Per-child PATCH for linking (HIGH)

Linking N tasks to an epic requires N+1 API calls (1 create + N patches). For 20
selected tasks that's 21 sequential/parallel requests. **Mitigation:** Run PATCH
calls in parallel with `Promise.all`. Add a loading state while they complete.
Show partial success toast if some fail.

### Risk 2 — PATCH requires full payload (MEDIUM)

`updateIssue` sends the full `IssueUpsertDTO`. To update only `epic_id`, the
form needs all other field values for each child. **Mitigation:** Use `Issue[]`
(full objects) as the `tasks` prop, not `{ id, name }[]`. Or request a backend
endpoint that accepts partial update (PATCH with only `epic_id`).

### Risk 3 — "Tasks" toggle mode not feasible without backend change (MEDIUM)

Current implementation shows "All | Epics". If "Tasks" (exclude epics) is
required:

- Add `exclude_epics: boolean` to `SharedFilters`
- In `filteredColumns` (kanban, already client-side): add
  `if (filters.exclude_epics && card.type === 'epic') continue;`
- In `IssuesPage` (list): filter `items` client-side — only viable if result set
  is small. For large sets, a backend `exclude_type` parameter must be added.

### Risk 4 — `watch()` vs `useWatch()` in `issue-form.tsx` (MEDIUM — pre-existing)

The form currently uses `watch()` inline 14 times (lines 254–399). Every call
causes full form re-renders. **The new `child_issue_ids` field MUST use
`useWatch`**, not `watch()`. The existing `watch()` calls are a pre-existing
issue; fixing them all is out of scope but the new field must not make it worse.

### Risk 5 — `EpicOption` FSD placement (LOW)

Currently in `features/issues/model/types.ts`. Used by both `features/kanban`
and `features/issues`. Must be moved to `entities/issue/model/types.ts` before
adding to `KanbanCard`.

---

## Pre-Existing Bugs to Not Worsen

These race conditions exist today in `issues-page.tsx` and must not be worsened
by the new filter toggle:

### Bug 1 — HIGH: `showArchived` effect has no cancellation token

`features/issues/ui/issues-page.tsx:286–312` — the `showArchived` effect calls
`loadArchivedChunk` but has no `cancelled` flag. Stale archived items from a
previous filter can overwrite fresh ones when the user toggles archived AND
changes filter simultaneously.

### Bug 2 — HIGH: `handleLoadMoreArchived` double-invoke race

`features/issues/ui/issues-page.tsx:314–339` — the `archivedLoading` boolean
state guard races itself. Two concurrent calls can both pass the guard before
the first `setArchivedLoading(true)` flushes, causing duplicate rows. Fix: use a
`archivedLoadingRef.current` ref instead of state.

The new Epic/Task toggle bumps `filtersVersion`, which triggers both effects.
This increases the surface area of these bugs. Fix them before or alongside this
feature.

---

## Performance Considerations

### Multi-select task dropdown

- Cap server-side fetch at 300 items (`limit: 300`)
- `InputDropdown` already does client-side filter on `searchQuery` — memoize
  with `useMemo([options, searchQuery])`
- Do NOT call `watch('child_issue_ids')` in JSX — use
  `useWatch({ control, name: 'child_issue_ids' })` to isolate re-renders
- Isolate the child-tasks dropdown into its own sub-component
  (`ChildIssuesSelect`) so its internal search state doesn't re-render the full
  form

### Kanban toggle refetch

- On toggle, `filtersVersion` bumps → `useEffect` in `IssuesKanbanTab` fires →
  `fetchKanbanIssues` called
- Add `AbortController` to cancel in-flight kanban requests when a new toggle
  fires:

```typescript
useEffect(() => {
  if (isFirstRender.current) { ... return; }
  const controller = new AbortController();
  let cancelled = false;

  const run = async () => {
    const result = await fetchKanbanIssues(filters, controller.signal);
    if (cancelled) return;
    if (!result.error && result.data) {
      setColumns(result.data.columns);
    }
  };

  void run();
  return () => {
    cancelled = true;
    controller.abort();
  };
}, [filtersVersion, columnsVersion]);
```

- Add `isLoading` overlay on `KanbanBoard` during refetch (translucent overlay +
  pointer-events-none) to prevent interaction with stale-type cards

### `usePathname` + `useSearchParams` in `KanbanCardItem`

Pre-existing issue: each card calls `usePathname()` and `useSearchParams()`,
creating N active subscriptions. Move `backHref` computation to `KanbanBoard` or
`KanbanColumn` and pass as prop. This allows `memo` to work correctly and
eliminates N subscriptions on URL change.

---

## Security Checklist

Before shipping:

- [ ] Validate `child_issue_ids` with Zod before sending to backend:
      `z.array(z.number().int().positive()).max(100)`
- [ ] Confirm backend validates that each child task ID belongs to the same org
      as the epic (IDOR risk)
- [ ] Apply `Number.isInteger(n) && n > 0` guard to all URL param → number
      coercions in page files (existing gap in `organization_id`, `team_id`
      coercions)
- [ ] Cap `isIssueType` length check: `value.length > 0 && value.length <= 100`
- [ ] No XSS risk: `InputDropdown` renders option labels as React text nodes
      (escaped by default) ✅

---

## Implementation Sequence (Recommended)

1. **Fix pre-existing race conditions** in `issues-page.tsx` (bugs 1 & 2 above)
   — de-risks the filter toggle
2. **Move `EpicOption` to `entities/issue/model/types.ts`** — unblocks kanban
   badge and prevents FSD violations
3. **Add `IssueTypeToggle` component**
   (`features/issues/ui/issue-type-toggle.tsx`) — quick win, zero backend
   dependency
4. **Wire toggle into Kanban tab** — add to `IssuesKanbanTab`, expose
   `handleFiltersChange` in context
5. **Wire toggle into List tab** — add to `IssuesListTab`
6. **Add epic badge to `KanbanCard`** — extend type, render badge
7. **Add `getIssuesByType()`** — generalize `getEpics()` pattern
8. **Add child task multi-select to epic form** — using `useWatch`,
   `InputDropdown multiple`, `ChildIssuesSelect` sub-component
9. **Implement post-creation child linking** — `Promise.all` PATCH calls after
   `createIssue`
10. **Add security validations** — Zod on `child_issue_ids`, length caps on
    type/search params

---

## References

- `features/issues/ui/issue-form.tsx:331` — current epic dropdown condition
  (type !== 'epic')
- `features/issues/api/issues.ts:361` — `getEpics()` — model for
  `getIssuesByType()`
- `features/kanban/model/types.ts:50` — `KANBAN_COLUMNS` definition
- `entities/issue/model/types.ts:15` — `SharedFilters` (home for `issueTypeView`
  or toggle derives from `type`)
- `features/issues/ui/issues-layout-client.tsx:152` — `handleFiltersChange`
  (must be exposed in context)
- `features/issues/ui/epic-child-issues.tsx` — existing child issue renderer on
  detail page
- `features/issues/ui/issues-page.tsx:286` — **pre-existing race condition** in
  `showArchived` effect
- `features/issues/ui/issues-page.tsx:314` — **pre-existing race condition** in
  `handleLoadMoreArchived`
- `shared/ui/input/InputDropdown.tsx` — supports `multiple={true}` — use this,
  not a new component
- `WandaAsk_backend/app/Http/Requests/API/v1/IssueRequest.php` — confirmed: no
  `child_issue_ids`, no `exclude_type`
- `WandaAsk_backend/app/Http/Resources/API/v1/IssueResource.php` — `epic` is
  nested object `{id, name, status}`, not flat string
