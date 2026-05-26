---
title:
  'Teams Feature Deep Audit: Contract Sync, Dead Code, Design System & Bug Fixes'
type: refactor
status: completed
date: 2026-05-22
deepened: 2026-05-22
---

# Teams Feature Deep Audit

> Deep analysis of `app/dashboard/teams` covering backend contract alignment,
> dead code removal, design system compliance, bug fixes, and missing backend
> feature exposure.

## Enhancement Summary

**Deepened on:** 2026-05-22 **Research agents used:** TypeScript reviewer,
security sentinel, performance oracle, architecture strategist, race-condition
reviewer, code simplicity reviewer, correctness verifier, adversarial/pattern
reviewer, test coverage analyzer, Next.js 16 docs researcher, A11y researcher,
institutional learnings

### Key Improvements from Research

1. **Factual correction** — `apiResource` registers **both** PUT and PATCH (not
   PATCH only), so the PUT→PATCH fix is a no-op. Drop or deprioritize it.
2. **Factual correction** — `deleteCompletely` only deletes `team_user` pivot
   rows and the team record — NOT all team data (meetings, issues, invites
   remain). The plan overstated this.
3. **New critical bug found** — `DecisionsPage` has a stale-result race
   condition on search (out-of-order Server Action responses can overwrite fresh
   data).
4. **New critical bug found** — `TemplatesTab` flashes old team's templates when
   switching teams (stale state between teamId changes).
5. **New performance issue** — `Promise.allSettled` blocks ALL streaming. The
   five calls block the entire SSR response until the slowest one settles.
   Tab-specific data (templates) should be conditionally loaded.
6. **FSD violation in plan** — Proposed `MeetingKeyPoint` import from
   `features/decisions` into `features/teams` is illegal under FSD. Fix: create
   `entities/meeting/` entity — deferred until second consumer exists.
7. **YAGNI** — Methodology chip, Key Points viewer, `entities/meeting/` creation
   (no current cross-feature consumers), `viewer-role.ts` extraction
   (one-liner), and Bug #7 Option B (conditional SSR for templates) dropped from
   plan.
8. **Test blast radius** — `deleteTeam` return type change breaks 3 files;
   `createTeam` migration breaks 5 test cases. Plan now includes explicit test
   update steps.
9. **`unstable_cache` for `getTelegramChats` — DROPPED** — global cache key
   `['telegram-chats']` is a cross-user data leak in multi-tenant context (User
   A's bearer token served to User B at cache hit). Requires per-org/session key
   scoping before implementation.
10. **Architecture** — `isManager` fix is a one-liner
    (`viewerMember?.role === 'manager'`); inlined in `page.tsx`. Dedicated
    `viewer-role.ts` file is YAGNI for a single boolean expression.

### New Considerations Discovered

- `TeamMember` is currently a **private unexported** interface — it must be
  exported before adding `role`
- `organization_id` must remain a parameter in `createTeam` (plan snippet
  omitted it, causing a silent regression)
- Static tab content components as `React.ReactNode` slots — **DROPPED**:
  pre-rendering all four slots unconditionally removes the current conditional
  rendering (`activeTab === 'status' && ...`), causing a performance regression
  (all four execute even when user is on Decisions tab)
- `useTeamsStore.getState().invalidate()` is also called from
  `team-create-form.tsx` (not just dead component files) — this call must be
  removed **before** deleting `teams-store.ts` (step ordering dependency)
- `cancel-invite` confirmation is YAGNI — reversible, low-consequence action.
  Dropped.
- `updateTeam` also missing `Content-Type: application/json` header — fix
  alongside `createTeam` in Phase B
- Phase C step 23 depends on Phase A step 2 (`role` field on `TeamMember`) —
  must not be executed before Phase A completes

---

## Overview

The Teams feature (`app/dashboard/teams`) is one of the most complex in the
codebase — it comprises 7 dashboard tabs, 5 parallel SSR data fetches, 4 API
files, 30+ exported components, and touches both the `features/teams/` and
`entities/team/` FSD layers. This plan captures a comprehensive audit across all
dimensions: API contract alignment, dead code, design system consistency, bugs,
and backend features not yet exposed in the UI.

---

## Scope of Work

### 1. Backend Contract Mismatches (TypeScript ↔ Laravel Resources)

#### 🔴 Critical — Missing `role` field on `TeamMember` + missing export

**File:** `entities/team/model/types.ts:8-12`

Backend `TeamResource.toArray()` always includes `members[].role` (set to
`user.organization_role` from a JOIN in `TeamController::show()`). The value is
a `UserRole` enum: `'manager' | 'employee'`.

`TeamMember` is currently a **private unexported** interface. Consumers must use
`TeamProps['members'][number]` as a workaround. Both issues need fixing
together.

**Fix:**

```ts
// entities/team/model/types.ts
export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'manager' | 'employee';
}

export interface TeamProps extends TeamCreateDTO {
  id: number;
  slug: string;
  employee_count: number;
  members: TeamMember[];
}
```

Then re-export `TeamMember` from `entities/team/index.ts`.

> **Note:** `members[].role` is only present on `show()` (single team), not on
> `index()` (team list). The list response omits the entire `members` array
> since `users` relation is not loaded. The type is safe because `TeamMember[]`
> only appears in contexts where `show()` was called.

> **Research insight:** Do NOT use a TypeScript enum for `role`. A string union
> `'manager' | 'employee'` is idiomatic, erased at compile time, and directly
> matches the Laravel backed-enum string values.

#### 🟡 Medium — ~~`updateTeam` uses `PUT` but backend route is `PATCH`~~

**⚠️ FACTUAL CORRECTION FROM RESEARCH:** Laravel's `apiResource` macro registers
**both** `PUT` and `PATCH` via
`$this->router->match(['PUT', 'PATCH'], $uri, $action)`. The frontend sending
`PUT` is valid and hits the same controller method. **This fix is a no-op — skip
it.**

#### 🟡 Medium — `DashboardMeetingCard` nullable fields typed as non-nullable

**File:** `features/teams/model/dashboard-types.ts`

| Field      | Current type | Correct type     |
| ---------- | ------------ | ---------------- |
| `platform` | `string`     | `string \| null` |
| `ends_at`  | `string`     | `string \| null` |

Backend `CalendarEvent.platform` and `ends_at` can both be null.

> **Research insight — downstream crash:**
> `team-dashboard-tab-readiness.tsx:106` calls `.replace('_', ' ')` on
> `data.meeting.platform` directly. Once this type is widened to
> `string | null`, TypeScript will surface this crash site. Every consumer of
> `platform` must use a null guard:
>
> ```tsx
> {
>   data.meeting.platform !== null && (
>     <span className='capitalize'>
>       {data.meeting.platform.replace('_', ' ')}
>     </span>
>   );
> }
> ```

#### 🟢 Low — `RiskItem.severity` includes phantom `'low'` value

**File:** `features/teams/model/dashboard-types.ts`

Backend only emits `'high' | 'medium'` for risk severity. Frontend union
includes `'low'`. Not a bug but a misleading type.

#### ~~🟢 Low — `TeamUserRecord` missing `teams` field~~ — **DROPPED (YAGNI)**

Zero consumers exist for this field. Do not add it speculatively.

---

### 2. API Layer Violations (Raw `fetch` instead of `httpClient`)

**File:** `features/teams/api/team.ts`

Four functions violate CLAUDE.md API Rule 2 by using raw `fetch` + manual
`getAuthHeaders()`:

| Function         | Issue                                            | Fix                                                           |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `getTeams`       | Raw fetch, manual auth                           | Replace with `httpClientList<TeamProps>`                      |
| `loadTeamsChunk` | Raw fetch, pagination manually assembled         | **Delete** (dead code, see §3)                                |
| `createTeam`     | Raw fetch, non-standard return `{ error, data }` | Replace with `httpClient` + `ActionResult<TeamProps>` pattern |
| `deleteTeam`     | Raw fetch, returns raw text on error             | Replace with `httpClient` + `ActionResult<void>`              |

**Fix for `createTeam`** — standardize to `ActionResult<TeamProps>`:

> **Research insight — missing `organization_id`:** The `createTeam` function
> takes `organizationId: string` as first argument because the backend requires
> `organization_id` in the POST body. Keep this parameter — the proposed
> refactor must not drop it. The full correct signature:

```ts
// features/teams/api/team.ts
export async function createTeam(
  organizationId: string,
  payload: TeamCreateDTO,
): Promise<ActionResult<TeamProps>> {
  try {
    const { data } = await httpClient<TeamProps>(`${API_URL}/teams`, {
      method: 'POST',
      body: JSON.stringify({ organization_id: organizationId, ...payload }),
      headers: { 'Content-Type': 'application/json' },
    });
    revalidatePath('/dashboard/teams');
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create team',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}
```

> **Research insight — institutional learning:** The server-action JSON parse
> learning
> (`docs/solutions/integration-issues/server-action-html-response-json-parse.md`)
> applies to `loadTeamsChunk` (calls `res.json()` unconditionally) and
> `createTeam` (success path uses `res.json()`). Migrating to `httpClient`
> eliminates this risk on the error path (the common case). The
> `Content-Type: application/json` header **must** be explicitly included —
> `httpClient` does not add it automatically.

**Fix for `deleteTeam`** — standardize to `ActionResult<void>`:

```ts
export async function deleteTeam(id: number): Promise<ActionResult<void>> {
  try {
    await httpClient<void>(`${API_URL}/teams/${id}`, { method: 'DELETE' });
    revalidatePath('/dashboard/teams');
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete team',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}
```

> **Research insight — blast radius for `deleteTeam`:** Changing the return type
> from `string | undefined` to `ActionResult<void>` breaks 3 files:
>
> - `features/teams/ui/team-actions.tsx` — `if (error)` must change to
>   `if (result.error)`
> - `features/teams/ui/__tests__/team-actions.test.tsx` — 3 mock return values
>   need updating
> - `features/teams/api/__tests__/team.test.ts` — 3 assertions change from
>   `expect(result).toBe(string)` to `expect(result.error).toBe(string)`

**Fix for `getTeams`** — standardize to `httpClientList`:

```ts
export const getTeams = async (organizationId: number | string) => {
  return httpClientList<TeamProps>(
    `${API_URL}/organizations/${organizationId}/teams?limit=100`,
  );
};
```

> **Research insight — limit 10→100:** Fetching 100 records is acceptable
> (payload ~15-30KB). `InputDropdown` in `TeamsHeader` already has
> `searchable={options.length > 5}` for client-side filtering. 100 is sufficient
> for 99% of customers. Server-side search should only be implemented if an org
> actually reaches 100 teams (Tier 2, defer). Do NOT set limit=10 again.

---

### 3. Dead Code Removal

The following components and functions are exported but never rendered in any
route or widget:

| Code                       | File                                                                    | Dead since           | Evidence                                                                                           |
| -------------------------- | ----------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `TeamList`                 | `features/teams/ui/team-list.tsx`                                       | Single-page redesign | Not imported in any `app/` page or widget                                                          |
| `TeamItem`                 | `features/teams/ui/team-item.tsx`                                       | Same                 | Only imported by `TeamList`                                                                        |
| `TeamActions`              | `features/teams/ui/team-actions.tsx`                                    | Same                 | Only imported by `TeamItem`                                                                        |
| `loadTeamsChunk`           | `features/teams/api/team.ts`                                            | Same                 | Only called by `TeamList` via `useTeamsStore`                                                      |
| `useTeamsStore`            | `features/teams/model/teams-store.ts`                                   | Same                 | Only consumed by dead `TeamList`                                                                   |
| `store invalidation calls` | `features/teams/api/team.ts` + `features/teams/ui/team-create-form.tsx` | Same                 | Store has no consumers — `team-create-form.tsx` also calls `useTeamsStore.getState().invalidate()` |

> **Research insight — correct deletion sequence (prevents TypeScript errors
> mid-process):**
>
> 1. Delete test files first: `team-list.test.tsx`, `team-item.test.tsx`,
>    `team-actions.test.tsx`, `teams-store.test.ts`
> 2. Remove `TeamList` export from `features/teams/index.ts` (compiler
>    immediately surfaces any missed consumers)
> 3. Delete `team-list.tsx`, `team-item.tsx`, `team-actions.tsx` (any order —
>    linear chain)
> 4. Delete `teams-store.ts` last (leaf dependency)
> 5. Remove `loadTeamsChunk` from `api/team.ts` and its export from `index.ts`
> 6. Remove `useTeamsStore.getState().invalidate()` from `team-create-form.tsx`
> 7. Run `npm run build` to confirm zero TypeScript errors

> **Research insight — `TeamActions` note:** Since `TeamActions` is dead code
> being deleted, Bug #3 (add confirmation dialog to `deleteTeam` call) applies
> only if `deleteTeam` is called from elsewhere. Verify with
> `grep -r "deleteTeam" --include="*.tsx" .` — if the only call is in dead
> `TeamActions`, the confirmation dialog may not be needed in the current UI.

> **Coverage risk:** Deleting ~551 lines of tests for dead code may lower
> coverage. Current thresholds are low (branches: 20%, functions: 24%) — verify
> with `npm test -- --coverage --ci` after deletion.

---

### 4. Bugs & Edge Cases

#### 🔴 Bug #1 — `isManager` detection is structurally broken

**File:** `app/dashboard/teams/page.tsx:97`

**Current (wrong):**

```ts
const viewerMember = team?.members?.find((m) => m.id === viewer?.id);
const isManager = viewerMember !== null;
```

`viewerMember !== null` is always `true` (even `undefined !== null`). After
Phase A adds `role` to `TeamMember`, fix inline in `page.tsx`:

```ts
const viewerMember = team?.members?.find((m) => m.id === dashboard?.viewer.id);
const isManager = viewerMember?.role === 'manager';
```

> **Note:** No new file needed — this is a one-line fix. The "extract to
> `viewer-role.ts`" approach was evaluated and dropped as YAGNI: a single
> boolean expression doesn't warrant a dedicated model file. If this logic grows
> or a second caller appears, extraction can happen then.

> **Remaining limitation:** Org-level managers who are not in `team.members` at
> all still get `isManager=false`. Full fix requires backend to expose
> `viewer.is_manager: boolean` in `TeamDashboardService::build()`. Until then,
> this is the best frontend-only fix.

> **Dependency:** This step requires Phase A step 2 (`role` field added to
> `TeamMember`) to be complete before it can compile.

#### 🔴 Bug #2 — `TeamMemberAddForm` reads `team_id` from URL instead of props

**File:** `features/teams/ui/team-member-add-form.tsx`

The form calls `useSearchParams().get('team_id')` to get the team ID. The parent
already has `teamId: number` in scope.

**Fix:** Thread `teamId: number` as an explicit prop through
`TeamMemberAddModal` → `TeamMemberAddForm`. Use `number` type (not
`string | null`) to prevent `Number(undefined) === 0` silent failure.

```ts
interface TeamMemberAddFormProps extends ModalContextValue {
  teamId: number; // strict number, not string | null
}
```

#### 🔴 Bug #3 — `deleteTeam` has no confirmation dialog

**File:** `features/teams/ui/team-actions.tsx` (being deleted — see §3)

> **Research insight — factual correction:** `deleteCompletely()` only deletes
> `team_user` pivot rows and the team record. It does NOT cascade-delete
> meetings, issues, invites, notification settings, etc. The team disappears
> from the dropdown, but associated data remains. This is still destructive (the
> team entity is gone), so a confirmation dialog is still appropriate. However,
> the scope of damage is less catastrophic than originally described.

If `TeamActions` is being deleted (§3), evaluate whether `deleteTeam` is called
from any active UI surface. If not, this bug is moot for now. If delete is
needed in the new UI, the `TeamsHeader` rename affordance (§5.1) can include a
delete option with confirmation.

#### 🟡 Bug #4 — `DecisionsPage` has a stale-result race condition (NEW — found by race analysis)

**File:** `features/teams/ui/dashboard/team-dashboard-tab-decisions.tsx` (via
`DecisionsPage`)

When search query changes rapidly, two concurrent `getDecisions` Server Action
calls can resolve out of order. The slower call (older query) can overwrite the
faster (newer query) results.

**Fix:** Add a generation counter to `loadInitial`:

```ts
const loadGenRef = useRef(0);

const loadInitial = useCallback(async () => {
  const gen = ++loadGenRef.current;
  setIsLoading(true);
  try {
    const result = await getDecisions(teamId, filters, 0, PAGE_SIZE);
    if (gen !== loadGenRef.current) return; // superseded by newer call
    setDecisions(result.data ?? []);
    setTotalDecisions(result.totalCount);
  } catch {
    if (gen !== loadGenRef.current) return;
    toast.error('Failed to load data');
  } finally {
    if (gen === loadGenRef.current) setIsLoading(false);
  }
}, [teamId, debouncedSearch, sourceTypeFilter]);
```

#### 🟡 Bug #5 — `TemplatesTab` flashes previous team's templates on switch (NEW — found by race analysis)

**File:** `features/teams/ui/templates/templates-tab.tsx`

When `teamId` changes, the `useEffect` runs cleanup (`cancelled = true`) —
correct. But `summary` and `agenda` state still hold the previous team's data.
The old templates briefly appear before the skeleton re-shows.

**Fix:** Reset state synchronously at the top of the effect:

```ts
useEffect(() => {
  let cancelled = false;
  setSummary(null); // reset immediately on teamId change
  setAgenda(null);
  setLoadError(null);

  Promise.all([getMeetingSummaryTemplate(teamId), getAgendaTemplate(teamId)])
    .then(([s, a]) => {
      if (cancelled) return;
      setSummary(s);
      setAgenda(a);
    })
    .catch((err) => {
      if (cancelled) return;
      setLoadError(err?.message ?? 'Failed to load templates');
    });

  return () => {
    cancelled = true;
  };
}, [teamId]);
```

#### 🟡 Bug #6 — Team dropdown silently truncates at 10 teams

Fixed in §2 by increasing limit to 100 in the `getTeams` refactor.

#### 🟡 Bug #7 — `TemplatesTab` uses `useEffect` for server actions (FOUC)

**File:** `features/teams/ui/templates/templates-tab.tsx`

> **Research insight — better SSR pattern:** The plan originally proposed
> threading 2 new props through the page → client chain. A better approach using
> Next.js 16 patterns:
>
> **Option A (Suspense Server Component, preferred):** Convert `TemplatesTab` to
> a `TemplatesTabServer` async Server Component that fetches its own data. Wrap
> it in a `<Suspense>` boundary in the tab switcher. This avoids prop drilling
> and keeps fetches server-side. The challenge: `TeamDashboardTabs` is
> `'use client'`, so Server Components cannot be directly imported — they must
> be passed as `children`/slots from a Server Component parent.
>
> **Option B (conditional SSR in page.tsx):** Gate template fetches on
> `tab === 'templates'`:
>
> ```ts
> const isTemplatesTab = tab === 'templates';
> const [/* ...existing 5... */,
>   ...(isTemplatesTab ? [getMeetingSummaryTemplate(teamId), getAgendaTemplate(teamId)] : [])
> ] = await Promise.allSettled([...]);
> ```
>
> Pass `summaryTemplate={isTemplatesTab ? result : null}` to `TemplatesTab`.
> When null, the tab falls back to its current useEffect loading. The FOUC
> penalty is paid only when users explicitly navigate to `?tab=templates`.
>
> **Option C (minimum fix):** Bug #5 fix above + `ErrorDisplay` replacement (Bug
> #8). Acceptable if Suspense/SSR restructuring is deferred.

#### 🟢 Bug #8 — `TemplatesTab` error does not use shared `ErrorDisplay`

**File:** `features/teams/ui/templates/templates-tab.tsx`

`setLoadError(message)` renders a raw `<p>` tag. Replace with
`<ErrorDisplay error={loadError} />` from `shared/ui/error/`.

#### 🟢 Bug #9 — Dashboard API failure is invisible to the user

When `getTeamDashboard` fails, `dashboard` is null and no error is shown. Add a
visible error state and a retry button (calls `router.refresh()`) in
`TeamsPageClient` when `dashboard === null`.

#### 🟢 Bug #10 — `kickTeamMember` makes two serial API calls (performance)

The kick flow calls `GET /teams/{teamId}/users` to find the pivot `TeamUser.id`,
then calls `POST kick`. Two serial round trips per kick.

**Recommended fix (backend, simplest):** Request the backend to expose
`team_user_id` in `TeamResource.members[]`. One-line backend change. Then add
`team_user_id: number` to `TeamMember` and thread it to the kick call — zero
extra network requests.

**Frontend-only fallback:** Add `getTeamUsers` to the SSR `Promise.allSettled`
fan-out and build a `Map<userId, pivotId>` to pass down. Adds one more parallel
SSR call but eliminates the serial penalty on user action.

---

### 5. Missing Backend Features — No Frontend UI

#### 5.1 Team Rename

**Backend endpoints:** `PATCH /teams/{team}` — fully implemented **Frontend:**
`updateTeam()` and `TeamCreateForm` (edit mode) are implemented but unreachable.

**Fix:** Add a pencil icon or "Rename" dropdown item to `TeamsHeader` next to
the selected team name. Clicking opens the existing `TeamCreateForm` with
`isEdit=true` and the current team's values pre-filled.

#### ~~5.2 Team Key Points Viewer~~ — **DROPPED (YAGNI)**

**Rationale:** Adding `GET /teams/{team}/key-points` to the Decisions tab
introduces a second paginated list with search, infinite scroll, and a new API
file — this is a new feature build, not a refactor audit item. Open Question #3
(sub-tab vs same tab) is unresolved. Track as a separate plan when product
requirements are confirmed. The `MeetingKeyPoint` type should be moved to
`entities/meeting/` (see §Architecture) regardless.

#### ~~5.3 Methodology Assignment~~ — **DROPPED (YAGNI)**

**Rationale:** A read-only chip for an action the user cannot take adds a new
network request (parallel SSR fan-out grows from 5 to 6) for zero user value.
The full assignment UI (dropdown + save) is the right scope but is a separate
feature. Track separately.

---

### 6. Accessibility Gaps

#### 🔴 A11y — Tab strip lacks ARIA roles

**File:** `features/teams/ui/dashboard/team-dashboard-tabs.tsx`

The tab strip uses `<button>` elements inside a `<div>` with no ARIA attributes.
Screen readers cannot navigate this as a tab interface.

**Required implementation per WAI-ARIA Authoring Practices:**

```tsx
<div role="tablist" aria-label="Team dashboard">
  {TABS.map(tab => (
    <button
      key={tab.key}
      role="tab"
      id={`tab-${tab.key}`}
      aria-selected={activeTab === tab.key}
      aria-controls={`panel-${tab.key}`}
      onClick={() => handleTabChange(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>
<div
  role="tabpanel"
  id={`panel-${activeTab}`}
  aria-labelledby={`tab-${activeTab}`}
>
  {/* active tab content */}
</div>
```

**Keyboard navigation (WCAG 2.1 AA requirement):**

```tsx
const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
  const tabs = TABS.map((t) => t.key);
  if (e.key === 'ArrowRight') {
    const next = (currentIndex + 1) % tabs.length;
    handleTabChange(tabs[next]);
    tabRefs.current[next]?.focus();
  }
  if (e.key === 'ArrowLeft') {
    const prev = (currentIndex - 1 + tabs.length) % tabs.length;
    handleTabChange(tabs[prev]);
    tabRefs.current[prev]?.focus();
  }
  if (e.key === 'Home') {
    handleTabChange(tabs[0]);
    tabRefs.current[0]?.focus();
  }
  if (e.key === 'End') {
    const last = tabs.length - 1;
    handleTabChange(tabs[last]);
    tabRefs.current[last]?.focus();
  }
};
```

> **Research insight:** WCAG 2.1 AA compliance for tab patterns requires arrow
> key navigation within the tablist. Tab key should move focus OUT of the
> tablist (to the panel), not between tabs.

#### 🟡 A11y — Notification settings toggles lack `aria-pressed`

**File:** `features/teams/ui/team-notification-settings.tsx`

Toggle buttons use color only to communicate state. Add
`aria-pressed={setting.enabled}`. Note: `role="switch"` with `aria-checked` is
also valid for binary on/off controls; `aria-pressed` is correct for toggle
buttons.

#### 🟡 A11y — Loading state not communicated on team switch

Add `aria-busy="true"` to skeleton containers in
`app/dashboard/teams/loading.tsx`:

```tsx
export default function TeamsLoading() {
  return (
    <div aria-busy='true' aria-label='Loading team details'>
      <TeamSkeleton />
    </div>
  );
}
```

> **Research insight:** Next.js does NOT inject `aria-busy` automatically on
> Suspense boundaries or `loading.tsx` fallbacks. Must be added manually per the
> MDN `aria-busy` spec.

#### 🟢 A11y — `key={index}` in insight lists

**File:** `features/teams/ui/dashboard/team-dashboard-tab-people.tsx`

Use stable IDs (e.g., `key={`insight-${member.id}-${i}`}`) instead of bare array
indices for insight items.

---

### 7. Design System Compliance

Run `design-guardian` agent after implementing changes. Focus areas:

- **KPI cards** in `team-dashboard-kpis.tsx` — verify violet primary, terminal
  green for positive delta, red for overdue
- **Tab strip** in `team-dashboard-tabs.tsx` — verify active tab uses violet
  underline matching other tab strips
- **Empty states** — verify standard empty state patterns from `shared/ui/`
- **Error states** — `TemplatesTab` raw `<p>` → `ErrorDisplay`
- **Skeleton loaders** — `loading.tsx` files use `Skeleton`/`SkeletonList` from
  `shared/ui/layout/skeleton.tsx`
- **Pending invite row** — match "pending" visual treatment from other status
  badges

---

## Architecture Notes

### FSD Violation: `MeetingKeyPoint` — Deferred

`MeetingKeyPoint` lives in `features/decisions/model/types.ts` and has exactly
one consumer: the decisions feature itself. The Key Points viewer (which would
create a second consumer in `features/teams`) was dropped as YAGNI. Moving
`MeetingKeyPoint` to `entities/meeting/` now — with no cross-feature consumer —
creates speculative infrastructure. Defer: when the Key Points viewer plan is
implemented and a second consumer is confirmed, create `entities/meeting/` then.

**Tracked as cross-feature debt:** `team-dashboard-tab-decisions.tsx` imports
`DecisionsPage` from `features/decisions` directly (cross-feature violation).
The architectural fix is a `widgets/team-dashboard/` composite. Track in Open
Question #7.

### Performance: `getTelegramChats` — Caching Deferred

`getTelegramChats` is org-scoped (no team context) but re-fetched on every team
switch. `unstable_cache` would be the right tool, but the global cache key
`['telegram-chats']` is **unsafe for multi-tenant use**: at cache hit, the
cached bearer token from user A would be served to user B in the same server
process. The cache key must be scoped per org and per session. Defer to a
separate investigation; do not implement in this plan.

### Performance: Static Tab Components — No Action

`TeamDashboardTabs` is `'use client'` and imports static tab components (Status,
Health, Risks, Readiness) as module-level imports. The RSC-as-slots pattern
(`React.ReactNode` from `page.tsx`) could move them out of the client bundle.
However, the current implementation renders them **conditionally** —
`activeTab === 'status' && <TeamDashboardTabStatus ...>`. Pre-rendering all four
as slots in the Server Component parent means all four execute unconditionally
on every page load, regressing performance. This tradeoff needs deeper analysis.
Defer to a separate plan.

---

## Implementation Plan (Consolidated — 4 Phases)

> **Phase ordering rationale:** Phase A first because `role` field unblocks Bug
> #1. Phase B (dead code + API standardization) touches the same files — merge
> to one pass. Phase C (bugs) depends on Phase A's type change. Phase D (a11y +
> design) is isolated.

### Phase A: Type Fixes (safe, non-breaking, ship first)

1. **Export `TeamMember` interface** from `entities/team/model/types.ts` and
   `entities/team/index.ts`
2. **Add `role: 'manager' | 'employee'`** to `TeamMember`
3. **Fix nullable fields** in `features/teams/model/dashboard-types.ts`
   (`platform: string | null`, `ends_at: string | null`)
4. **Fix `RiskItem.severity`** — remove phantom `'low'` value
5. **Fix null guard** in `team-dashboard-tab-readiness.tsx` for `platform`
   (surfaced by step 3)
6. **Run `backend-contract-validator` agent** to verify no missed mismatches
7. **Run `npm run build`** — catches all TypeScript callsites from `role`
   addition

### Phase B: Dead Code + API Standardization (same file touches, do together)

> ⚠️ **Critical ordering:** Step 20 (remove `invalidate()` from
> `team-create-form.tsx`) **must** happen before step 12 (delete
> `teams-store.ts`). Deleting the store first leaves a dangling import that
> breaks TypeScript and the build.

8. **Verify dead components** with grep:
   `grep -r "TeamList\|TeamItem\|TeamActions\|useTeamsStore\|loadTeamsChunk" --include="*.ts" --include="*.tsx" .`
9. **Delete test files**: `team-list.test.tsx`, `team-item.test.tsx`,
   `team-actions.test.tsx`, `teams-store.test.ts`
10. **Remove dead exports** from `features/teams/index.ts`
11. **Delete** `team-list.tsx`, `team-item.tsx`, `team-actions.tsx`
12. **Remove `useTeamsStore.getState().invalidate()`** from
    `team-create-form.tsx` ← **must precede step 13**
13. **Delete** `teams-store.ts`
14. **Refactor `getTeams`** → `httpClientList<TeamProps>` with `?limit=100`
15. **Refactor `createTeam`** → `httpClient` + `ActionResult<TeamProps>` (keep
    `organizationId` param, add `Content-Type: application/json` header)
16. **Update `createTeam` tests** in `api/__tests__/team.test.ts` — replace
    `globalThis.fetch` mocking with `mockHttpClient` pattern (5 test cases)
17. **Refactor `deleteTeam`** → `httpClient` + `ActionResult<void>`
18. **Update `deleteTeam` callers**: `team-actions.tsx` (dead — already
    deleted); check for any remaining active callers
19. **Update `deleteTeam` tests** in `api/__tests__/team.test.ts` and
    `team-actions.test.tsx` (3 test cases each)
20. **Remove `loadTeamsChunk`** from `api/team.ts` and its export from
    `index.ts`
21. **Add `Content-Type: application/json`** to `updateTeam` call in
    `api/team.ts` (same pass as createTeam changes)
22. **Run `npm test -- --ci --coverage`** to verify coverage thresholds not
    broken

### Phase C: Bug Fixes

> ⚠️ **Dependency:** Steps 23–24 (`isManager` fix) require Phase A step 2
> (`role` field on `TeamMember`) to be complete.

23. **Fix `isManager` in `page.tsx`** — inline one-liner:
    `const isManager = viewerMember?.role === 'manager'` (no new file needed)
24. **Fix `TeamMemberAddForm`** — prop-thread `teamId: number`, remove
    `useSearchParams()` call; update `TeamMemberAddModal` wrapper too
25. **Fix `TemplatesTab` state reset** (Bug #5) — add
    `setSummary(null); setAgenda(null)` at top of useEffect before async calls
26. **Fix `TemplatesTab` error** (Bug #8) — replace raw `<p>` with
    `<ErrorDisplay>`
27. **Add dashboard error state** (Bug #9) — visible error + `router.refresh()`
    retry button in `TeamsPageClient` when `dashboard === null`
28. **Fix `DecisionsPage` race condition** (Bug #4) — add generation counter to
    `loadInitial`
29. **Add team rename UI** — pencil icon in `TeamsHeader`, opens
    `TeamCreateForm` in edit mode

### Phase D: Accessibility + Design

30. **Add ARIA roles** to tab strip: `role="tablist"`, `role="tab"`,
    `aria-selected`, `aria-controls`, `id` on panels
31. **Add keyboard navigation** (Arrow keys, Home, End) to tab strip; note: this
    component is a migration candidate to `PageTabsNav` (see Open Question #5)
32. **Add `aria-pressed`** to notification settings toggles
33. **Add `aria-busy="true"`** to `loading.tsx` skeleton container
34. **Replace `key={index}`** with stable IDs in insight lists
35. **Run `design-guardian` agent** on all modified components

---

## Open Questions

| #   | Question                                                                                                                                                                       | Impact                                       | Assumption if unanswered                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| 1   | Should org-level managers always see management UI even if not in `team.members`?                                                                                              | Requires backend `viewer.is_manager` field   | Use `viewerMember?.role === 'manager'` (frontend-only fix) |
| 2   | Should `viewer.is_manager` be added to dashboard payload?                                                                                                                      | Backend change required                      | No; defer; use role from `TeamMember`                      |
| 3   | Should Key Points viewer be added?                                                                                                                                             | New feature scope                            | Separate plan when product requirements confirmed          |
| 4   | Should full methodology assignment UI be added?                                                                                                                                | New feature scope                            | Separate plan                                              |
| 5   | Is route-based tab migration (per CLAUDE.md convention) in scope?                                                                                                              | Large scope change                           | No; add ARIA only; track as separate migration             |
| 6   | Should `team_user_id` be exposed in `TeamResource.members[]`?                                                                                                                  | Backend change; eliminates kick serial calls | Track as backend request                                   |
| 7   | `team-dashboard-tab-decisions.tsx` imports `DecisionsPage` directly from `features/decisions` (cross-feature FSD violation). Fix requires `widgets/team-dashboard/` composite. | Architecture debt                            | Track separately; out of scope for this refactor           |

---

## Files to Create / Modify

| Action     | File                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Modify     | `entities/team/model/types.ts`                                                                |
| Modify     | `entities/team/index.ts`                                                                      |
| ~~Create~~ | ~~`entities/meeting/model/types.ts`~~ — deferred (no cross-feature consumers yet)             |
| ~~Create~~ | ~~`entities/meeting/index.ts`~~ — deferred                                                    |
| Modify     | `features/teams/model/dashboard-types.ts`                                                     |
| Modify     | `features/teams/api/team.ts`                                                                  |
| ~~Modify~~ | ~~`features/telegram/api/telegram.ts`~~ — deferred (`unstable_cache` auth scoping unresolved) |
| ~~Create~~ | ~~`features/teams/model/viewer-role.ts`~~ — YAGNI (one-liner inlined in `page.tsx`)           |
| Modify     | `app/dashboard/teams/page.tsx`                                                                |
| Modify     | `app/dashboard/teams/loading.tsx`                                                             |
| Modify     | `features/teams/ui/teams-header.tsx`                                                          |
| Modify     | `features/teams/ui/teams-page-client.tsx`                                                     |
| Modify     | `features/teams/ui/team-member-add-form.tsx`                                                  |
| Modify     | `features/teams/ui/team-member-add-modal.tsx`                                                 |
| Modify     | `features/teams/ui/team-create-form.tsx`                                                      |
| Modify     | `features/teams/ui/templates/templates-tab.tsx`                                               |
| Modify     | `features/teams/ui/dashboard/team-dashboard-tabs.tsx`                                         |
| Modify     | `features/teams/ui/dashboard/team-dashboard-tab-readiness.tsx`                                |
| Modify     | `features/teams/ui/team-notification-settings.tsx`                                            |
| Modify     | `features/teams/index.ts`                                                                     |
| Modify     | `features/teams/api/__tests__/team.test.ts`                                                   |
| Modify     | `features/teams/ui/__tests__/team-actions.test.tsx`                                           |
| Delete     | `features/teams/ui/team-list.tsx`                                                             |
| Delete     | `features/teams/ui/team-item.tsx`                                                             |
| Delete     | `features/teams/ui/team-actions.tsx`                                                          |
| Delete     | `features/teams/model/teams-store.ts`                                                         |
| Delete     | `features/teams/ui/__tests__/team-list.test.tsx`                                              |
| Delete     | `features/teams/ui/__tests__/team-item.test.tsx`                                              |
| Delete     | `features/teams/ui/__tests__/team-actions.test.tsx`                                           |
| Delete     | `features/teams/model/__tests__/teams-store.test.ts`                                          |

---

## Acceptance Criteria

### Contract Alignment

- [x] `TeamMember` is exported from `entities/team/index.ts`
- [x] `TeamMember` has `role: 'manager' | 'employee'` field
- [x] `DashboardMeetingCard.platform` and `ends_at` are typed as `string | null`
- [x] `team-dashboard-tab-readiness.tsx` has null guard on `platform`
- [ ] `backend-contract-validator` agent reports zero mismatches for teams
      domain

### API Layer

- [x] No raw `fetch` calls in `features/teams/api/team.ts`
- [x] `createTeam` returns `ActionResult<TeamProps>`, includes `organization_id`
      in body, includes `Content-Type` header
- [x] `deleteTeam` returns `ActionResult<void>`
- [x] `getTeams` uses `httpClientList` with limit=100
- [x] All mutations call `revalidatePath('/dashboard/teams')` after success

### Dead Code

- [x] `TeamList`, `TeamItem`, `TeamActions`, `teams-store.ts` deleted
- [x] No TypeScript errors from removal (`npm run build` passes)
- [x] `features/teams/index.ts` does not export deleted components
- [x] `team-create-form.tsx` does not call
      `useTeamsStore.getState().invalidate()`

### Bugs

- [x] `isManager` uses `viewerMember?.role === 'manager'` (inlined in
      `page.tsx`, no new file)
- [x] `TeamMemberAddForm` and `TeamMemberAddModal` receive `teamId: number` as
      prop, no `useSearchParams`
- [x] `TemplatesTab` resets state on teamId change before async call
- [x] `DecisionsPage` search uses generation counter to prevent stale results
- [x] Team rename button visible in `TeamsHeader`
- [ ] `TemplatesTab` error uses `ErrorDisplay` component

### Performance

- [ ] `getTelegramChats` caching — deferred (requires per-org/session key
      scoping to avoid cross-user data leak)
- [ ] Template conditional SSR — deferred (Bug #5 state-reset fix is sufficient
      for now)

### Tests

- [x] `createTeam` tests migrated from `globalThis.fetch` to `mockHttpClient`
      pattern
- [x] `deleteTeam` tests updated for `ActionResult<void>` return type
- [x] `npm test -- --ci --coverage` passes all thresholds

### Accessibility

- [x] Tab strip has `role="tablist"`, `role="tab"`, `aria-selected`,
      `aria-controls`, corresponding panel `id`s
- [x] Arrow key navigation within tab strip (note: component is a migration
      candidate to `PageTabsNav`, see Open Question #5)
- [x] Notification setting toggles have `aria-pressed`
- [x] `loading.tsx` skeleton has `aria-busy="true"`

---

## References

### Frontend Files

- `app/dashboard/teams/page.tsx` — Main SSR page, `isManager` detection,
  `Promise.allSettled`
- `entities/team/model/types.ts` — `TeamMember` (private, unexported),
  `TeamProps`, `TeamInvite`
- `features/teams/api/team.ts` — Raw fetch violations, `createTeam`,
  `deleteTeam`, `kickTeamMember`
- `features/teams/model/dashboard-types.ts` — All 20+ dashboard interfaces
- `features/teams/model/viewer-role.ts` — YAGNI; `deriveIsManager` inlined as
  one-liner in `page.tsx`
- `features/teams/ui/teams-header.tsx` — Team selector dropdown, team rename (to
  add)
- `features/teams/ui/team-member-add-form.tsx` — URL-bound `team_id` bug
- `features/teams/ui/templates/templates-tab.tsx` — useEffect data fetch, state
  reset bug
- `features/teams/ui/dashboard/team-dashboard-tabs.tsx` — Tab strip without ARIA
- `features/decisions/model/types.ts` — `MeetingKeyPoint` (to move to
  `entities/meeting/`)
- `features/telegram/api/telegram.ts` — `getTelegramChats` (to add caching)

### Backend Files

- `app/Http/Resources/API/v1/TeamResource.php` — `members[].role` field (show()
  only)
- `app/Http/Controllers/API/v1/TeamController.php` — `show()` adds
  `organization_role` via JOIN
- `app/Services/Dashboard/TeamDashboardService.php` — `viewer: { id, name }` (no
  `is_manager`)
- `app/Models/Team.php:91-106` — `deleteCompletely()` deletes only `team_user`
  pivot + team record
- `app/Enums/UserRole.php` — `'manager' | 'employee'`
- `routes/api.php:183-276` — All team routes (PUT+PATCH both registered for
  update)

### Research Sources

- [Next.js 16 Fetching Data docs](https://nextjs.org/docs/app/getting-started/fetching-data)
  — `Promise.all` pattern, streaming via Suspense
- [Next.js revalidatePath docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
  — cache invalidation scope
- [WAI-ARIA Tab Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — tab
  ARIA requirements and keyboard navigation
- [MDN aria-busy](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy)
  — loading state semantics
- [React 19 `use()` hook](https://react.dev/reference/react/use) — Promise
  streaming pattern
- `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
  — JSON parse safety in Server Actions
