---
title: 'feat: Add Team / Participant Filters to Meetings Calendar'
type: feat
status: active
date: 2026-05-21
deepened: 2026-05-21
---

# feat: Add Team / Participant Filters to Meetings Calendar

## Enhancement Summary

**Deepened on:** 2026-05-21 **Research agents used:**
kieran-typescript-reviewer, performance-oracle, architecture-strategist,
julik-frontend-races-reviewer, code-simplicity-reviewer, security-sentinel,
pattern-recognition-specialist, document-review
(feasibility/coherence/scope/product), best-practices-researcher,
framework-docs-researcher, solutions-learnings, unit-test-booster,
frontend-design

### Key Improvements

1. **Naming convention fixes** — all types/components renamed to match codebase:
   `MeetingsCalendarFilters`, `MeetingsCalendarFiltersBar`,
   `meetings-calendar-filters-bar.tsx`, `cookieOrgId: string` prop
2. **Type deduplication** — `MeetingsCalendarFilters` defined only in
   `model/filters.ts` as `Pick<MeetingsListFilters, 'team_id' | 'user_id'>`,
   imported into `api/meetings.ts`
3. **Security finding** — backend missing team membership authorization
   (medium); `parseCalendarFilters` must use existing `parseIntParam` helper,
   not re-implement
4. **Race conditions identified** — `useEffect` + server action calls need
   `.catch(toast.error)` and stale-result guards; `organizationId` change must
   synchronously clear `teamUsers`
5. **nuqs library recommended** — replaces manual `URLSearchParams` manipulation
   with type-safe, batch-update, RSC-cache-integrated approach
6. **Performance: initial teams waterfall** — `initialTeams` should be
   prefetched in the RSC page and passed as a prop; eliminates on-mount client
   fetch
7. **FSD non-violation confirmed** — `@/entities/team/api/team` is a valid
   import; no `features/meetings/api/teams.ts` wrapper needed
8. **Design system details** —
   `px-4 py-3 items-end border-b border-border bg-card`, `w-full sm:w-48`
   dropdowns, `Button variant="ghost" size="sm"` for Clear

### New Considerations Discovered

- `Number(sp.team_id) || null` coerces `"0"` → `null` and allows
  `Infinity`/floats — use existing `parseIntParam` which guards with
  `Number.isFinite`
- `clearFilters()` in the component sketch was undefined — must be inline or
  extracted
- `searchParams` in Next.js 15 is `Promise<{...}>` (not optional `?`, always
  present on pages)
- Backend `exists:teams,id` check does not verify team membership — MEDIUM
  security gap
- Participant dropdown empty state (zero users in team) is indistinguishable
  from loading state without explicit `isLoadingTeamUsers` flag
- "No events this month" copy is misleading when a filter is active — consider
  alternate empty state
- org-switch scenario (OrganizationSelector in layout) not covered in acceptance
  criteria
- Each `InputDropdown` must have an "All teams" / "All participants" empty
  option, not just a "Clear filters" button, for per-field deselection

---

## Overview

Add a filter bar to `app/dashboard/meetings/calendar/page.tsx` that lets users
narrow the calendar view by **team** and **participant (user)**. The backend
`GET /api/v1/calendar-events` already supports `team_id` and `user_id` query
params — no backend changes are needed for the personal calendar tab. The org
calendar tab (`/meetings/organization`) is **out of scope** because its backend
endpoint (`GET /api/v1/calendar-events/organization`) does not support these
params.

---

## Background

The Meetings section has three tabs: List, Calendar, Organization Calendar. The
**List** tab already has a full filter bar (`MeetingsListFiltersBar`) supporting
Scope, Team, and Participant via URL search params. The **Calendar** tab
currently accepts only `?month=YYYY-MM-01` — no team or participant filter
exists despite the backend being fully ready.

### What the backend already supports

`GET /api/v1/calendar-events` (`CalendarEventRequest`):

| Param              | Type             | Description                        |
| ------------------ | ---------------- | ---------------------------------- |
| `team_id`          | `integer\|null`  | Filter by team (`exists:teams,id`) |
| `user_id`          | `integer\|null`  | Filter by user (`exists:users,id`) |
| `participant_id`   | `integer\|null`  | Filter by participant row          |
| `date`             | `string` (Y-m-d) | Day to fetch                       |
| `scope`            | `past\|upcoming` | Temporal scope                     |
| `offset` / `limit` | int              | Pagination (max limit 50)          |

The **Organisation** calendar endpoint does **not** support `team_id`/`user_id`
— that's a backend-only effort and is explicitly out of scope here.

---

## Scope

### In scope

- Add `MeetingsCalendarFiltersBar` client component on the personal calendar tab
  (`/dashboard/meetings/calendar`)
- Team dropdown (single-select) — loads teams for active org, prefetched
  server-side as a prop
- Participant dropdown (single-select, dependent on team) — loads team users
  client-side when team changes
- URL-driven state: `?month=...&team_id=...&user_id=...`
- "Clear filters" button when any filter is active
- Per-field "All teams" / "All participants" empty option for individual
  deselection
- Extend `getMeetingsForDate` and `getCalendarEventsForMonth` server actions to
  accept and forward filter params
- Preserve `team_id`/`user_id` in the month-redirect logic (so bookmarked
  filtered URLs work)

### Out of scope

- Organisation calendar tab filter support (requires backend changes)
- `participant_id` param (use `user_id` for consistency with the list tab;
  `participant_id` requires a different dropdown data source)
- `scope` (Upcoming/Past) filter on the calendar tab — the month grid already
  provides temporal context
- Filter persistence across tab switches (list ↔ calendar) — decided: no, keep
  tab URLs independent
- Source filter (Google Calendar, Outlook) — separate feature
- Multi-select team/participant — single-select consistent with the list tab
- nuqs library adoption — the plan documents it as recommended best practice but
  does not require a full migration; manual `URLSearchParams` + `router.replace`
  is acceptable given the existing pattern

---

## Technical Design

### 0. Type Placement — Single Source of Truth

> **Critical: Do NOT define `MeetingsCalendarFilters` inline in
> `api/meetings.ts`.** Types live in `model/` only (CLAUDE.md Rule 6).

**`features/meetings/model/filters.ts`** — add to the existing file:

```ts
// Narrow subset of MeetingsListFilters for calendar view (no scope/offset/limit)
export type MeetingsCalendarFilters = Pick<
  MeetingsListFilters,
  'team_id' | 'user_id'
>;

export function parseCalendarFilters(sp: {
  team_id?: string | string[];
  user_id?: string | string[];
}): MeetingsCalendarFilters {
  // Reuse the EXISTING parseIntParam helper already in this file
  // DO NOT reimplement — parseIntParam uses Number.isFinite guard
  const rawTeam = Array.isArray(sp.team_id) ? sp.team_id[0] : sp.team_id;
  const rawUser = Array.isArray(sp.user_id) ? sp.user_id[0] : sp.user_id;
  return {
    team_id: parseIntParam(rawTeam ?? null),
    user_id: parseIntParam(rawUser ?? null),
  };
}

export function hasActiveCalendarFilters(f: MeetingsCalendarFilters): boolean {
  return f.team_id != null || f.user_id != null;
}
```

> `parseIntParam` already exists in `filters.ts` and uses `Number.isFinite` —
> this guards against `"Infinity"`, floats, and `"0"` being coerced incorrectly.
> Never reimplement this logic.

Update `features/meetings/index.ts` to export the new type and helpers.

### 1. API Layer Changes

**`features/meetings/api/meetings.ts`**

Import `MeetingsCalendarFilters` from `../model/filters`, then extend two
existing functions:

```ts
import type { MeetingsCalendarFilters } from '../model/filters';

// Before
async function getMeetingsForDate(date: Date): Promise<CalendarEventListItem[]>;
async function getCalendarEventsForMonth(
  month: string,
): Promise<CalendarEventListItem[]>;

// After
async function getMeetingsForDate(
  date: Date,
  filters?: MeetingsCalendarFilters,
): Promise<CalendarEventListItem[]>;

async function getCalendarEventsForMonth(
  month: string,
  filters?: MeetingsCalendarFilters,
): Promise<CalendarEventListItem[]>;
```

`getMeetingsForDate` appends filter params using the existing `URLSearchParams`
pattern (NOT `new URL()`):

```ts
// Match the existing codebase pattern — URLSearchParams, not new URL()
const params = new URLSearchParams({
  date: toDateParam(date), // use the EXISTING toDateParam helper, not date-fns format()
  limit: '50',
});
if (filters?.team_id != null) params.set('team_id', String(filters.team_id));
if (filters?.user_id != null) params.set('user_id', String(filters.user_id));
const { data } = await httpClientList<CalendarEventListItem>(
  `${API_URL}/calendar-events?${params.toString()}`,
);
```

> Use `toDateParam()` (already in `meetings.ts`) not `format()` from date-fns.
> The codebase deliberately avoids date-fns imports in server action files.

`getCalendarEventsForMonth` forwards `filters` to every `getMeetingsForDate`
call in the parallel fan-out. Existing callers (`getMeetingsForThreeDays`,
previous calendar page call) pass no `filters` arg — the optional param defaults
to `undefined` safely.

### 2. Page Layer Changes

**`app/dashboard/meetings/calendar/page.tsx`**

In Next.js 15, `searchParams` is **always a `Promise<{...}>` and is never
optional**:

```ts
// Correct Next.js 15 type — NOT optional, IS a Promise
type CalendarPageProps = {
  searchParams: Promise<{
    month?: string;
    attached?: string;
    team_id?: string;
    user_id?: string;
  }>;
};
```

Fix the redirect to preserve filter params AND the `attached` flag:

```ts
// Before — drops filter params
redirect(`${ROUTES.DASHBOARD.MEETINGS_CALENDAR}?month=${currentMonth}`);

// After — preserve all relevant params
const redirectParams = new URLSearchParams({ month: currentMonth });
if (params.team_id) redirectParams.set('team_id', params.team_id);
if (params.user_id) redirectParams.set('user_id', params.user_id);
// Note: do NOT carry 'attached' — it's a one-time toast trigger
redirect(`${ROUTES.DASHBOARD.MEETINGS_CALENDAR}?${redirectParams}`);
```

Prefetch initial teams server-side to eliminate the client-side waterfall:

```ts
const organizationId = await getOrganizationId(); // string from cookie
const calendarFilters = parseCalendarFilters(params);

// Prefetch teams server-side — no client-side waterfall on mount
const [eventsResult, teamsResult] = await Promise.all([
  getCalendarEventsForMonth(month, calendarFilters),
  getTeams(organizationId),       // from @/entities/team/api/team
]);
const initialTeams = teamsResult.data ?? [];

// In JSX:
<Suspense fallback={<div className="h-[57px] border-b border-border bg-card" />}>
  <MeetingsCalendarFiltersBar
    filters={calendarFilters}
    cookieOrgId={organizationId}     // string, matches MeetingsListFiltersBar pattern
    initialTeams={initialTeams}
  />
</Suspense>
<CalendarPage currentMonth={month} events={eventsResult} />
```

> The Suspense fallback height (`h-[57px]`) must match the filter bar's actual
> rendered height (`py-3` + `h-10` content + `border-b` = ~57px) to prevent
> layout shift.

### 3. New Component: `MeetingsCalendarFiltersBar`

**`features/meetings/ui/meetings-calendar-filters-bar.tsx`**

> **Naming**: `MeetingsCalendarFiltersBar` (not `CalendarFiltersBar`) to match
> the `MeetingsListFiltersBar` naming family. **FSD**: Import
> `getTeams`/`getTeamUsers` from `@/entities/team/api/team` — this is a valid
> FSD import (`features → entities`). No wrapper file needed.

```ts
'use client';

import { useTransition, useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getTeamUsers } from '@/entities/team/api/team';
import { InputDropdown } from '@/shared/ui/input/InputDropdown';
import { Button } from '@/shared/ui/button/button';
import { toast } from 'sonner';
import type { MeetingsCalendarFilters } from '../model/filters';
import { hasActiveCalendarFilters } from '../model/filters';
import type { TeamProps } from '@/entities/team/model/types';

interface Props {
  filters: MeetingsCalendarFilters;
  cookieOrgId: string;              // string — matches getOrganizationId() return type
  initialTeams: TeamProps[];        // prefetched server-side, no client waterfall
}

export function MeetingsCalendarFiltersBar({
  filters,
  cookieOrgId: _cookieOrgId,        // kept for future org-change handling
  initialTeams,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [teamUsers, setTeamUsers] = useState<Array<{ value: string; label: string }>>([]);
  const [isLoadingTeamUsers, setIsLoadingTeamUsers] = useState(false);

  // Load team users when team_id changes (client-side only — team list is prefetched as prop)
  useEffect(() => {
    if (!filters.team_id) {
      setTeamUsers([]);
      return;
    }
    let cancelled = false;
    setIsLoadingTeamUsers(true);
    setTeamUsers([]); // clear immediately to prevent stale options from previous team
    getTeamUsers(filters.team_id)
      .then((result) => {
        if (cancelled) return;
        setTeamUsers(
          (result.data ?? []).map((u) => ({
            value: String(u.user_id ?? u.id),
            label: u.user?.name ?? u.user?.email ?? String(u.id),
          })),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : 'Failed to load participants');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTeamUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.team_id]);

  function updateFilter(
    key: 'team_id' | 'user_id',
    value: string,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
      if (key === 'team_id') {
        params.delete('user_id'); // reset dependent participant when team changes
      }
    } else {
      params.delete(key);
      if (key === 'team_id') params.delete('user_id');
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('team_id');
    params.delete('user_id');
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const teamOptions = [
    { value: '', label: 'All teams' },
    ...initialTeams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  const participantOptions = [
    { value: '', label: 'All participants' },
    ...teamUsers,
  ];

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border bg-card">
      <div className="w-full sm:w-48">
        <InputDropdown
          label="Team"
          value={filters.team_id != null ? String(filters.team_id) : ''}
          options={teamOptions}
          onChange={(v) => updateFilter('team_id', v as string)}
          disabled={isPending}
        />
      </div>

      <div
        className="w-full sm:w-48"
        title={!filters.team_id ? 'Select a team first' : undefined}
      >
        <InputDropdown
          label="Participant"
          value={filters.user_id != null ? String(filters.user_id) : ''}
          options={participantOptions}
          onChange={(v) => updateFilter('user_id', v as string)}
          disabled={isPending || !filters.team_id || isLoadingTeamUsers}
        />
      </div>

      {hasActiveCalendarFilters(filters) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth={false}
          onClick={clearFilters}
          disabled={isPending}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
```

> **Why `initialTeams` as a prop (not `useEffect` fetch):** Fetching teams on
> mount causes a waterfall — the server component already has `organizationId`
> and can fetch teams in the same `Promise.all` as the events. Teams are stable
> data (rarely change mid-session). Passing as a prop eliminates a full
> browser→Next.js→backend round-trip from the critical rendering path.

> **Why `isLoadingTeamUsers` separate from team array length:**
> `teams.length === 0` cannot distinguish between "loading" and "team has no
> users". The explicit boolean gives correct disabled state and prevents the
> dropdown from looking broken for empty teams.

> **Error handling in `useEffect`:** All server action calls from Client
> Components must use `.catch()` — unhandled rejected promises do not surface to
> React error boundaries. Use `toast.error()` following project conventions.

### 4. Organization ID Sourcing

The page already calls `getOrganizationId()` — pass the result as
`cookieOrgId: string` to `MeetingsCalendarFiltersBar`. This matches the exact
pattern used by `MeetingsListFiltersBar` which also receives
`cookieOrgId: string` from its page. Do not read cookies client-side.

---

## Files to Create / Modify

| File                                                     | Action | Change                                                                                                             |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `features/meetings/model/filters.ts`                     | Modify | Add `MeetingsCalendarFilters` (as `Pick`), `parseCalendarFilters`, `hasActiveCalendarFilters`                      |
| `features/meetings/api/meetings.ts`                      | Modify | Extend `getMeetingsForDate` + `getCalendarEventsForMonth` with optional `MeetingsCalendarFilters` param            |
| `features/meetings/ui/meetings-calendar-filters-bar.tsx` | Create | New client component                                                                                               |
| `features/meetings/index.ts`                             | Modify | Export `MeetingsCalendarFilters`, `parseCalendarFilters`, `hasActiveCalendarFilters`, `MeetingsCalendarFiltersBar` |
| `app/dashboard/meetings/calendar/page.tsx`               | Modify | Read `team_id`/`user_id` searchParams, prefetch teams, pass to API + filter bar; fix redirect to preserve params   |

> **NOT needed:** `features/meetings/api/teams.ts` — `@/entities/team/api/team`
> is already the correct import path (used by `MeetingsListFiltersBar`). No FSD
> violation exists.

---

## Acceptance Criteria

### Functional

- [ ] Team dropdown appears above the calendar grid; options are prefetched
      server-side (no loading spinner on mount)
- [ ] Selecting a team re-renders the calendar with only that team's events
- [ ] Participant dropdown is disabled until a team is selected (`title` tooltip
      explains why)
- [ ] Selecting a participant further narrows events (AND logic with team
      filter)
- [ ] "Clear filters" button appears when `team_id` or `user_id` is set;
      clicking it removes both from URL
- [ ] Each dropdown has an "All teams" / "All participants" first option for
      individual deselection
- [ ] Navigating to the next/previous month preserves active filters in the URL
- [ ] Hard-refreshing `?month=2026-05-01&team_id=42` renders the same filtered
      result server-side
- [ ] Changing team clears participant selection (both from URL and from
      participant dropdown state)
- [ ] Calendar with no matching events shows empty state
- [ ] The org calendar tab (`/meetings/organization`) is unaffected
- [ ] When org is switched via the layout OrganizationSelector,
      `team_id`/`user_id` are effectively stale — the page re-renders with the
      new org's events regardless (existing behavior is acceptable since team
      IDs are org-scoped and the backend query is user-scoped)

### Non-functional

- [ ] No TypeScript errors (`npm run build` passes)
- [ ] No ESLint errors (`npm run lint` passes)
- [ ] No FSD violations — `MeetingsCalendarFiltersBar` imports only from
      `entities/`, `shared/`, and its own feature
- [ ] Filter bar renders correctly on mobile (dropdowns stack full-width below
      `sm` breakpoint)
- [ ] `<Suspense>` fallback height matches filter bar height (no layout shift)

### Edge Cases

- [ ] `?team_id=abc` (non-numeric) → `parseIntParam` returns `null`, unfiltered
      calendar shown
- [ ] `?team_id=9999` (non-existent team) → backend returns 422 → `ServerError`
      surfaces via error boundary
- [ ] `?team_id=Infinity` or `?team_id=1.5` → `parseIntParam`'s
      `Number.isFinite` + `Number.isInteger` guards return `null`
- [ ] Calendar not attached (onboarding state) → filter bar not rendered
- [ ] Team with zero meetings → all day cells empty, "clear filters" visible
- [ ] Team with zero users → participant dropdown shows "All participants" only,
      no crash
- [ ] `getTeamUsers` network error → `toast.error()` shown, participant dropdown
      stays empty

---

## User Flows

```
1. Select team
   User opens Team dropdown → selects "Engineering"
   → URL: ?month=2026-05-01&team_id=42
   → Page re-renders (RSC), calendar shows Engineering meetings only

2. Select participant
   Team = Engineering selected → Participant dropdown enabled (team users load client-side)
   User selects "Alice"
   → URL: ?month=2026-05-01&team_id=42&user_id=7
   → Calendar shows Alice's Engineering meetings

3. Deselect participant individually
   User opens Participant dropdown → selects "All participants"
   → URL: ?month=2026-05-01&team_id=42
   → Back to full Engineering view

4. Navigate months with active filter
   User clicks → May → June
   → URL: ?month=2026-06-01&team_id=42
   → Filter preserved, June rendered for Engineering

5. Clear all filters
   User clicks "Clear filters"
   → URL: ?month=2026-05-01
   → Full unfiltered calendar

6. Direct URL / bookmark
   User opens ?month=2026-05-01&team_id=42&user_id=7
   → Server renders filtered; filter bar shows pre-selected values; team users load on mount

7. Change team (resets participant)
   Team = "Engineering" (team_id=42), Participant = "Alice" (user_id=7)
   User changes to "Product"
   → URL: ?month=2026-05-01&team_id=15 (user_id removed)
   → Participant dropdown clears and loads Product team users
```

---

## Open Questions

| #   | Question                                                                           | Default Decision                                                                    |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Should `participant_id` param be exposed, or only `user_id`?                       | Use `user_id` — consistent with list tab; dropdown options are team members         |
| 2   | Should `scope` (Upcoming/Past) be on the calendar filter bar?                      | No — month grid gives visual temporal context                                       |
| 3   | Should tab switches (Calendar ↔ List) carry `team_id`/`user_id` across?           | No — keep tab URLs independent                                                      |
| 4   | Invalid `team_id` that fails backend 422 — show error boundary or silently ignore? | Let `ServerError` surface (error boundary)                                          |
| 5   | Empty calendar with active filter — change copy to "No events match this filter"?  | Recommended: yes (more accurate UX); plan currently says no but this is revisitable |
| 6   | nuqs adoption — migrate filter state management to nuqs for type-safe batching?    | Out of scope for this PR; document as recommended follow-up                         |

---

## Dependencies & Risks

| Risk                                                                         | Severity   | Mitigation                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend missing team membership check on `team_id` param                     | **Medium** | `exists:teams,id` only validates existence, not membership. A user can pass any team_id and enumerate meeting overlap. **Backend fix required (separate PR):** add `$this->authorize('view', $team)` in `CalendarEventController::index()`. Frontend defense-in-depth: cross-check `team_id` against `initialTeams` prop before forwarding. |
| `parseCalendarFilters` reimplements `parseIntParam` incorrectly              | High       | Use existing `parseIntParam` — its `Number.isFinite` guard handles `Infinity`, floats, `NaN`. The naive `Number(x) \|\| null` coerces `"0"` → null and admits `Infinity`.                                                                                                                                                                   |
| Unhandled promise rejection in `useEffect` for `getTeamUsers`                | High       | Always use `.catch(toast.error)` — rejected promises in `useEffect` do not surface to React error boundaries                                                                                                                                                                                                                                |
| Server action returns HTML instead of JSON (documented in `docs/solutions/`) | Medium     | Both `getTeams` and `getTeamUsers` route through `httpClient` which already calls `res.text()` before `res.json()` on error paths. Do NOT copy the raw-fetch pattern from `features/teams/api/team.ts`.                                                                                                                                     |
| Stale `teamUsers` after team change                                          | Low        | Call `setTeamUsers([])` immediately before the fetch (already in the component sketch above)                                                                                                                                                                                                                                                |
| MonthSwitcher not preserving filter params                                   | Low        | Confirmed safe: `month-switcher.tsx` uses `new URLSearchParams(params)` — clones all existing params                                                                                                                                                                                                                                        |
| `getAuthHeaders()` called 31× in fan-out                                     | Low        | Pre-existing issue; hoisting auth resolution above `Promise.all` is a future optimization, not a blocker                                                                                                                                                                                                                                    |
| `searchParams` type wrong (optional or synchronous)                          | Low        | In Next.js 15 it is a non-optional `Promise<{...}>` — do not use `?:` on the type                                                                                                                                                                                                                                                           |
| `useSearchParams()` without Suspense causes build failure on static routes   | Low        | Wrap `MeetingsCalendarFiltersBar` in `<Suspense>` in the page (already in plan)                                                                                                                                                                                                                                                             |

---

## Security Notes

### Medium — Backend team membership authorization gap

`GET /api/v1/calendar-events?team_id=X` only validates `X` exists in `teams`
table globally (`exists:teams,id`). It does not verify the requesting user is a
member of team X. The base query is scoped to the authenticated user's own
events, so the attacker sees only their own events — but the _presence or
absence of results_ reveals whether they share meetings with members of a team
they are not part of.

**Backend fix (separate PR):**

```php
// CalendarEventController::index()
if ($teamId = $request->getTeamId()) {
    $team = Team::findOrFail($teamId);
    $this->authorize('view', $team); // TeamPolicy::view() checks isTeamMember
}
```

**Frontend defense-in-depth:** Before forwarding `team_id` to the API, validate
it is present in `initialTeams`:

```ts
const validTeamId =
  calendarFilters.team_id != null &&
  initialTeams.some((t) => t.id === calendarFilters.team_id)
    ? calendarFilters.team_id
    : null;
```

---

## Test Strategy

### Pure function tests (highest ROI — zero mocks needed)

**`features/meetings/model/__tests__/filters.test.ts`** — add:

```ts
// parseCalendarFilters
it('returns null for both when params absent');
it('parses numeric team_id string');
it('parses numeric user_id string');
it('returns null for non-numeric team_id ("abc")');
it('returns null for Infinity / float strings');
it('returns null for empty string team_id');

// hasActiveCalendarFilters
it('returns false when both null');
it('returns true when team_id set');
it('returns true when user_id set');
it('returns true when both set');
```

### Server action tests

**`features/meetings/api/__tests__/meetings.test.ts`** — add:

```ts
// getMeetingsForDate with filters
it('does not append team_id when filter is null');
it('appends team_id=42 when filter.team_id = 42');
it('appends user_id=7 when filter.user_id = 7');
it('does not serialize null values as "null" string');
```

### Component tests

**`features/meetings/ui/__tests__/meetings-calendar-filters-bar.test.tsx`** —
new:

```ts
// Mock: next/navigation (useRouter, useSearchParams, usePathname), entities/team/api/team, sonner
it('calls getTeamUsers on mount when team_id in URL');
it('renders team options from initialTeams prop');
it('clears user_id param when team changes');
it('shows Clear filters button when team_id in URL');
it('hides Clear filters button when no active filters');
it('calls toast.error when getTeamUsers rejects');
it('disables Participant dropdown when no team selected');
it('disables Participant dropdown while loading team users');
```

---

## Design System Details

### Filter bar container

```tsx
<div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border bg-card">
```

- `py-3` (not `py-2`) — floating labels on `InputDropdown` need vertical room
- `items-end` (not `items-center`) — floating-label dropdowns align to bottom
  edge
- `border-b border-border bg-card` — standard section separator with elevated
  surface

### Dropdown widths

```tsx
<div className="w-full sm:w-48">
  <InputDropdown ... />
</div>
```

- `w-full` on mobile — full-width stacked
- `sm:w-48` (192px) on tablet+ — side by side in one row

### "Clear filters" button

```tsx
<Button
  type='button'
  variant='ghost'
  size='sm'
  fullWidth={false}
  onClick={clearFilters}
>
  Clear filters
</Button>
```

- `variant="ghost"` — unobtrusive secondary action
- `size="sm"` — shorter than `h-10` dropdowns, correct visual hierarchy

### Suspense fallback height

```tsx
<Suspense fallback={<div className="h-[57px] border-b border-border bg-card" />}>
```

Matches `py-3` (12px) + `h-10` (40px) content + `border-b` (1px) = ~57px.

---

## References

### Internal

- `features/meetings/ui/meetings-list-filters-bar.tsx` — direct template
  (naming, patterns, org-id prop)
- `features/meetings/model/filters.ts` — `parseIntParam`, `MeetingsListFilters`,
  `hasActiveFilters`
- `features/meetings/api/meetings.ts` — `toDateParam`, `URLSearchParams` pattern
- `app/dashboard/meetings/calendar/page.tsx` — page to modify
- `app/dashboard/meetings/list/page.tsx` — how `cookieOrgId` + `initialTeams`
  prefetch should be structured
- `entities/team/api/team.ts` — `getTeams`, `getTeamUsers` (valid FSD import)
- `shared/ui/input/InputDropdown.tsx` — dropdown component with disabled state
- `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
  — always use httpClient, never raw fetch + res.json()
- `docs/plans/2026-05-21-fix-meetings-org-filter-sync-plan.md` — adjacent bug
  fix; coordinate to avoid conflicts

### Backend

- `app/Http/Requests/API/v1/CalendarEventRequest.php` — validated params
  (`team_id`, `user_id`, `participant_id`, `date`)
- `app/Http/Controllers/API/v1/CalendarEventController.php` — filter WHERE
  clauses already implemented
- `app/Policies/TeamPolicy.php` — `view()` method to use in the backend
  authorization fix

### Best practices

- [nuqs — type-safe URL state for Next.js](https://nuqs.dev/) — recommended for
  future filter state management
- [Next.js 15 searchParams — always a Promise](https://nextjs.org/docs/messages/sync-dynamic-apis)
- [useSearchParams Suspense requirement](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout)
