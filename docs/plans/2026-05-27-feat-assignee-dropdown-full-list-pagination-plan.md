---
title: 'feat: Assignee/Author Dropdown — Full List (Pagination Fix)'
type: feat
status: completed
date: 2026-05-27
deepened: 2026-05-27
---

# feat: Assignee/Author Dropdown — Full List (Pagination Fix)

## Enhancement Summary

**Deepened on:** 2026-05-27  
**Agents used:** kieran-typescript-reviewer, performance-oracle,
architecture-strategist, security-sentinel, code-simplicity-reviewer,
best-practices-researcher, learnings-researcher

### Key Improvements Discovered

1. **The pagination loop is YAGNI** — the simplest correct fix is a single-line
   change: `?limit=100`. The plan's multi-page while-loop is dead code from day
   one; the plan itself explicitly rules out >100 users as "not a current use
   case."
2. **Critical missing piece: `React.cache()`** — without it, `getPersons` fires
   two HTTP requests per page load (layout.tsx + page.tsx both call it).
   `getEpics` in the same file already uses this pattern. This is the
   highest-impact addition.
3. **FSD architecture gap** — `PersonOption` and `getPersons` belong in
   `entities/person/`, not `features/issues/`. `entities/team/api/team.ts` is
   the exact template to follow.
4. **Security: email exposure** — the full list of org member emails is
   serialized into the SSR HTML payload and sent to every browser that loads the
   Issues section.

### New Considerations Not in Original Plan

- `React.cache()` must be added alongside the limit fix — without it the fix
  doubles the problem (two slow requests instead of two fast ones)
- Server Actions (`'use server'`) are **not** auto-deduplicated by Next.js; only
  `React.cache()` deduplicates them within a render pass
- `httpClientList` uses `cache: 'no-store'`, which also disables Next.js Request
  Memoization — making `React.cache()` the only available deduplication
  mechanism
- The duplicate `getPersons` call in `list/page.tsx` is not just a cleanup item
  — it is a functional bug causing two network requests per page render

---

## Overview

The Assignee (and Author) dropdowns in `SharedFiltersBar` currently show only
the first page of persons returned by `GET /api/v1/persons`. The backend uses
`offset`/`limit` pagination with a **default limit of 10**, meaning only 10
users appear in the dropdown even when the organization has dozens. This causes
a silent data-loss bug: users not in the first page cannot be assigned to
issues.

There are two valid solutions:

| Approach                                                          | Trade-off                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A. Fetch full list at SSR** — pass `limit=100` (backend max)    | Simple, no UI changes. Sufficient for current org sizes (<100 users).  |
| **B. Extend `InputDropdown` with server-side search + lazy load** | More complexity, handles arbitrary org sizes. Reusable across the app. |

**Chosen approach: A** (single request with `limit=100`).

Rationale: The `GET /api/v1/persons` backend max is 100. Organizations with >100
persons are not a current use case. The UX of a fully-populated static dropdown
is better than infinite scroll for a small list. If future scale demands it,
Approach B can be implemented independently.

---

## Problem Statement

### Root Cause

`getPersons()` in `features/issues/api/issues.ts:459` calls:

```ts
const result = await httpClientList<PersonOption>(`${API_URL}/persons`);
return result.data;
```

No `limit` or `offset` params are passed. The backend `PersonRequest` defaults
to `limit=10`. So only 10 persons are ever fetched regardless of org size. The
`totalCount` from the `Items-Count` header is read by `httpClientList` but
discarded — `hasMore` is never checked.

### Compounding Issue: Missing `React.cache()` Causes Duplicate Requests

The function has a second problem beyond the limit: it is called in **both** the
layout and child tab pages within the same render pass, but is not wrapped with
`React.cache()`. Because `httpClientList` sets `cache: 'no-store'`, Next.js
Request Memoization is disabled. Two calls to `getPersons()` = two HTTP requests
to the backend.

`getEpics` in the same file (`issues.ts:363`) is already wrapped with
`React.cache()` precisely for this reason — `getPersons` has the same call
pattern and the same problem.

### Backend Contract

**Endpoint:** `GET /api/v1/persons`  
**FormRequest:** `PersonRequest` uses `PaginatedRequestTrait`

```
offset  — integer, min 0, default 0
limit   — integer, min 1, max 100, default 10
```

**Resource fields** (`PersonResource` extends `UserResource`):

```ts
interface PersonOption {
  id: number;
  name: string;
  email: string; // Backend guarantees string (not nullable)
}
```

The existing `PersonOption` in `entities/issue/model/types.ts:15` has
`email?: string | null` — this is safely permissive (superset of what backend
returns), no change needed.

**Auth rule:** The endpoint returns only users visible to the caller (same org /
same team). Any returned user is a valid `assignee_id` for issue creation.

### Affected Files

| File                                               | Issue                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `features/issues/api/issues.ts:459`                | No pagination params → only 10 users; no `React.cache()` → duplicate requests          |
| `app/dashboard/issues/(tabs)/layout.tsx:23`        | Primary call site — fetches and passes persons to `IssuesLayoutClient`                 |
| `app/dashboard/issues/(tabs)/list/page.tsx:53`     | **Duplicate call** — layout already provides persons; this fires a second HTTP request |
| `app/dashboard/issues/(tabs)/kanban/page.tsx:66`   | Calls `getPersons()` — deduplicated by `React.cache()` after fix                       |
| `app/dashboard/issues/(create)/create/page.tsx:28` | Calls `getPersons()` — separate render context, correct                                |
| `app/dashboard/issues/[id]/page.tsx:65`            | Calls `getPersons()` — separate render context, correct                                |

---

## Proposed Solution

### The Correct Implementation (Minimal + Complete)

The fix is two changes to `features/issues/api/issues.ts`:

1. Add `?limit=100` to the URL
2. Wrap with `React.cache()` — exactly as `getEpics` is done at line 363

```ts
// features/issues/api/issues.ts

// React.cache is already imported at line 5 of this file — no new import needed

export const getPersons = cache(async function getPersons(): Promise<
  PersonOption[]
> {
  const { data } = await httpClientList<PersonOption>(
    `${API_URL}/persons?limit=100`,
  );
  return data;
});
```

That is the entire fix. The `cache()` wrapper deduplicates all call sites within
a single render pass. The `limit=100` ensures the full list is returned.

### Why No Pagination Loop

The multi-page loop (originally proposed) is YAGNI:

- The plan explicitly states >100 users is "not a current use case"
- The backend `max` for `limit` is 100 — a single request returns everyone
- If the loop were included, it adds ~15 lines of dead code that never executes
- When >100 users becomes real, the correct response is server-side search
  (Approach B), not a client-side accumulation loop

### Step 2 — Remove Duplicate Call in `list/page.tsx`

Check `app/dashboard/issues/(tabs)/list/page.tsx:53`. The layout at
`(tabs)/layout.tsx:23` already fetches persons and passes them to
`IssuesLayoutClient`. Verify that `IssuesListTab` receives `persons` from the
layout's props/context, then remove the standalone `getPersons()` call from
`list/page.tsx`.

After adding `React.cache()`, the duplicate call is harmless (same promise
returned), but removing it is cleaner and makes the data flow explicit.

### Step 3 — No UI Changes Needed

`SharedFiltersBar` already works correctly once `persons` prop contains the full
list. The `InputDropdown` with `searchable` provides in-memory filtering which
works fine for ≤100 entries. No changes to `InputDropdown.tsx` are required.

---

## Research Insights

### Performance: Why `React.cache()` Is Critical

`httpClientList` sets `cache: 'no-store'` on every fetch (line 119 of
`shared/lib/httpClient.ts`). This disables **both** Next.js Data Cache and
Request Memoization. Without `React.cache()`, every call site that reaches
`getPersons()` within the same render tree triggers a separate HTTP request to
the backend.

Current render tree for `/dashboard/issues/list`:

```
IssuesTabsLayout (layout.tsx:23)    → getPersons() → HTTP call #1 (10 persons)
IssuesListPage   (list/page.tsx:53) → getPersons() → HTTP call #2 (10 persons — wasted)
```

After fix (with `React.cache()`):

```
IssuesTabsLayout (layout.tsx:23)    → getPersons() → HTTP call #1 (100 persons, cached)
IssuesListPage   (list/page.tsx:53) → getPersons() → returns cached promise — no network call
```

`React.cache()` is scoped per-request (reset on every incoming HTTP request).
There is no stale data risk.

> **Reference:** Next.js 16 docs explicitly state: "Request Memoization strictly
> applies to the fetch API. If you are using a custom HTTP wrapper directly in
> Server Components, React does not automatically deduplicate these queries."
> `React.cache` is the correct workaround.

### TypeScript: Implementation Correctness

The minimal implementation `cache(async function getPersons() { ... })` is
correct. Specific TypeScript notes:

- `const LIMIT = 100 as const` — unnecessary; a `const` on a primitive already
  infers the literal type `100`. Do not add noise.
- `readonly` on `PersonOption` fields — worth adding to the type since it is a
  pure DTO that nothing mutates, but out of scope for this fix.
- The original while-loop's termination condition
  (`while (offset < first.totalCount)` + `if (!page.hasMore) break`) had two
  conflicting exit paths that could behave inconsistently if `totalCount` was
  stale. The single-call approach avoids this entirely.

### Security: Email Serialization to Client HTML

The `PersonOption` interface includes `email?: string | null`. The full persons
list is:

1. Fetched server-side in `layout.tsx`
2. Passed as a prop to `IssuesLayoutClient` (a `'use client'` component)
3. **Serialized into the initial HTML payload** sent to every browser that opens
   Issues
4. Rendered in dropdown labels: `` `${person.name} (${person.email})` ``

This means every org member's email is disclosed to every team member who opens
the Issues section. This is currently a product decision (emails shown to
distinguish same-name users), not a code bug — but it should be a deliberate
choice.

**If emails in dropdowns are not intentional UX**, strip `email` at the
server-action boundary:

```ts
export const getPersons = cache(async function getPersons(): Promise<
  PersonOption[]
> {
  const { data } = await httpClientList<PersonOption>(
    `${API_URL}/persons?limit=100`,
  );
  return data.map(({ id, name }) => ({ id, name })); // strip email
});
```

**If emails are intentional** (current behavior), document the decision
explicitly.

### Architecture: FSD Violation — `getPersons` and `PersonOption` Location

**Current state (incorrect per FSD rules):**

- `PersonOption` defined in `entities/issue/model/types.ts:15`
- `getPersons` defined in `features/issues/api/issues.ts:459`
- `features/kanban/model/types.ts` imports `PersonOption` from
  `@/entities/issue` (wrong domain: kanban depends on issue entity for a person
  type)

**Correct FSD placement:**

`PersonOption` is a person/user domain object — it is used as assignee, author,
and audit actor. It does not belong to the issue entity. The existing
`entities/team/api/team.ts` is the exact template to follow.

**Recommended migration (separate follow-up task, not this PR):**

```
entities/person/
  model/types.ts     # PersonOption (moved from entities/issue/model/types.ts)
  api/persons.ts     # getPersons (moved from features/issues/api/issues.ts)
  index.ts           # public API
```

After migration:

- `entities/issue/model/types.ts` imports `PersonOption` from
  `@/entities/person`
- `features/kanban/model/types.ts` imports from `@/entities/person` (not
  `@/entities/issue`)
- All 5 `app/` pages import `getPersons` from `@/entities/person/api/persons`
- `getPersons` removed from `features/issues/index.ts` public API

Consider also whether `PersonOption` should be unified with `UserBasicProps` in
`entities/user/model/types.ts` — they are structurally nearly identical
(`{ id, name, email }`).

### Next.js Caching Reference (2026)

| Mechanism                   | Scope                            | Applicable here?                   |
| --------------------------- | -------------------------------- | ---------------------------------- |
| `React.cache()`             | Per-request, per render tree     | ✅ Use for `getPersons`            |
| Next.js Request Memoization | Per-request, `fetch` only        | ❌ Disabled by `cache: 'no-store'` |
| `unstable_cache`            | Cross-request (Data Cache)       | ❌ Not needed (user-specific list) |
| `'use cache'` directive     | Cross-request (Cache Components) | ❌ Not enabled in this project     |

---

## Acceptance Criteria

- [x] `GET /api/v1/persons?limit=100` is called instead of the unparameterized
      request
- [x] `getPersons` is wrapped with `React.cache()` — same pattern as `getEpics`
      at line 363
- [x] All 5+ call sites of `getPersons` benefit from deduplication automatically
- [x] The duplicate `getPersons` call in `list/page.tsx` — kept intentionally;
      `IssuesListTab` needs `persons` directly; `React.cache()` ensures single
      HTTP call
- [x] Assignee and Author dropdowns in `SharedFiltersBar` show all org members
- [x] No TypeScript errors; existing `PersonOption` type is unchanged
- [x] `npm run lint` passes
- [x] `npm run build` passes (no TypeScript errors)

---

## Technical Considerations

### `httpClientList` return shape

`shared/lib/httpClient.ts` — `httpClientList<T>` returns:

```ts
{
  data: T[];
  totalCount: number;   // from Items-Count header
  hasMore: boolean;     // data.length < totalCount
}
```

The fix only uses `.data` and ignores `totalCount`/`hasMore` — which is correct
when fetching within a known bound (`limit=100`, org never exceeds 100 users).

### `React.cache()` import

`cache` from React is already imported at line 5 of
`features/issues/api/issues.ts`. No new import is needed.

### No changes to `InputDropdown`

The component already handles lists of arbitrary size. The `searchable` prop
provides sufficient UX for filtering ≤100 items in-memory. No changes needed.

### Duplicate fetch in `list/page.tsx` — verification step

Before removing the `getPersons()` call from `list/page.tsx`, verify that
`IssuesListTab` already receives `persons` through the layout's
`IssuesLayoutClient` (via props or context). If it does, the removal is safe. If
`IssuesListTab` renders persons independently from the page's own fetch result,
understand the data flow first.

---

## Implementation Steps

1. **Open** `features/issues/api/issues.ts`
2. **Replace** `getPersons` with the cached, limit-parameterized version:
   ```ts
   export const getPersons = cache(async function getPersons(): Promise<
     PersonOption[]
   > {
     const { data } = await httpClientList<PersonOption>(
       `${API_URL}/persons?limit=100`,
     );
     return data;
   });
   ```
3. **Verify** `app/dashboard/issues/(tabs)/list/page.tsx` — check if
   `IssuesListTab` already receives `persons` from the layout. If yes,
   **remove** the standalone `getPersons()` call and its prop-threading from
   `list/page.tsx`.
4. **Run** `npm run lint:fix && npm run format`
5. **Run** `npm run build` — verify no TypeScript errors

---

## Out of Scope

- **Pagination loop for >100 users** — YAGNI; not a current use case. If needed
  in future, implement Approach B (server-side search in `InputDropdown`) rather
  than a client-side loop.
- **`entities/person/` extraction** — correct FSD placement, but a separate
  refactor task. Do not mix with this fix.
- **`PersonOption.email` nullability tightening** — compatible as-is; not
  needed.
- **Author dropdown logic** — benefits automatically from the same `persons`
  prop fix.
- **`unstable_cache` for cross-request caching** — persons list is user-specific
  and changes on HR actions; per-request freshness via `React.cache()` is
  appropriate.

---

## Follow-up Tasks (Not Blocking This PR)

1. **`entities/person/` extraction** — move `PersonOption` and `getPersons` to
   `entities/person/` per FSD rules. Template: `entities/team/api/team.ts`.
2. **Email exposure audit** — decide whether `email` in dropdown labels is
   intentional UX or privacy concern. Document the decision or strip the field.
3. **Audit other `httpClientList` calls without `React.cache()`** — `getPersons`
   is not the only function with this pattern. Any function called from both
   layout and page in the same render tree has the duplicate-request problem.

---

## References

### Internal

- `features/issues/api/issues.ts:363` — `getEpics` with `cache()` — exact
  pattern to copy
- `features/issues/api/issues.ts:459` — `getPersons` function to fix
- `features/issues/ui/shared-filters-bar.tsx:22` — `persons: PersonOption[]`
  prop
- `app/dashboard/issues/(tabs)/layout.tsx:23` — primary SSR fetch site
- `app/dashboard/issues/(tabs)/list/page.tsx:53` — duplicate fetch to verify and
  remove
- `shared/lib/httpClient.ts:119` — `cache: 'no-store'` that disables Next.js
  memoization
- `entities/issue/model/types.ts:15` — `PersonOption` interface
- `entities/team/api/team.ts` — FSD template for `entities/person/` migration

### Backend

- `PersonController@index` — `GET /api/v1/persons`
- `PersonRequest` — `offset` (default 0) / `limit` (default 10, max 100)
- `PersonResource` extends `UserResource` — fields: `id`, `name`, `email`

### External

- [Next.js 16: Getting Started — Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js 16: Getting Started — Caching](https://nextjs.org/docs/app/getting-started/caching)
- [Next.js 16: `unstable_cache` API Reference](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
