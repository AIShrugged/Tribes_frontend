---
title: 'feat: Today Dashboard — Pass organization_id to All API Calls'
type: feat
status: completed
date: 2026-05-26
deepened: 2026-05-26
---

# feat: Today Dashboard — Pass `organization_id` to All API Calls

## Enhancement Summary

**Deepened on:** 2026-05-26 **Research agents used:** TypeScript reviewer,
Security sentinel, Performance oracle, Code simplicity reviewer, FSD boundary
guard, Architecture strategist, Race conditions reviewer, Best practices
researcher

### Key Improvements Over Original Plan

1. **Simpler implementation (3 files changed, not 9)** — move
   `getOrganizationId()` inside the server actions; no prop drilling, no
   signature changes on components
2. **Eliminate duplicate HTTP requests** — `TaskStatsBlock` + `ClosedTasksBlock`
   both call `getIssueStats()` today; wrap with `React.cache()` to deduplicate
   within the same render
3. **Fix unsafe `+orgId` coercion** — parse the cookie to a validated
   `number | null` at the boundary, not scattered `+` conversions at call sites
4. **Critical polling race condition found** — `CriticalPathPageClient` has an
   overlapping `poll` + `repoll` loop bug that should be fixed alongside this
   work
5. **Security gap found** — list/kanban pages accept `organization_id` from URL
   query params, overriding the cookie; this bypasses the intended org-switcher
   flow
6. **Standardize on `URLSearchParams`** — `getIssueStats` uses string
   interpolation while other functions use URLSearchParams; normalize all

### New Considerations Discovered

- The cross-feature import `features/today-briefing` → `features/issues` is a
  pre-existing FSD violation; the plan should not worsen it (and ideally fixes
  it by having `today-briefing/api/task-stats.ts` call the backend directly)
- `getOrganizationId()` should be wrapped with `React.cache()` to avoid multiple
  `await cookies()` calls per render tree
- `getAuthToken()` has the same deduplication gap — consider wrapping it too
- `data!` non-null assertions in `getIssueStats` / `getIssueStatsHistory` are
  risks — add proper fallback handling

---

## Overview

The backend commit `13a098e` (`fix/dashboard-org-scopes-and-tg-chat-orgs`,
2026-05-26) updated all four dashboard controllers to accept and scope by
`organization_id`. The frontend must now forward the active organization (from
the `organization_id` cookie) in every dashboard request. Without this, the
backend falls back to returning data across all orgs visible to the user — a
scoping regression.

## Affected Endpoints & Current State

| Route                               | Endpoint                                            | Missing param     | Notes                                                         |
| ----------------------------------- | --------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `/dashboard/today/meetings`         | `GET /me/today`                                     | `organization_id` | `getTodayBriefing` needs org param                            |
| `/dashboard/today/tasks`            | `GET /me/today`                                     | `organization_id` | same; `TaskStatsBlock` + `ClosedTasksBlock` also need scoping |
| `/dashboard/today/activity`         | `GET /critical-path`, `POST /critical-path/rebuild` | ✅ already wired  | No changes needed                                             |
| `/dashboard/today/progress`         | `GET /issues/stats`, `GET /issues/stats/history`    | `organization_id` | Both stat functions need org param                            |
| `/dashboard/issues/(tabs)/progress` | same two stats endpoints                            | `organization_id` | Same functions, same gap                                      |

## Backend Contracts (confirmed from `13a098e`)

### `GET /me/today`

- `TodayBriefingRequest` validates: `date` (nullable `Y-m-d`), `organization_id`
  (nullable integer, `exists:organizations,id`)
- `TenantScopeValidator::assertScopeIsValid($user, $organizationId, null)`
  validates ownership — returns 422 if org not owned by user

### `GET /issues/stats`

- Inline validate: `organization_id` (nullable, integer,
  `exists:organizations,id`) — query param
- `TenantScopeValidator::assertScopeIsValid` is called explicitly

### `GET /issues/stats/history`

- `IssueStatsHistoryRequest` validates: `period`, `range`, `organization_id` —
  all query params
- `TenantScopeValidator::assertScopeIsValid` is called

### `POST /critical-path/rebuild`

- Reads via
  `$request->validate(['organization_id' => ['nullable', 'integer', ...]])` —
  accepts both query string AND request body (already handled on frontend)

## Organization ID Source

`shared/lib/getOrganizationId.ts` — reads `organization_id` from the httpOnly
cookie set by `setActiveOrganization` / `selectOrganizationAction`. Redirects to
login if not set.

### Research insight: Parse the cookie value safely

The current `getOrganizationId()` returns `string` (raw cookie value). All call
sites do `+orgId` / `Number(orgId)` — `+` is unsafe: `+''` → `0`, `+'abc'` →
`NaN`. The cookie should be parsed to `number | null` once at the source:

```ts
// shared/lib/getOrganizationId.ts — updated
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/lib/routes';

export const getOrganizationId = cache(async (): Promise<number> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('organization_id')?.value;
  const parsed = raw !== undefined ? Number(raw) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  return parsed;
});
```

**Why `React.cache()`:** Multiple calls to `getOrganizationId()` within the same
render tree (layout + page + components) collapse to a single `await cookies()`
invocation. This is consistent with how `getOrganizations` and `getOrganization`
are already memoized in `features/organization/api/organization.ts`.

**Why `Number()` not `parseInt()`:** `parseInt('123abc')` → `123` (silent
corruption). `Number('123abc')` → `NaN` (correctly rejected).

## Architecture Decision: Where to Call `getOrganizationId()`

### Original plan: prop-drilling (Option A — 9 file changes)

```
page.tsx → getOrganizationId() → pass as prop → TaskStatsBlock → getIssueStats(orgId)
```

### Research finding: self-contained server actions (3 file changes)

The existing codebase pattern — shown in
`features/today-briefing/api/ai-action.ts` — is that server actions call
`getOrganizationId()` themselves:

```ts
// ai-action.ts already does this:
const organizationId = await getOrganizationId();
```

This means:

- `getIssueStats()` calls `getOrganizationId()` internally — no parameter, no
  callers to update
- `getIssueStatsHistory()` does the same
- `getTodayBriefing()` does the same
- `TaskStatsBlock` and `ClosedTasksBlock` stay prop-free
- Page files stay clean

**Trade-off:** This approach is slightly harder to unit-test (must mock
`cookies()` or `getOrganizationId()`), but is simpler overall and consistent
with existing conventions. Three reviewers independently identified this as the
right call.

**Use the self-contained server action approach.**

## Implementation Plan (Revised)

### Step 1 — Update `getOrganizationId` (single change, high leverage)

**File:** `shared/lib/getOrganizationId.ts`

Change return type from `string` to `number`, add `React.cache()`, add safe
`Number()` parsing with `Number.isFinite` guard. See code in "Organization ID
Source" section above.

> **Note:** All existing callers that did `+orgId` or `Number(orgId)` must be
> updated to use the result directly (it is now already a `number`). Most
> callers are in `app/` pages — audit with `grep -r "getOrganizationId"`.

### Step 2 — Update `getTodayBriefing`

**File:** `features/today-briefing/api/today.ts`

```ts
'use server';

import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { TodayBriefing } from '../model/types';

const EMPTY_BRIEFING: TodayBriefing = {
  state: 'empty',
  date: '',
  events: [],
  carried_tasks: [],
  waiting_on_you: [],
  stale: [],
  nudge: null,
};

export async function getTodayBriefing(date?: string): Promise<TodayBriefing> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  params.set('organization_id', String(organizationId));
  const { data } = await httpClient<TodayBriefing>(
    `${API_URL}/me/today?${params}`,
  );
  return data ?? EMPTY_BRIEFING;
}
```

No callers need updating — the signature stays `(date?: string)`.

### Step 3 — Update `getIssueStats`

**File:** `features/issues/api/issue-stats.ts`

```ts
'use server';

import { cache } from 'react';
import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueStats } from '../model/types';

export const getIssueStats = cache(
  async function getIssueStats(): Promise<IssueStats> {
    const organizationId = await getOrganizationId();
    const params = new URLSearchParams({
      organization_id: String(organizationId),
    });
    const { data } = await httpClient<IssueStats>(
      `${API_URL}/issues/stats?${params}`,
    );
    if (!data) throw new Error('No stats data returned from /issues/stats');
    return data;
  },
);
```

**Why `cache()` here:** `TaskStatsBlock` and `ClosedTasksBlock` both call
`getIssueStats()` in the same `tasks/page.tsx` render tree. Without `cache()`,
that is two identical HTTP requests to `/api/v1/issues/stats` per page load.
`React.cache()` deduplicates them to one — consistent with how
`getOrganizations` is already cached in
`features/organization/api/organization.ts`.

**Why remove `data!`:** The non-null assertion hides a runtime crash risk if the
backend returns `null`. Explicit throw gives a useful error message.

No callers need updating — signature stays `()`.

### Step 4 — Update `getIssueStatsHistory`

**File:** `features/issues/api/issue-stats-history.ts`

```ts
'use server';

import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueHistoryPeriod, IssueStatsHistory } from '../model/types';

export async function getIssueStatsHistory(
  period: IssueHistoryPeriod,
  range?: number,
): Promise<IssueStatsHistory> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams({
    period,
    organization_id: String(organizationId),
  });
  if (range !== undefined) params.set('range', String(range));
  const { data } = await httpClient<IssueStatsHistory>(
    `${API_URL}/issues/stats/history?${params}`,
  );
  if (!data)
    throw new Error('No history data returned from /issues/stats/history');
  return data;
}
```

No callers need updating — signature stays `(period, range?)`.

### Step 5 — Audit `getOrganizationId` call sites for `+orgId` removal

After Step 1 changes the return type from `string` to `number`, any existing
`+orgId` coercions in `app/` pages become unnecessary and should be removed:

```bash
grep -r "getOrganizationId" app/ features/ --include="*.tsx" --include="*.ts" -n
```

Expected callers (from current codebase scan):

- `app/dashboard/today/meetings/page.tsx` — uses `+orgId` to pass to
  `MeetingsContent` → remove the `+`
- `app/dashboard/today/activity/page.tsx` — uses `Number(organizationId)` →
  remove the `Number()`
- Others found by grep → update accordingly

### Step 6 — Fix FSD violation in `today-briefing` components (bonus, same PR)

Currently `task-stats-block.tsx` and `closed-tasks-block.tsx` import from
`@/features/issues/api/issue-stats` — a cross-feature Rule 1 + Rule 3 violation.
Since `getIssueStats` now calls `getOrganizationId()` internally and is cached,
this import becomes a simple server action call.

If the team wants to fix the FSD violation at the same time: create
`features/today-briefing/api/task-stats.ts` that calls the `/issues/stats`
endpoint directly, mirroring the pattern in `getIssueStats`. Then the
today-briefing components import from their own feature.

**This is optional for this PR** — the violation is pre-existing and fixing it
doesn't block the org scoping work.

## Files to Change (Summary — Revised)

| File                                         | Change                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `shared/lib/getOrganizationId.ts`            | Return `number` (not `string`), add `React.cache()`, safe parse with `Number.isFinite` |
| `features/today-briefing/api/today.ts`       | Call `getOrganizationId()` internally, build params with `URLSearchParams`             |
| `features/issues/api/issue-stats.ts`         | Call `getOrganizationId()` internally, wrap with `React.cache()`, remove `data!`       |
| `features/issues/api/issue-stats-history.ts` | Call `getOrganizationId()` internally, remove `data!`                                  |
| `app/dashboard/today/meetings/page.tsx`      | Remove `+orgId` coercion (now a `number` already)                                      |
| `app/dashboard/today/activity/page.tsx`      | Remove `Number(organizationId)` coercion                                               |
| _(other callers found by grep)_              | Remove numeric coercions                                                               |

**Not changing (org scoping is now inside the server action):**

- `app/dashboard/today/tasks/page.tsx`
- `app/dashboard/today/progress/page.tsx`
- `app/dashboard/issues/(tabs)/progress/page.tsx`
- `features/today-briefing/ui/task-stats-block.tsx`
- `features/today-briefing/ui/closed-tasks-block.tsx`

## Bonus Fix: `CriticalPathPageClient` Polling Race (Same PR Opportunity)

The race conditions reviewer found a real bug in
`features/issues/ui/critical-path-page.tsx`. After `handleRebuild` fires, both
the original `poll` loop and the new `repoll` loop can run concurrently, causing
graph state to flicker and double backend load.

**Fix:** Add a generation counter to cancel stale polling loops:

```ts
const pollGenRef = useRef(0);

async function poll(gen: number) {
  if (!mountedRef.current || gen !== pollGenRef.current) return;
  // ... fetch getCriticalPath ...
  if (shouldContinue) {
    pollingRef.current = setTimeout(() => poll(gen), POLL_INTERVAL_MS);
  }
}

// To start/restart polling and kill all prior loops:
function startPolling() {
  pollGenRef.current += 1;
  clearPolling(); // cancel pending timeout
  void poll(pollGenRef.current);
}
```

Also add early return in `handleRebuild` to guard against concurrent
invocations:

```ts
async function handleRebuild() {
  if (rebuilding) return;
  // ... rest unchanged
}
```

This is unrelated to org scoping but is a correctness bug worth fixing in the
same PR since we're touching the activity page area.

## Security Notes

The security reviewer found that `app/dashboard/issues/(tabs)/list/page.tsx` and
`kanban/page.tsx` accept `organization_id` from URL query params and override
the cookie:

```ts
const orgId =
  typeof params.organization_id === 'string'
    ? params.organization_id // URL wins over cookie — bypasses org switcher
    : cookieOrgId;
```

This is a separate issue from this plan but worth logging. With the current
plan's approach (org resolution inside server actions via
`getOrganizationId()`), this pattern cannot occur since the server actions don't
accept `organizationId` as a parameter at all.

Additionally: `setActiveOrganization` and `selectOrganizationAction` write the
cookie from `formData.get('organization_id')` without integer validation.
Consider adding:

```ts
const parsed = parseInt(id, 10);
if (!Number.isInteger(parsed) || parsed <= 0) return { ok: false };
```

Both security issues are out of scope for this plan but should be tracked
separately.

## Edge Cases

1. **No org cookie** — `getOrganizationId()` redirects to `/auth/login`. This is
   enforced by `React.cache()` — the first call redirects, subsequent calls
   never reach the action.

2. **Malformed cookie value** — With the new `Number.isFinite` guard in
   `getOrganizationId()`, non-integer cookies redirect to login. Existing
   `+orgId` call sites that could produce `NaN` are now safe.

3. **`organization_id = 0`** — The `> 0` guard in `getOrganizationId()` catches
   this. Backend also validates `exists:organizations,id` which would reject 0.

4. **`React.cache()` scope** — Cache is per-request, not cross-request. Users
   from different orgs in different requests never share cached values.

5. **`meetings/page.tsx` parallelism** — Currently uses
   `Promise.all([getTodayBriefing(date), getOrganizationId()])`. After this
   change, `getTodayBriefing` calls `getOrganizationId()` internally. The page's
   `getOrganizationId()` call becomes redundant (only needed to pass
   `organizationId` to `MeetingsContent` for `EmptyState`). Keep the parallel
   pattern but simplify:
   ```tsx
   const [data, organizationId] = await Promise.all([
     getTodayBriefing(date), // internally calls getOrganizationId (cached)
     getOrganizationId(), // second call hits React.cache(), no extra work
   ]);
   ```
   Both calls share the same `React.cache()` memoization — effectively free.

## Acceptance Criteria

- [ ] `GET /me/today?date=...&organization_id=<id>` is sent from meetings and
      tasks pages
- [ ] `GET /issues/stats?organization_id=<id>` is sent from tasks, progress, and
      issues/progress pages
- [ ] `GET /issues/stats/history?period=<p>&organization_id=<id>` is sent from
      all progress pages
- [ ] `CriticalPathPageClient` behavior unchanged (activity page already
      working)
- [ ] No `+orgId` or `Number(orgId)` coercions in page files —
      `getOrganizationId()` returns `number` directly
- [ ] `TaskStatsBlock` and `ClosedTasksBlock` require no prop changes
- [ ] `getIssueStats` is called once per page render (not twice) — verified via
      network tab
- [ ] If `organization_id` cookie is absent or invalid, user is redirected to
      login
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] Existing tests pass (`npm test`)
- [ ] `data!` assertions replaced with proper error handling in both stat
      functions

## Test Coverage

For each updated server action, verify URL construction:

**`getTodayBriefing`:**

- `GET /me/today?date=2026-05-26&organization_id=42` when both args provided
- `GET /me/today?organization_id=42` when no date provided

**`getIssueStats`:**

- `GET /issues/stats?organization_id=42`
- Called once even when two components render in same tree (cache deduplication)

**`getIssueStatsHistory`:**

- `GET /issues/stats/history?period=week&organization_id=42` (default range)
- `GET /issues/stats/history?period=day&range=30&organization_id=42`

**`getOrganizationId`:**

- Returns `number` when cookie is `"42"`
- Redirects to login when cookie is absent
- Redirects to login when cookie is `"abc"` (non-numeric)
- Redirects to login when cookie is `"0"` (non-positive)

## References

- Backend commit: `13a098e` — `fix/dashboard-org-scopes-and-tg-chat-orgs`
- `TodayBriefingController.php:28` — `$request->getOrganizationId()`
- `IssueStatsController.php:35` — `$validated['organization_id']`
- `IssueStatsHistoryRequest.php:39` — `getOrganizationId()`
- `CriticalPathController.php:105` — `validatedScope($request)` already handles
  both GET + POST
- `features/today-briefing/api/ai-action.ts` — existing pattern: server action
  calls `getOrganizationId()` internally
- `features/organization/api/organization.ts:23` — `getOrganizations` wrapped in
  `cache()` — precedent for caching
- `shared/lib/getOrganizationId.ts` — cookie-based org resolver (to be updated)
- Next.js docs:
  [cookies() API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- Next.js docs:
  [React cache() for data deduplication](https://nextjs.org/docs/app/guides/caching-without-cache-components)
