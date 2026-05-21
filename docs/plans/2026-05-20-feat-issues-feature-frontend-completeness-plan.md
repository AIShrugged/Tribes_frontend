---
title: 'feat: Issues Feature Frontend Completeness'
type: feat
status: completed
date: 2026-05-20
---

# feat: Issues Feature Frontend Completeness

## Enhancement Summary

**Deepened on:** 2026-05-20 **Research agents used:** best-practices-researcher,
framework-docs-researcher, kieran-typescript-reviewer, security-sentinel,
performance-oracle, julik-frontend-races-reviewer, architecture-strategist,
code-simplicity-reviewer, fsd-boundary-guard, pattern-recognition-specialist,
design-guardian, unit-test-booster

### Key Improvements Added

1. **`nuqs` library** recommended for URL-synced filter state — replaces manual
   `router.replace` + `useSearchParams` with typed parsers, Suspense-safe,
   automatic batching
2. **Three critical race conditions** identified and fixed: epic fetch
   cancellation on rapid org-change, synchronous `epic_id` reset before
   filtersVersion bump, stale `updateUrl` closure in `useEffect` deps
3. **YAGNI simplifications**: removed `useFilterPresets` hook (inline into
   component), removed `FilterPreset.createdAt`, deferred Phase 3 date range to
   a separate plan, replaced epic `useEffect` reload with SSR prop pattern
4. **FSD violations** caught: `DoDItem` moved from `entities/` to
   `features/issues/`, `IssueAuditEvent` import path corrected, epic reload
   useEffect removed
5. **`useFieldArray`** now recommended for DoD checklist (contradicts existing
   pattern, but justified by Enter/Backspace keyboard UX requirements)
6. **Design system specifics**: `bg-card + border-white/8` for toggle active
   state, 6px progress bar with `bg-accent`/`bg-primary` color switch, popover
   for presets panel, nested `CollapsibleSection` for advanced filters
7. **Security**: `Number()` NaN guard missing on filter URL params — existing
   bug, fix now; Zod validation on localStorage preset shapes required
8. **Audit log** must be wrapped in `<Suspense>` streaming — not added to
   `Promise.all` in detail page

### New Critical Findings

- `'task'` sentinel is invalid for backend — must send `exclude_type=epic`;
  **confirm backend FormRequest accepts this param before writing frontend
  branch**
- `searchParams` in Next.js 15/16 is a `Promise` — must `await searchParams` in
  Server Component pages
- `useFilterPresets` lazy `useState` initializer with `localStorage` crashes on
  SSR — use `useEffect` hydration instead
- `IssueTypeToggle` `ToggleValue` type must stay derived from `OPTIONS` const —
  do not declare a separate union type

---

## Overview

The audit of the "issues" feature identified **7 gaps** between the current
implementation and the product specification. This plan covers all
frontend-implementable improvements, grouped by dependency risk. Features
blocked on backend endpoints are called out explicitly so they can be
parallelised with backend work.

**Scope:**

1. "Tasks" option in `IssueTypeToggle`
2. Author filter in `SharedFiltersBar`
3. Epic filter in `SharedFiltersBar`
4. Definition of Done (DoD) checklist field in the issue form
5. Audit log timeline on the issue detail page
6. Saved filter presets (localStorage-first)

> **Deferred from original scope:** Date range filter (Phase 3) — fully blocked
> on backend; deferred to a separate plan once backend param names are
> confirmed. Do not add `due_date_from/to`, `created_from/to` to `SharedFilters`
> in this PR.

---

## Backend Dependency Map

> These backend changes must land **before** the corresponding frontend slice
> can be completed. Frontend types, schemas, and UI stubs can be built in
> advance.

| Frontend Feature             | Backend Prerequisite                                                                                                                | Status       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| "Tasks" toggle               | `exclude_type=epic` query param in `IssueRequest::getIndexFilters` (NOT `type=task` — that value is rejected by backend validation) | ❌ Not built |
| Author filter                | `user_id` filter in `IssueController::index` + `IssueRequest` validation                                                            | ❌ Not built |
| DoD field                    | JSON column `dod` on `issues` table + `IssueResource` + `IssueRequest` rules                                                        | ❌ Not built |
| Audit log                    | `GET /api/v1/issues/{issue}/audit-log` endpoint + activity tracking                                                                 | ❌ Not built |
| Epic filter                  | Backend already supports `epic_id` param in `IssueController::index`                                                                | ✅ Ready     |
| Saved presets (localStorage) | No backend required                                                                                                                 | ✅ Ready     |

---

## Problem Statement

The issues feature is architecturally sound (FSD layers correct, filter state in
URL, Kanban with optimistic updates) but misses several key product
requirements:

- The type toggle has no "Tasks" option — users cannot filter to only non-epic
  issues
- Filters are missing author and epic — two common search dimensions
- The issue form has no structured Definition of Done checklist
- There is no change history — no way to see who changed what or when
- Filter combinations cannot be saved and reloaded — every session requires
  re-configuring filters

Additionally, two controls already share the same `filters.type` field: the
`IssueTypeToggle` and the "Type" `InputDropdown` in `SharedFiltersBar`. This
dual-control conflict must be resolved when the toggle gains a "Tasks" option.

---

## Technical Approach

### Architecture: SharedFilters Extension (Scoped)

Only `author_id` and `epic_id` are added in this PR (date fields deferred).
Every consumer must be updated atomically:

- `entities/issue/model/types.ts` — canonical `SharedFilters` definition
- `features/issues/model/types.ts` — re-export + `IssueFilters`
- `features/kanban/model/types.ts` — `KanbanFilters` extends `SharedFilters`
- `features/issues/ui/shared-filters-bar.tsx` — new UI controls
- `features/issues/ui/__tests__/filters-context.test.tsx` — default value

### Consideration: nuqs Library for URL State

Research identified **nuqs** as the industry-standard solution for type-safe URL
search param state in Next.js App Router. It eliminates: SSR hydration
mismatches, manual string coercion, missing Suspense boundaries, and batching
issues with rapid filter changes.

**Recommended migration path** (not mandatory for this PR, but strongly
consider):

```bash
npm install nuqs use-debounce
```

Wrap `app/Providers.tsx` with `NuqsAdapter` from `nuqs/adapters/next/app`.
Define a `features/issues/model/filter-params.ts` schema file using
`parseAsString`, `parseAsBoolean`, `parseAsStringLiteral`. Replace
`router.replace` + manual URLSearchParams in `IssuesLayoutClient` with
`useQueryStates(issueFilterParsers, { shallow: false, startTransition, history: 'replace' })`.

If nuqs is not adopted, the existing `router.replace` pattern must include:

- `{ scroll: false }` on every call
- All filter changes wrapped in `startTransition` for `isPending` state
- `updateUrl` added to the `[filters]` effect's dependency array (currently
  missing — existing bug)

### Convention: useFieldArray for DoD (Exception to Existing Pattern)

DoD items require keyboard UX (Enter to add, Backspace-on-empty to remove, focus
management between items). `useState<DoDItem[]>` cannot cleanly implement
imperative focus control. Use `useFieldArray` from react-hook-form with merged
refs for this specific case — this is the one justified exception to the "no
useFieldArray" convention. Document the reason.

### Convention: localStorage preset — inline, no hook abstraction

The `useFilterPresets` hook is YAGNI. Inline localStorage reads/writes into
`FilterPresetsPanel`. The only rule: localStorage must be accessed in
`useEffect`, never in `useState` lazy initializer (SSR crash risk).

### Epic Filter Data Loading

Epics are loaded **SSR in the layout Server Component** alongside `persons` and
`organizations`. No client-side `useEffect` refetch. When `organization_id`
changes, `router.replace` updates the URL, Next.js re-renders the layout Server
Component, and fresh epics arrive as props — zero extra complexity.

```ts
// app/dashboard/issues/(tabs)/layout.tsx — add to existing Promise.all
const epics = await getEpics(Number(cookieOrgId) || undefined);
```

Pass `epics` as a prop to `IssuesLayoutClient` → `SharedFiltersBar`. When org
changes, the URL update triggers SSR re-render which delivers updated epics
automatically.

---

## Implementation Phases

### Phase 0 — Shared types extension (no backend needed, unblocks everything)

#### `entities/issue/model/types.ts`

Extend `SharedFilters` (two new fields only, date fields deferred):

```ts
export interface SharedFilters {
  organization_id: string;
  team_id: string;
  search: string;
  type: string; // '' means "no filter". string not string|'' (redundant union)
  assignee_id: string;
  status: IssueStatus | '';
  show_archived: boolean;
  // NEW — this PR only
  author_id: string; // issue creator (user_id), '' = no filter
  epic_id: string; // parent epic, '' = no filter
}
```

Also add `DoDItem` here only if it will be consumed cross-feature.
**Recommendation:** place `DoDItem` in `features/issues/model/types.ts` instead
(feature-private, no cross-feature consumer):

```ts
// features/issues/model/types.ts — NOT entities/
export interface DoDItem {
  id: string; // crypto.randomUUID() client-side; preserved on round-trip via JSON column
  text: string;
  completed: boolean;
}
```

Add `IssueAuditEvent` to **`entities/issue/model/types.ts`** (domain event,
potentially consumed by multiple features), and export it from
`entities/issue/index.ts`:

```ts
export type IssueAuditField =
  | 'name'
  | 'description'
  | 'status'
  | 'type'
  | 'assignee_id'
  | 'due_date'
  | 'priority'
  | 'epic_id'
  | 'team_id'
  | 'organization_id'
  | (string & {}); // open-ended: backend can track any field

export interface IssueAuditEvent {
  id: number;
  field: IssueAuditField;
  old_value: string | null;
  new_value: string | null;
  user: PersonOption; // reuse existing PersonOption — same shape {id, name}
  created_at: string; // ISO 8601
}
```

Update `entities/issue/index.ts`:

```ts
export type { DoDItem } from '../features/issues/model/types'; // Only if moved here
export type { IssueAuditEvent, IssueAuditField } from './model/types';
```

#### `features/issues/ui/issues-layout-client.tsx`

**Critical existing bug fix:** add `updateUrl` to the URL sync effect's
dependency array:

```ts
// Line ~189 — currently: [filters]
}, [filters, updateUrl]); // was missing updateUrl
```

Add new fields to URL init and `updateUrl`:

```ts
// In lazy useState initializer:
author_id: searchParams.get('author_id') ?? '',
epic_id: searchParams.get('epic_id') ?? '',

// In updateUrl effect — use the full filters object iteration instead of hardcoded fields:
for (const [key, value] of Object.entries(filters)) {
  if (key === 'show_archived') {
    params.set(key, value ? '1' : '');
  } else if (typeof value === 'string') {
    params.set(key, value);
  }
}
```

**Guard: epic_id must be cleared synchronously when type changes to 'epic':**

```ts
const handleFiltersChange = useCallback((patch: Partial<SharedFilters>) => {
  setFilters((prev) => {
    const next = { ...prev, ...patch };
    // Epics cannot be children of epics — clear epic filter when viewing epics
    if (patch.type === 'epic' && prev.type !== 'epic') {
      next.epic_id = '';
    }
    return next;
  });
  setFiltersVersion((v) => v + 1);
  // ...rest of existing logic
}, []);
```

#### `features/issues/model/types.ts` → `IssueFilters`

Add `author_id` and `epic_id` to `IssueFilters`.

Update `buildIssuesQuery()`:

```ts
// Existing: params.set('type', filters.type)
// Replace with:
if (filters.type === 'task') {
  params.set('exclude_type', 'epic'); // frontend sentinel — 'task' is NOT a valid backend type
} else if (filters.type) {
  params.set('type', filters.type);
}
// Also validate type against allowed set before sending:
const VALID_BACKEND_TYPES = new Set(['epic', 'development', 'organization']);
if (
  filters.type &&
  filters.type !== 'task' &&
  !VALID_BACKEND_TYPES.has(filters.type)
) {
  // Malformed URL param — skip type filter to avoid 422
}

// New:
if (filters.author_id) params.set('user_id', filters.author_id);
if (filters.epic_id) params.set('epic_id', filters.epic_id);
```

> **⚠️ Before implementing `exclude_type=epic`:** Read
> `WandaAsk_backend/app/Http/Requests/API/v1/IssueIndexRequest.php` to confirm
> the param is accepted. If not, the "Tasks" option cannot be safely shipped
> until the backend is updated.

#### `features/kanban/model/types.ts` → `KanbanFilters`

Add `author_id`, `epic_id`. Update `buildKanbanQuery()` accordingly.

#### `features/issues/ui/__tests__/filters-context.test.tsx`

Add `author_id: ''` and `epic_id: ''` to the `defaultValue.filters` object.

#### Security fix: `Number()` NaN guard on filter URL params

Existing bug in `app/dashboard/issues/(tabs)/list/page.tsx` lines 68-69 and
`kanban/page.tsx` lines 31-35:

```ts
// Current (wrong):
team_id: params.team_id ? Number(params.team_id) : null,

// Fixed:
const rawTeamId = params.team_id ? Number(params.team_id) : null;
team_id: rawTeamId !== null && Number.isFinite(rawTeamId) && rawTeamId > 0 ? rawTeamId : null,
```

---

### Phase 1 — Type toggle "Tasks" option

> **Backend prerequisite:** Needs `exclude_type=epic` in `IssueRequest`. Read
> backend FormRequest first.

#### `features/issues/ui/issue-type-toggle.tsx`

Add third option. Keep `ToggleValue` **derived from `OPTIONS`** (do not declare
a separate union):

```ts
const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'epic', label: 'Epics' },
  { value: 'task', label: 'Tasks' }, // sentinel: maps to exclude_type=epic
] as const;

// Type stays derived — this is already the pattern:
type ToggleValue = (typeof OPTIONS)[number]['value'];
// = '' | 'epic' | 'task'
```

**Design fix — active state contrast (dark theme):**

```ts
// Current:
'bg-background text-foreground shadow-sm';
// Replace with:
'bg-card text-foreground shadow-sm border border-white/8';
```

`bg-card` (#0e0e1a) on `bg-muted` provides better contrast in the dark theme.
The 1px `border-white/8` gives the selected pill a subtle raised appearance.

**Dual-control conflict resolution:** Pass `hasTypeToggle?: boolean` to
`SharedFiltersBar`. When `true`, hide the "Type" `InputDropdown` in the bar (the
toggle takes ownership of the `type` filter field).

Call sites to update:

- `features/issues/ui/issues-list-tab.tsx` — pass `hasTypeToggle` to
  `SharedFiltersBar`
- `features/issues/ui/issues-kanban-tab.tsx` — same

### Research Insights — Type Toggle

**Race condition check:** The toggle updates `filters.type` via
`handleFiltersChange`. When switching to `'task'`, `filters.type` becomes
`'task'` and `buildIssuesQuery` transforms it to `exclude_type=epic`. This is
safe — no race with the epic_id guard because that guard only fires when
`type === 'epic'`.

**Backend validation note:** Never send `type=task` to the backend. The
`VALID_BACKEND_TYPES` guard in `buildIssuesQuery` (Phase 0) ensures `'task'` is
transformed, not passed through. The guard must include a development-mode
`console.warn` if `exclude_type` is sent but the backend hasn't been updated yet
(HTTP 422 response will reveal this in the network tab).

---

### Phase 2 — Author + Epic filter in SharedFiltersBar

> **Author filter:** ❌ Backend prerequisite (`user_id` filter param in
> `IssueController::index`) **Epic filter:** ✅ Backend ready

#### Epic filter — SSR data loading

**No `useEffect` refetch.** Add to `app/dashboard/issues/(tabs)/layout.tsx`:

```ts
// Add to existing Promise.all (with try/catch so epics don't block page load if endpoint fails):
const [organizationsResponse, persons, currentUserId, cookieOrgId, epics] =
  await Promise.all([
    getOrganizations(),
    getPersons(),
    getCurrentUserId(),
    getOrganizationId(),
    getEpics(Number(await getOrganizationId()) || undefined).catch(() => []),
  ]);
```

Pass `epics: EpicOption[]` to `IssuesLayoutClient` as a new prop. When org
changes and URL updates, the layout re-renders server-side and delivers fresh
epics as props — no client-side state needed.

#### `features/issues/ui/shared-filters-bar.tsx`

Add `epics: EpicOption[]` to `SharedFiltersBarProps`.

**Layout recommendation:** Add author + epic to the existing filter grid. To
prevent density issues, nest the advanced filters (author, epic) in a second
`CollapsibleSection` with `defaultOpen={false}` inside the main filter section:

```tsx
<CollapsibleSection
  label='Advanced filters'
  icon={<SlidersHorizontal className='h-3 w-3' />}
  defaultOpen={false}
  extraContent={
    hasActiveAdvancedFilters && (
      <span className='w-1.5 h-1.5 rounded-full bg-primary' />
    )
  }
>
  <div className='grid gap-2 sm:grid-cols-2'>
    <InputDropdown
      label='Author'
      value={filters.author_id}
      options={[
        { value: '', label: 'All Authors' },
        ...persons.map((p) => ({ value: String(p.id), label: p.name })),
      ]}
      onChange={(val) => onChange({ author_id: val as string })}
      searchable
    />
    <InputDropdown
      label='Epic'
      value={filters.epic_id}
      options={[
        { value: '', label: 'All Epics' },
        ...epics.map((e) => ({ value: String(e.id), label: e.name })),
      ]}
      onChange={(val) => onChange({ epic_id: val as string })}
      searchable
    />
  </div>
</CollapsibleSection>
```

**Active indicator:**
`hasActiveAdvancedFilters = filters.author_id !== '' || filters.epic_id !== ''`.
Show a violet dot on the collapsed "Advanced filters" label when any advanced
filter is set.

### Research Insights — Author + Epic

**Epic filter + type='Epics' guard:** Already handled in Phase 0
`handleFiltersChange`. When type switches to 'epic', `epic_id` is cleared. No
additional logic needed in `SharedFiltersBar`.

**Epic data race:** If (despite the SSR approach) a client-side reload is ever
added later, use the cancellation pattern:

```ts
useEffect(() => {
  let cancelled = false;
  getEpics(orgId).then((result) => {
    if (!cancelled) setEpics(result);
  });
  return () => {
    cancelled = true;
  };
}, [orgId]);
```

---

### Phase 3 — Definition of Done (DoD) checklist

> ❌ Backend prerequisite: `dod` JSON column on `issues` table, `IssueResource`
> serialization, `IssueRequest` validation.

#### Backend-assumed contract

```ts
// dod is a JSON column on issues — whole array replaced on every save
// No per-item endpoints exist
interface DoDItem {
  id: string; // client-generated UUID, preserved on round-trip
  text: string;
  completed: boolean;
}
```

> **Verify with backend before implementing:** Read `IssueResource.php` to
> confirm `dod` field name and structure. Read migration to confirm JSON column
> (not separate table). If it's a separate `issue_dod_items` table, IDs are
> numeric from the backend — adjust the frontend type accordingly.

#### `features/issues/model/types.ts`

```ts
export interface DoDItem {
  id: string;
  text: string;
  completed: boolean;
}
```

Add `dod: DoDItem[]` to `IssueFormValues` and `IssueUpsertDTO`. Add
`dod: DoDItem[] | null` to `Issue` interface (only after backend Resource is
confirmed).

#### `features/issues/ui/issue-form.tsx` — DoD with useFieldArray

**Exception to project convention:** Use `useFieldArray` here (not
`useState<DoDItem[]>`) because Enter/Backspace keyboard UX requires imperative
focus control across items, which is cleanly handled by `useFieldArray`'s
`append`/`remove` + ref array pattern.

```ts
// In IssueFormValues schema — add:
dod: z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean().default(false),
  }),
).default([]);
```

```tsx
// In issue-form.tsx:
const { fields, append, remove } = useFieldArray({ control, name: 'dod' });
const dodRefs = useRef<(HTMLInputElement | null)[]>([]);

const handleDodKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement>,
  index: number,
) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // Guard: don't add if current item is empty
    if (e.currentTarget.value.trim() === '') {
      dodRefs.current[index]?.classList.add('border-destructive');
      setTimeout(
        () => dodRefs.current[index]?.classList.remove('border-destructive'),
        800,
      );
      return;
    }
    append(
      { id: crypto.randomUUID(), text: '', completed: false },
      { shouldFocus: false },
    );
    requestAnimationFrame(() => dodRefs.current[index + 1]?.focus());
  }
  if (e.key === 'Backspace' && e.currentTarget.value === '') {
    e.preventDefault();
    remove(index);
    requestAnimationFrame(() => {
      if (index > 0) dodRefs.current[index - 1]?.focus();
    });
  }
};
```

**DoD item row rendering:**

```tsx
{
  /* Definition of Done */
}
<div className='flex flex-col gap-2'>
  <span className='text-sm font-medium text-foreground'>
    Definition of Done
  </span>
  <ul className='flex flex-col gap-1'>
    {fields.map((field, index) => (
      <li
        key={field.id}
        className='flex items-center gap-2 rounded-[var(--radius-button)] px-2 py-1 hover:bg-muted/60 transition-colors group'
      >
        <Checkbox
          checked={getValues(`dod.${index}.completed`)}
          onChange={(e) => setValue(`dod.${index}.completed`, e.target.checked)}
        />
        <input
          type='text'
          {...register(`dod.${index}.text`)}
          ref={(el) => {
            register(`dod.${index}.text`).ref(el);
            dodRefs.current[index] = el;
          }}
          onKeyDown={(e) => handleDodKeyDown(e, index)}
          placeholder='Acceptance criterion...'
          className='flex-1 bg-transparent text-sm outline-none'
        />
        <ButtonIcon
          icon={<X size={14} />}
          onClick={() => remove(index)}
          className='opacity-0 group-hover:opacity-100 transition-opacity'
        />
      </li>
    ))}
  </ul>
  <button
    type='button'
    className='self-start text-sm text-muted-foreground hover:text-foreground transition-colors'
    onClick={() =>
      append({ id: crypto.randomUUID(), text: '', completed: false })
    }
  >
    + Add criterion
  </button>
</div>;
```

**`useState` stale prop fix:** The `issue?.dod` prop must initialize
`useFieldArray` via `defaultValues` in `useForm`, not in a separate `useState`.
Pass `defaultValues: { ..., dod: issue?.dod ?? [] }` to `useForm`. If `issue`
identity changes without remount, add `key={issue?.id}` on the form wrapper in
the parent page.

#### DoD progress indicator on detail page

```tsx
{
  /* Place between title and comments, NOT in sidebar */
}
{
  dod && dod.length > 0 && (
    <div className='flex flex-col gap-1 my-4'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-muted-foreground'>
          Definition of Done
        </span>
        <span className='text-xs text-muted-foreground tabular-nums'>
          {dod.filter((d) => d.completed).length} / {dod.length}
        </span>
      </div>
      <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
        <div
          className='h-full rounded-full transition-all duration-300'
          style={{
            width: `${Math.round((dod.filter((d) => d.completed).length / dod.length) * 100)}%`,
          }}
          // bg-accent (terminal green) when partial, bg-primary (violet) at 100%
          data-complete={dod.every((d) => d.completed) || undefined}
        />
      </div>
    </div>
  );
}
```

Use CSS `[data-complete]:bg-primary bg-accent` for color switching (or a ternary
className). The 6px bar (`h-1.5`) is intentionally thin — visible without
dominating the layout.

### Research Insights — DoD

**`crypto.randomUUID()` in `append` handler:** Safe — runs only in browser event
handlers (click, keydown), never during SSR. No guard needed.

**Empty text items on submit:** Filter them out in `onSubmit` before sending:

```ts
const cleanedDod = dodItems.filter((d) => d.text.trim().length > 0);
```

**Edit mode reset:** `useForm({ defaultValues: { dod: issue?.dod ?? [] } })` +
`key={issue?.id}` on the parent ensures the form resets when a different issue
is loaded. Do not use `useEffect` to reset.

---

### Phase 4 — Audit log timeline

> ❌ Backend prerequisite: `GET /api/v1/issues/{issue}/audit-log` endpoint.

#### `features/issues/api/audit-log.ts`

```ts
'use server';

import { httpClient } from '@/shared/lib/httpClient'; // NOT httpClientList (no Items-Count header expected)
import type { IssueAuditEvent } from '@/entities/issue';

const API_URL = process.env.API_URL;

export async function getIssueAuditLog(
  issueId: number,
): Promise<IssueAuditEvent[]> {
  const { data } = await httpClient<IssueAuditEvent[]>(
    `${API_URL}/issues/${issueId}/audit-log`,
  );
  return data ?? [];
}
```

> **Note:** Use `httpClient` (not `httpClientList`) unless the backend endpoint
> explicitly sends `Items-Count` header. Verify after the backend endpoint is
> implemented.

#### `features/issues/ui/issue-audit-log.tsx`

**Visual timeline with connector line:**

```tsx
'use client';
import type { IssueAuditEvent } from '@/entities/issue';

interface Props {
  events: IssueAuditEvent[];
}

const MAX_VISIBLE = 10;

export function IssueAuditLog({ events }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return null;

  const visible = showAll ? events : events.slice(0, MAX_VISIBLE);

  return (
    <section className='flex flex-col gap-3'>
      <h3 className='text-sm font-semibold text-foreground'>Change history</h3>
      <ol className='flex flex-col gap-0'>
        {visible.map((event) => (
          <li
            key={event.id}
            className='relative pl-6 pb-3 before:absolute before:left-[7px] before:top-5 before:bottom-0 before:w-px before:bg-border last:before:hidden'
          >
            {/* Avatar dot in the connector gutter */}
            <div className='absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-muted border border-border flex items-center justify-center'>
              <span className='text-[8px] text-muted-foreground font-bold'>
                {event.user.name[0].toUpperCase()}
              </span>
            </div>
            <div className='flex flex-col gap-0.5'>
              <span className='text-sm text-foreground'>
                <strong className='font-medium'>{event.user.name}</strong>{' '}
                changed{' '}
                <span className='text-muted-foreground'>{event.field}</span>
                {event.old_value && (
                  <>
                    {' '}
                    from{' '}
                    <code className='text-xs bg-muted px-1 rounded text-muted-foreground'>
                      {event.old_value}
                    </code>
                  </>
                )}
                {event.new_value && (
                  <>
                    {' '}
                    to{' '}
                    <code className='text-xs bg-muted px-1 rounded text-foreground'>
                      {event.new_value}
                    </code>
                  </>
                )}
              </span>
              <time className='text-xs text-muted-foreground'>
                {new Date(event.created_at).toLocaleString('en-US')}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {events.length > MAX_VISIBLE && !showAll && (
        <button
          type='button'
          className='self-start text-xs text-muted-foreground hover:text-foreground transition-colors'
          onClick={() => setShowAll(true)}
        >
          Show {events.length - MAX_VISIBLE} more
        </button>
      )}
    </section>
  );
}
```

**Value color semantics:** `old_value` in `text-muted-foreground`, `new_value`
in `text-foreground`. The contrast difference makes before/after immediately
parseable.

#### `app/dashboard/issues/[id]/page.tsx` — Suspense streaming

**Critical:** Do NOT add `getIssueAuditLog` to the existing `Promise.all`. Wrap
in a dedicated async Server Component + `<Suspense>`:

```tsx
// app/dashboard/issues/[id]/page.tsx — in JSX:
<Suspense fallback={<div className='h-8 animate-pulse bg-muted rounded' />}>
  <IssueAuditLogSection issueId={issueId} />
</Suspense>
```

```tsx
// features/issues/ui/issue-audit-log-section.tsx — async Server Component
export async function IssueAuditLogSection({ issueId }: { issueId: number }) {
  const events = await getIssueAuditLog(issueId).catch(() => []);
  return <IssueAuditLog events={events} />;
}
```

This way the detail page (form, comments, attachments) renders at full speed.
The audit log streams in independently. A 500/404 from the backend renders
nothing — the `Suspense` boundary contains the error.

### Research Insights — Audit Log

**`httpClient` vs `httpClientList`:** `httpClient` is correct unless the backend
sends `Items-Count` response header. Confirm after the endpoint is implemented
by reading the backend Resource/Controller. If paginated, switch to
`httpClientList` — this is a 2-line change.

**Grouped same-timestamp events:** Consider merging events within a 5-second
window into one entry: "Alice updated 3 fields". Implement client-side in
`IssueAuditLog` with a `groupBy` pass over events before rendering. Keeps the
timeline readable for bulk updates.

**Field name display:** `event.field` arrives as a machine name (`assignee_id`,
`due_date`). Display-map it to human labels:

```ts
const FIELD_LABELS: Record<string, string> = {
  name: 'Title',
  description: 'Description',
  status: 'Status',
  assignee_id: 'Assignee',
  due_date: 'Due date',
  priority: 'Priority',
  epic_id: 'Epic',
  team_id: 'Team',
};
const label = FIELD_LABELS[event.field] ?? event.field;
```

---

### Phase 5 — Saved filter presets (localStorage)

No backend needed.

#### `features/issues/model/types.ts`

```ts
export interface FilterPreset {
  id: string;
  name: string;
  filters: SharedFilters;
  // No createdAt — YAGNI until UI shows relative timestamps
}
```

#### `features/issues/ui/filter-presets-panel.tsx`

**No separate hook.** Inline localStorage logic directly in the component.
SSR-safe via `useEffect` hydration:

```tsx
'use client';
import { useState, useEffect } from 'react';
import type { SharedFilters, FilterPreset } from '../model/types';

const STORAGE_KEY = 'issues_filter_presets';
const STORAGE_VERSION = 1;

interface PresetsEnvelope {
  version: number;
  presets: FilterPreset[];
}

function loadPresets(): FilterPreset[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as unknown;
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('version' in raw) ||
      !('presets' in raw)
    )
      return [];
    const envelope = raw as PresetsEnvelope;
    if (envelope.version !== STORAGE_VERSION) return []; // schema changed — reset
    return Array.isArray(envelope.presets) ? envelope.presets : [];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]): void {
  const envelope: PresetsEnvelope = { version: STORAGE_VERSION, presets };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

interface Props {
  currentFilters: SharedFilters;
  onApply: (filters: SharedFilters) => void;
}

export function FilterPresetsPanel({ currentFilters, onApply }: Props) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // SSR-safe: hydrate from localStorage after mount only
  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const handleSave = () => {
    if (!saveName.trim()) return;
    setPresets((prev) => {
      const next = [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: saveName.trim(),
          filters: currentFilters,
        },
      ];
      savePresets(next);
      return next;
    });
    setSaveName('');
    setIsSaving(false);
  };

  const handleRemove = (id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePresets(next);
      return next;
    });
  };

  // ... JSX (see design section below)
}
```

**Preset UI placement (design system):** A `Bookmark` icon `ButtonIcon` in the
filter bar header. Clicking opens a `Popup` (not `Modal`) anchored to the
button:

```tsx
// Popup content — 256px wide, bg-card, border-border, shadow-[0_4px_24px_rgba(0,0,0,0.5)]
<div className='flex flex-col gap-2 p-3 w-64'>
  <p className='text-xs text-muted-foreground font-medium uppercase tracking-wide'>
    Presets
  </p>
  {presets.length === 0 && (
    <p className='text-xs text-muted-foreground text-center py-2'>
      No saved presets
    </p>
  )}
  {presets.map((preset) => (
    <div key={preset.id} className='flex items-center gap-1.5'>
      <button
        type='button'
        className='flex-1 text-left text-sm text-foreground hover:text-primary transition-colors truncate'
        onClick={() => onApply(preset.filters)}
      >
        {preset.name}
      </button>
      <ButtonIcon
        icon={<X size={12} />}
        onClick={() => handleRemove(preset.id)}
        className='shrink-0 opacity-50 hover:opacity-100'
      />
    </div>
  ))}
  <div className='border-t border-border pt-2 mt-1'>
    {isSaving ? (
      <div className='flex gap-2'>
        <input
          autoFocus
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder='Name this preset...'
          className='flex-1 h-8 text-xs bg-input border border-border rounded px-2 outline-none focus:border-primary'
        />
        <Button size='sm' onClick={handleSave} disabled={!saveName.trim()}>
          Save
        </Button>
      </div>
    ) : (
      <button
        type='button'
        className='text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left'
        onClick={() => setIsSaving(true)}
      >
        + Save current filters
      </button>
    )}
  </div>
</div>
```

**Bookmark icon with active indicator:**

```tsx
<div className='relative'>
  <ButtonIcon icon={<Bookmark size={14} />} onClick={togglePopup} />
  {presets.length > 0 && (
    <span className='absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary' />
  )}
</div>
```

### Research Insights — Presets

**Schema versioning:** The `PresetsEnvelope` with `version: number` allows
graceful reset when `SharedFilters` shape changes. Increment `STORAGE_VERSION`
constant whenever `SharedFilters` gets new required fields. On version mismatch,
old presets are silently cleared (no user-visible error).

**SSR guard:** `typeof window === 'undefined'` is NOT used in the `useState`
initializer — instead, `useState([])` + `useEffect` hydration is the canonical
pattern. This avoids the hydration mismatch entirely (server renders empty,
client hydrates from localStorage after first paint).

**Functional updater in `setPresets`:** Always use `setPresets((prev) => ...)`
form — this prevents stale closure bugs if `save`/`remove` are called before
re-render.

**`apply` method removed:** `onApply(preset.filters)` is called directly at the
call site. No wrapper function needed.

---

## Acceptance Criteria

### Phase 0 — Shared types

- [x] `SharedFilters` has `author_id` and `epic_id` (date fields NOT in this PR)
- [x] `IssuesLayoutClient` reads and writes `author_id` and `epic_id` to/from
      URL params
- [x] `updateUrl` is in the dependency array of the URL sync `useEffect` (bug
      fix)
- [x] `handleFiltersChange` clears `epic_id` when `type` changes to `'epic'`
- [x] `IssueFilters` and `KanbanFilters` include `author_id` and `epic_id`
- [x] `buildIssuesQuery` transforms `type='task'` → `exclude_type=epic`, not
      `type=task`
- [x] `buildIssuesQuery` validates type against allowed backend set before
      sending
- [x] `Number()` NaN guard applied to `team_id` and `organization_id` in
      list/kanban pages
- [x] Filters context test compiles and passes

### Phase 1 — Type toggle

- [x] Toggle shows "All", "Epics", "Tasks" options
- [x] `ToggleValue` type remains derived from `OPTIONS` — no separate union
      declaration
- [x] "Tasks" sends `exclude_type=epic` (not `type=task`) to backend
- [x] Type `InputDropdown` in `SharedFiltersBar` hidden when
      `hasTypeToggle=true`
- [x] Toggle active state uses `bg-card border border-white/8` (improved dark
      theme contrast)

### Phase 2 — Author + Epic filters

- [x] `SharedFiltersBar` shows "Author" and "Epic" dropdowns in a collapsed
      "Advanced filters" subsection
- [x] Advanced filters section shows violet dot indicator when any advanced
      filter is active
- [x] Epics loaded SSR in layout Server Component — no client-side `useEffect`
      refetch
- [x] Epic dropdown refreshes when organization changes (via SSR re-render)
- [x] `epic_id` is passed to both `buildIssuesQuery` and `buildKanbanQuery`

### Phase 3 — DoD

- [x] DoD checklist renders in create and edit form with `useFieldArray`
- [x] Enter on non-empty item adds next item and focuses it
- [x] Backspace on empty item removes it and focuses previous
- [x] Empty text items filtered from payload on submit
- [x] `dod` array included in create and update payloads
- [x] Detail page shows 6px progress bar (accent → primary at 100%) when issue
      has DoD items
- [x] Empty DoD renders no section
- [x] Form resets correctly when `issue.id` changes (`key={issue?.id}` on form
      wrapper)

### Phase 4 — Audit log

- [x] Audit log section rendered as async Server Component wrapped in
      `<Suspense>`
- [x] Shows field label (human-readable), old value, new value, author,
      timestamp
- [x] Visual timeline connector (vertical line between entries)
- [x] Shows max 10 events by default with "Show N more" button
- [x] Backend unavailable → `<Suspense>` boundary hides section silently
- [x] Timestamps in English locale via `toLocaleString('en-US')`
- [x] NOT added to `Promise.all` in detail page (no TTFB regression)

### Phase 5 — Saved presets

- [x] Bookmark icon with active dot in filter bar header
- [x] Popup (not Modal) opens on bookmark click
- [x] "Save current filters" shows inline input → saves to localStorage
- [x] Preset schema versioned with `STORAGE_VERSION` constant
- [x] Invalid/outdated localStorage data gracefully discarded
- [x] Applying a preset calls `handleFiltersChange` and updates URL
- [x] Deleting a preset removes it from localStorage
- [x] SSR-safe: `useEffect` hydration pattern (not lazy useState initializer)
- [x] Functional updater form used in all `setPresets` calls

---

## Edge Cases and Gotchas

1. **"Tasks" toggle vs type dropdown** — resolved via `hasTypeToggle` prop on
   `SharedFiltersBar`. When toggle is present, bar's type dropdown is hidden.

2. **Epic filter + "Epics" toggle** — guard in `handleFiltersChange` clears
   `epic_id` synchronously when `type` changes to `'epic'`. The guard must fire
   before `filtersVersion` increments to prevent a window where corrupt params
   are sent.

3. **`isIssueType` passes any non-empty string** — `buildIssuesQuery` validates
   against `VALID_BACKEND_TYPES` set. Malformed URL params are silently dropped
   (not sent to backend) to avoid 422.

4. **`exclude_type=epic` backend not ready** — when `type='task'` is toggled,
   the param is built but the backend may ignore it (no `exclude_type` param in
   FormRequest). The UI will show "Tasks" selected but return all issues. This
   is acceptable as a staged rollout — the filter becomes effective when the
   backend ships.

5. **Back-navigation URL ↔ React state split** — known limitation. When user
   navigates back after applying a preset, the URL reverts but React state may
   hold preset values until re-render. The existing `router.replace` pattern
   partially mitigates this (replaces history, so "back" skips filter states).
   Document as known limitation.

6. **`FilterPreset.filters` with `show_archived: boolean`** — serializes
   correctly to JSON (`true`/`false`). No special handling needed.

7. **Audit log field name mapping** — `event.field` is a machine name from the
   backend. Apply `FIELD_LABELS` map before rendering. Unknown fields fall back
   to `event.field` as-is.

8. **DoD keyboard — Enter on empty item** — flash `border-destructive` on the
   input for 800ms instead of adding a blank item. Do not show a toast (too
   disruptive for a form field interaction).

---

## Risk Analysis

| Risk                                           | Likelihood | Impact                                       | Mitigation                                                                    |
| ---------------------------------------------- | ---------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Backend `exclude_type` param not ready         | High       | "Tasks" filter shows all issues              | Build toggle; param sent silently ignored until backend ships                 |
| Author filter backend not ready                | High       | Author filter has no effect                  | Render control, wire param, visible results when backend ships                |
| DoD backend not ready                          | High       | `dod` field missing from responses           | Form UI built; `issue?.dod ?? []` default; field activated when backend ships |
| `updateUrl` stale closure bug (existing)       | Certain    | URL params lag one render on fast navigation | Fix in Phase 0 — add `updateUrl` to effect deps                               |
| `Number()` NaN on filter URL params (existing) | Certain    | 422 errors from crafted URLs                 | Fix in Phase 0 — add `Number.isFinite` guard                                  |
| Type conflict (toggle + dropdown)              | Medium     | Desynchronized filter visual state           | Resolve in Phase 1 via `hasTypeToggle` prop                                   |
| Preset localStorage schema change              | Low        | Old presets silently discarded               | `STORAGE_VERSION` + version check                                             |
| Audit log slows detail page TTFB               | Low → None | Page load regression                         | Fully mitigated by `<Suspense>` streaming                                     |

---

## File Index

| File                                                    | Action                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `entities/issue/model/types.ts`                         | Extend `SharedFilters` (+2 fields), add `IssueAuditEvent`, `IssueAuditField`            |
| `entities/issue/index.ts`                               | Export `IssueAuditEvent`, `IssueAuditField`                                             |
| `features/issues/model/types.ts`                        | Add `DoDItem`, `FilterPreset`, extend `IssueFormValues`/`IssueUpsertDTO`/`IssueFilters` |
| `features/issues/ui/issues-layout-client.tsx`           | Bug fix: `updateUrl` in deps; new filter fields; `epic_id` clear guard; `epics` prop    |
| `features/issues/ui/shared-filters-bar.tsx`             | Add author+epic (nested advanced section); `hasTypeToggle` prop removes type dropdown   |
| `features/issues/ui/issue-type-toggle.tsx`              | Add "Tasks" option; fix active state colors                                             |
| `features/issues/ui/issues-list-tab.tsx`                | Pass `hasTypeToggle` to `SharedFiltersBar`                                              |
| `features/issues/ui/issues-kanban-tab.tsx`              | Pass `hasTypeToggle` to `SharedFiltersBar`                                              |
| `features/issues/ui/issue-form.tsx`                     | Add DoD checklist with `useFieldArray`                                                  |
| `features/issues/ui/issue-audit-log.tsx`                | New component (timeline with connector)                                                 |
| `features/issues/ui/issue-audit-log-section.tsx`        | New async Server Component (Suspense-wrapped)                                           |
| `features/issues/ui/filter-presets-panel.tsx`           | New component (inline localStorage, no hook)                                            |
| `features/issues/api/audit-log.ts`                      | New server action (`httpClient`, not `httpClientList`)                                  |
| `features/kanban/model/types.ts`                        | Extend `KanbanFilters` (+`author_id`, `epic_id`)                                        |
| `features/kanban/api/kanban.ts`                         | Extend `buildKanbanQuery`                                                               |
| `app/dashboard/issues/(tabs)/layout.tsx`                | Add `getEpics()` to SSR fetch; pass `epics` prop                                        |
| `app/dashboard/issues/(tabs)/list/page.tsx`             | NaN guard on `team_id`/`organization_id`                                                |
| `app/dashboard/issues/(tabs)/kanban/page.tsx`           | NaN guard on filter URL params                                                          |
| `app/dashboard/issues/[id]/page.tsx`                    | Suspense-wrap audit log section                                                         |
| `features/issues/ui/__tests__/filters-context.test.tsx` | Add `author_id: ''`, `epic_id: ''` to default                                           |

---

## Implementation Sequence

```
Phase 0: SharedFilters extension + bug fixes   ← start here, no blockers
         (updateUrl dep fix, NaN guard, 2 new filter fields)
    ↓
Phase 1: Type toggle "Tasks" option            ← frontend ready; backend needed for correctness
Phase 2: Epic filter (SSR load) + Author UI   ← epic: no blocker; author: waits on backend
Phase 5: Saved filter presets                 ← no backend blocker, parallel with Phase 2
    ↓
Phase 3: DoD checklist                        ← frontend stubs built; backend decides storage
Phase 4: Audit log                            ← fully blocked on backend endpoint
```

Phases 0-2 and 5 can be completed and shipped independently. Phases 3-4 have
working frontend stubs that activate once the backend is deployed.

---

## Test Coverage Plan

### Ready to write now (no implementation pending)

| Test file                                                  | Tests | Key scenarios                                                                          |
| ---------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `features/issues/model/__tests__/types.test.ts`            | ~22   | `isIssueStatus`, `isIssueType`, `getPriorityLevel`, type guards                        |
| `features/issues/ui/__tests__/issue-type-toggle.test.tsx`  | ~14   | 3-option render, keyboard nav (ArrowLeft/Right wrap), onChange values                  |
| `features/issues/api/__tests__/build-issues-query.test.ts` | ~15   | `type='task'` → `exclude_type=epic`; `type=''` → no param; NaN org/team IDs            |
| `features/issues/ui/__tests__/shared-filters-bar.test.tsx` | ~12   | Debounce on search (300ms), `hasTypeToggle` hides type dropdown, author/epic dropdowns |
| `features/issues/ui/__tests__/issue-form.test.tsx`         | ~25   | Epic type switching, `epic_id` clear, DoD add/remove/submit filter                     |

### Scaffold now, implement after features land

| Test file                                                    | Tests | Blocked on                     |
| ------------------------------------------------------------ | ----- | ------------------------------ |
| `features/issues/ui/__tests__/issue-audit-log.test.tsx`      | ~9    | `IssueAuditLog` component      |
| `features/issues/ui/__tests__/filter-presets-panel.test.tsx` | ~13   | `FilterPresetsPanel` component |

### Critical test cases

**`buildIssuesQuery` — type sentinel:**

```ts
it('sends exclude_type=epic when type is "task"', () => {
  const url = callBuildIssuesQuery({ type: 'task', ...defaults });
  expect(url).toContain('exclude_type=epic');
  expect(url).not.toContain('type=task');
});

it('drops unknown type values to prevent 422', () => {
  const url = callBuildIssuesQuery({ type: 'malformed_value', ...defaults });
  expect(url).not.toContain('type=');
  expect(url).not.toContain('exclude_type=');
});
```

**`IssueTypeToggle` — keyboard navigation:**

```ts
it('ArrowRight from "Tasks" wraps back to "All"', () => {
  // Focus "Tasks" (last option), press ArrowRight
  // Expect "All" to be focused and onChange('') called
});
```

**`FilterPresetsPanel` — SSR safety:**

```ts
it('does not throw when localStorage is unavailable', () => {
  // Render in environment where localStorage throws
  // Expect component renders with empty presets, no error thrown
});
```

---

## References

### Internal Code References

- `entities/issue/model/types.ts:21-29` — `SharedFilters` canonical definition
- `features/issues/ui/issue-type-toggle.tsx:1-70` — current toggle (2 options)
- `features/issues/ui/shared-filters-bar.tsx:44-145` — current filter bar
- `features/issues/ui/issues-layout-client.tsx:54-189` — filter state + URL sync
  (has `updateUrl` dep bug)
- `features/issues/api/issues.ts:391-408` — `getEpics()` existing server action
- `features/kanban/ui/kanban-board.tsx:93` — drag-drop handler
- `shared/ui/input/InputDropdown.tsx` — dropdown primitive
- `shared/ui/input/Input.tsx` — date/text input pattern
- `shared/ui/layout/collapsible-section.tsx` — filter bar wrapper
  (`extraContent` slot for dot indicator)
- `shared/ui/input/Checkbox.tsx` — use for DoD checklist items (not raw
  `<label>`)
- `app/dashboard/issues/[id]/page.tsx:36` — correct `Number.isFinite` guard
  example
- `app/dashboard/issues/(tabs)/list/page.tsx:68-69` — NaN bug location

### External References

- [nuqs — Type-safe search params for Next.js App Router](https://nuqs.dev/) —
  strongly recommended
- [useFieldArray — react-hook-form](https://www.react-hook-form.com/api/usefieldarray/)
  — DoD checklist
- [useOptimistic — React 19](https://react.dev/reference/react/useOptimistic) —
  filter optimistic UI
- [Next.js searchParams as Promise](https://dev.to/peterlidee/async-params-and-searchparams-in-next-16-5ge9)
  — Next.js 15/16 API

### Key Prior Plans

- `docs/plans/2026-03-31-feat-shared-filters-tasktracker-kanban-tabs-plan.md` —
  filter lifting pattern
- `docs/plans/2026-04-14-fix-kanban-filter-not-applied-on-assignee-change-plan.md`
  — race condition + `filtersVersion` pattern
- `docs/plans/2026-05-13-feat-issues-filters-org-awareness-plan.md` — org-aware
  filter reset, 6 edge cases
- `docs/plans/2026-05-19-feat-epic-task-toggle-and-epic-child-binding-plan.md` —
  toggle implementation (partially implemented)
