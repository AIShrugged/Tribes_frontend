---
title: 'refactor: Agents Feature Audit — Tasks, Profiles, Activity'
type: refactor
status: active
date: 2026-05-19
deepened: 2026-05-19
---

# refactor: Agents Feature Audit — Tasks, Profiles, Activity

## Enhancement Summary

**Deepened on:** 2026-05-19 **Research agents used:**
kieran-typescript-reviewer, architecture-strategist, performance-oracle,
security-sentinel, julik-frontend-races-reviewer, code-simplicity-reviewer,
pattern-recognition-specialist, coherence-reviewer, best-practices-researcher,
framework-docs-researcher

### Key Improvements Added by Deepening

1. **Bug #2 fix was architecturally wrong** — "pass via props from layout" is
   impossible in Next.js App Router. Replaced with `React.cache()` pattern (the
   only valid RSC solution).
2. **Two new critical issues discovered** — (a) Index signatures
   `[key: string]: unknown` on `AgentProfile`, `AgentTask`, `AgentTaskRun`
   defeat all TypeScript safety; (b)
   `dispatch + enable in-flight simultaneously` is unsolvable by just splitting
   `useTransition()` — requires a shared state machine.
3. **Bug #3 httpClient introduces redirect-on-401** — `httpClient` calls
   `redirect()` on 401 (not just `clearSession()`), which is a behavioral change
   for Server Action mutations. DELETE migration needs explicit wrapping.
4. **`hasMore` formula diverges** between `httpClientList` and agents' custom
   calculation — silent pagination regression if migrated naively.
5. **`httpClientList.hasMore` formula is wrong** — `data.length < totalCount` is
   incorrect for offset pagination; must be fixed before agents migrate to it.
6. **Profile_schema removal is unconditional** — backend check already done; the
   field is absent from `AgentProfileResource`. But `config_schema` and
   `task_payload_schema` ARE in the backend resource but absent from frontend
   types.
7. **`AgentProfilesList` pagination is YAGNI** — profiles are config objects,
   expected to be <20 per org. Drop infinite scroll; add a `limit` cap instead.
8. **`revalidatePath` needs `'layout'` segment parameter** for task detail
   mutations.
9. **`today-activity-feed.tsx` still has an inline `STATUS_VARIANT` record** —
   duplicates `AgentRunStatusBadge`, should be replaced.
10. **`access.ts` lacks `'use server'`** — calls `cookies()` from next/headers
    but is not marked server-only, creating a risk if imported near a Client
    Component boundary.

---

## Overview

A comprehensive audit and refactor of `features/agents/` covering all three
dashboard tabs (tasks, profiles, activity). The scope includes fixing confirmed
bugs, migrating to shared components, removing dead code, tightening types, and
correcting FSD boundary violations.

---

## Confirmed Bugs 🐛

### 1. Wrong navigation URLs — `?tab=` query params instead of route paths (HIGH)

**Files:** `features/agents/ui/agent-task-actions.tsx:109`,
`features/agents/ui/agent-task-runs-list.tsx:61,101`

The "Edit" button navigates to `/dashboard/agents/tasks/${id}?tab=config` — this
hits the redirect page `tasks/[id]/page.tsx` which unconditionally redirects to
`/overview`, silently discarding the `?tab=` param.

Run-detail links use
`/dashboard/agents/tasks/${taskId}?tab=runs&runId=${run.id}` — same problem; but
note `?runId=` is intentionally valid (read by runs/page.tsx via searchParams).
Only `?tab=runs` must be removed.

**Fix:**

```ts
// agent-task-actions.tsx:109
// ❌ Old
`/dashboard/agents/tasks/${id}?tab=config`
// ✅ New
`${ROUTES.DASHBOARD.AGENT_TASKS}/${id}/config`
// agent-task-runs-list.tsx:61,101
// ❌ Old — tab param is dead but runId is valid
`/dashboard/agents/tasks/${taskId}?tab=runs&runId=${run.id}`
// ✅ New — remove only the ?tab=runs portion
`/dashboard/agents/tasks/${taskId}/runs?runId=${run.id}`;
```

### Research Insights

**Navigation jank:** The double-redirect (`?tab=config` → overview) causes an
observable blank flash on slow connections as the browser receives two full RSC
payloads. Using the direct route path eliminates both the flash and the
redundant RSC render.

**Tab convention rule (CLAUDE.md):** The mandatory rule is that `?tab=` is never
used for tab switching. Filter/detail params like `?runId=` within a tab page
are explicitly allowed.

---

### 2. Double `getAgentTask` fetch on overview and json tabs (MEDIUM)

**Files:** `app/dashboard/agents/tasks/[id]/layout.tsx:49`,
`app/dashboard/agents/tasks/[id]/overview/page.tsx:18`,
`app/dashboard/agents/tasks/[id]/json/page.tsx:18`

The layout already fetches the full task. `overview/page.tsx` and
`json/page.tsx` each call `getAgentTask()` independently. With
`cache: 'no-store'` on the underlying fetch, this triggers two backend requests
per page load.

**Fix:** Wrap `getAgentTask` in `React.cache()`. Both the layout and sub-pages
call `getAgentTask(id)` independently; the cache deduplicates to a single
network request per render pass.

> ⚠️ **IMPORTANT — The original plan's proposed fix ("pass via props from
> layout") is architecturally impossible.** Next.js App Router layouts cannot
> pass arbitrary props to page components — `children` is an opaque React node.
> `React.cache()` is the only correct solution.

```ts
// features/agents/api/agents.ts
import { cache } from 'react';

export const getAgentTask = cache(async (id: number): Promise<AgentTask> => {
  const { json } = await requestAgentApi<AgentTask>(
    `/agent-tasks/${id}`,
    { method: 'GET' },
    'Failed to load agent task',
  );
  return json.data as AgentTask;
});
```

Apply the same `cache()` wrap to `getAgentTasksMeta` and `getAgentTools` —
`config/page.tsx` calls all three, and a future layout extension could call them
again.

### Research Insights

**`React.cache()` scope:** Memoization is per-request. On `router.refresh()`
from a Client Component, the cache is invalidated for the new render pass — the
backend is hit exactly once per navigation, which is correct.

**Parallelize the layout's own fetches:** The layout currently awaits
`getAgentAccessContext()` and `getAgentTask()` sequentially. These are
independent — use `Promise.all` to halve layout blocking time:

```ts
// app/dashboard/agents/tasks/[id]/layout.tsx
const [{ canManageAgents }, task] = await Promise.all([
  getAgentAccessContext(),
  getAgentTask(profileId),
]);
```

---

### 3. `deleteAgentProfile` / `deleteAgentTask` missing `clearSession()` on 401 (MEDIUM)

**File:** `features/agents/api/agents.ts:190–211, 314–335`

Both DELETE handlers use raw `fetch` directly and never call `clearSession()` on
a 401 response. A 401 silently returns `{ error: '...', status: 401 }` to the UI
without invalidating the session, leaving the user stuck with a stale
`organization_id` cookie.

**Fix:** Replace raw `fetch` with `httpClient<void>()` inside a `try/catch`
returning `ActionResult<void>`.

> ⚠️ **Behavioral change to document:** `httpClient` calls `clearSession()`
> **and** then calls `redirect(ROUTES.AUTH.LOGIN)` on 401. The original
> `requestAgentApi` only calls `clearSession()` without redirecting. For DELETE
> mutations called from Client Components via Server Actions, the `redirect()`
> throw from `httpClient` is handled by Next.js's action transport mechanism.
> Verify this is the desired UX — the user will be redirected to login if their
> session expires mid-delete.

```ts
// ✅ New pattern for DELETE functions
export async function deleteAgentTask(id: number): Promise<ActionResult<void>> {
  try {
    await httpClient<void>(`${API_URL}/agent-tasks/${id}`, {
      method: 'DELETE',
    });
    revalidatePath(ROUTES.DASHBOARD.AGENT_TASKS);
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      return {
        data: null,
        error: error.message ?? 'Failed to delete agent task',
      };
    }
    throw error;
  }
}
```

---

### 4. Shared `isPending` + race condition between dispatch and enable (HIGH — upgraded from LOW)

**File:** `features/agents/ui/agent-task-actions.tsx:102`

The plan originally called for splitting into two `useTransition()` instances.
**This is necessary but not sufficient.** With two independent transitions,
dispatch and enable/disable can fire simultaneously — a user can click "Disable"
and then "Run now" before the disable completes, dispatching a task in the
process of being disabled.

**Fix:** Use a shared state machine with a single operation state, not
independent transitions:

```ts
// agent-task-actions.tsx
type OpState = 'idle' | 'dispatching' | 'toggling' | 'deleting';

const [opState, setOpState] = useState<OpState>('idle');

const handleDispatch = async () => {
  if (opState !== 'idle') return;
  setOpState('dispatching');
  try {
    const result = await dispatchAgentTask(id);
    if (result.error !== null) { toast.error(result.error); return; }
    toast.success('Task dispatched');
    router.refresh();
  } finally {
    setOpState('idle');
  }
};

const handleToggle = async () => {
  if (opState !== 'idle') return;
  setOpState('toggling');
  try {
    const result = await updateAgentTask(id, { enabled: !enabled });
    if (result.error !== null) { toast.error(result.error); return; }
    router.refresh();
  } finally {
    setOpState('idle');
  }
};

// Each button:
<Button disabled={opState !== 'idle'} loading={opState === 'dispatching'} onClick={handleDispatch}>
  Run now
</Button>
<Button disabled={opState !== 'idle'} loading={opState === 'toggling'} onClick={handleToggle}>
  {enabled ? 'Disable' : 'Enable'}
</Button>
```

**Also fix:** `deleteAgentTask` uses a raw `.then().finally()` promise chain
with **no `.catch()`** — network failures are silently swallowed. Add error
handling consistent with the other actions.

### Research Insights

**`useOptimistic` for enable/disable toggle:** The binary enabled/disabled state
is a perfect candidate for `useOptimistic` (React 19). The pattern eliminates
the perceived latency of `router.refresh()`:

```ts
const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
// Show optimisticEnabled in the button label; revert automatically if the action throws
```

**Why not `useTransition` per action:** `useTransition` tracks React's
concurrent rendering transition, not an application-level mutual exclusion. Two
separate `useTransition` instances give independent `isPending` flags but do NOT
prevent two actions from firing concurrently.

---

## API Layer Violations (CLAUDE.md Rule 2)

### 5. Raw `fetch` in `agents.ts` and `activity.ts` — must use `httpClient` (HIGH)

**Files:** `features/agents/api/agents.ts:27–64`,
`features/agents/api/activity.ts:42–78`

Both files define private fetch wrappers (`requestAgentApi`, `actionAgentApi`)
that duplicate `shared/lib/httpClient.ts` logic. CLAUDE.md Rule 2 and Rule 7
explicitly prohibit this.

**Simplified migration strategy (revised from original plan):**

> The original plan called for deleting both helpers and replacing everything
> with `httpClient`. The simpler approach: keep `actionAgentApi` but change its
> return type to `ActionResult<T>`. Delete only `requestAgentApi` (replace with
> `httpClient`). This localizes the change and avoids scattering identical
> try/catch blocks across 8 mutation functions.

**Step 1 — Replace `requestAgentApi` (GET/list calls) with `httpClient` /
`httpClientList`:**

```ts
// ❌ Old — via requestAgentApi
const { json } = await requestAgentApi<AgentProfile[]>(...)
return json.data as AgentProfile[]

// ✅ New
const { data } = await httpClientList<AgentProfile>(`${API_URL}/agent-profiles`)
return data
```

**Step 2 — Update `actionAgentApi` return type to `ActionResult<T>`:**

```ts
// ❌ Old
async function actionAgentApi<T>(...): Promise<T | AgentActionError>

// ✅ New
async function actionAgentApi<T>(...): Promise<ActionResult<T>>
// Change error return from: return { data: null, error: ..., status: ... } as AgentActionError
// To:                        return { data: null, error: ..., fieldErrors: ... }
// Change success return from: return json.data as T
// To:                          return { data: json.data as T, error: null }
```

**Step 3 — Apply safe JSON parsing** (per
`docs/solutions/integration-issues/server-action-html-response-json-parse.md`):
`requestAgentApi` currently calls `response.json()` directly. Switch to `text()`
→ `JSON.parse()` with a try/catch to handle backend HTML error pages (5xx
responses from Laravel returning HTML).

### Research Insights

**`activity.ts` migration — preserve the `hasMore` formula:**

> ⚠️ **Critical:** `httpClientList` computes
> `hasMore: data.length < totalCount`. The agents' custom calculation is
> `safeOffset + data.length < totalCount`. These are semantically different at
> offset > 0. `httpClientList.hasMore` is **wrong** for offset pagination — it
> will always return `true` unless the last page is empty. **Fix
> `httpClientList` first**, or keep the manual `hasMore` calculation in
> `getAgentActivity` while only replacing the HTTP plumbing.

Proposed fix for `shared/lib/httpClient.ts`:

```ts
// ❌ Current — wrong for offset pagination
hasMore: data.length < totalCount,

// ✅ Fixed — needs the offset parameter
hasMore: (offset + data.length) < totalCount,
```

---

### 6. Missing `revalidatePath` calls in all mutation Server Actions (MEDIUM)

**File:** `features/agents/api/agents.ts`

Mutations `createAgentProfile`, `updateAgentProfile`, `createAgentTask`,
`updateAgentTask`, `dispatchAgentTask` have zero `revalidatePath` calls.

**Fix with correct paths:**

```ts
// After createAgentProfile / updateAgentProfile / deleteAgentProfile:
revalidatePath(ROUTES.DASHBOARD.AGENT_PROFILES);
// If updating a specific profile, also:
revalidatePath(`${ROUTES.DASHBOARD.AGENT_PROFILES}/${id}`, 'layout');

// After createAgentTask / updateAgentTask / deleteAgentTask:
revalidatePath(ROUTES.DASHBOARD.AGENT_TASKS);
// For task detail mutations (update, delete):
revalidatePath(`${ROUTES.DASHBOARD.AGENT_TASKS}/${id}`, 'layout');
// ^^ The 'layout' argument revalidates the layout AND all sub-pages beneath it
// covering all 4 tab pages (/overview, /runs, /config, /json) in a single call

// After dispatchAgentTask:
revalidatePath(`${ROUTES.DASHBOARD.AGENT_TASKS}/${id}/runs`);
```

### Research Insights

**`revalidatePath` does NOT cascade to dynamic segments.**
`revalidatePath('/dashboard/agents/tasks')` only refreshes the list page.
`/dashboard/agents/tasks/42` is a separate cache entry untouched by list
revalidation.

**`'layout'` segment parameter is the key tool here.**
`revalidatePath(path, 'layout')` invalidates the named layout and all pages
under it — this is the correct approach for the task detail which has 4
sub-routes sharing one layout.

**Consider `revalidateTag` for cross-route invalidation.** For cases where agent
task data is displayed in multiple routes (e.g., today-briefing, summary),
tagging fetches with `{ next: { tags: ['agent-tasks'] } }` and calling
`revalidateTag('agent-tasks')` is more robust than path-based invalidation.

---

## Dead Code 🗑️

### 7. `AgentTasksFeed` component — unused (safe to delete)

**File:** `features/agents/ui/agent-tasks-feed.tsx`

Zero external consumers confirmed by grep. Not in `index.ts` public API. The
tasks page uses `AgentTasksList`.

**Fix:** Delete the file.

---

### 8. `AgentRunStatus` re-export in `index.ts` — unused externally

**File:** `features/agents/index.ts:8`

No file outside `agent-run-status-badge.tsx` imports `AgentRunStatus`.

**Fix:** Remove the re-export.

---

### 9. `profile_schema` field on `AgentProfile` — confirmed absent from backend (remove unconditionally)

**File:** `features/agents/model/types.ts:18`

The backend `AgentProfileResource.php` does **not** return `profile_schema`. The
field can be removed without any backend verification.

> ⚠️ **Contract gaps discovered during backend check:** The backend returns
> `config_schema` and `task_payload_schema` which are absent from the frontend
> `AgentProfile` type. These should be added (at minimum as `unknown` until
> their shape is documented).

**Fix:**

- Remove `profile_schema` from `AgentProfile`
- Add `config_schema?: Record<string, unknown> | null` and
  `task_payload_schema?: Record<string, unknown> | null` to align with backend

---

### 10. Redundant identity `.map()` in `normalizeToolOptions`

**File:** `features/agents/lib/format.ts:120–130`

After the `.filter()`, a `.map()` reconstructs `{ value, label, description }`
from objects that already have those exact fields.

**Fix:** Remove the terminal `.map()`.

---

### 11. `today-activity-feed.tsx` inline `STATUS_VARIANT` — duplicates `AgentRunStatusBadge`

**File:** `features/agents/ui/today-activity-feed.tsx:17`

Contains a `STATUS_VARIANT` record mapping the same status values that
`AgentRunStatusBadge` already owns, plus a raw `<Badge>` renderer. This is the
last remaining duplicate status renderer in `features/agents/`.

**Fix:** Import `AgentRunStatusBadge`, delete `STATUS_VARIANT`, replace the
inline `<Badge>` call.

---

## Type Issues

### 12. `AgentTaskRun.status` is loosely typed `string` — extract shared union type

**File:** `features/agents/model/types.ts:93`

`AgentTaskRun.status: string` vs
`AgentTaskLatestRun.status: 'queued' | 'processing' | 'completed' | 'failed' | null`
— same backend field, inconsistent types.

**Fix:** Extract as a named exported type, apply consistently to all three
status fields:

```ts
// ✅ Correct approach — named exported type
export type AgentRunStatus = 'queued' | 'processing' | 'completed' | 'failed';

// Apply to:
// AgentTaskRun.status: AgentRunStatus | null
// AgentTaskLatestRun.status: AgentRunStatus | null
// AgentTask.latest_run_status: AgentRunStatus | null  (currently string | null)
```

This enables exhaustiveness checking in switch statements:

```ts
// After null guard:
if (status === null) return <Badge>Unknown</Badge>;
switch (status) {
  case 'queued':      return ...;
  case 'processing':  return ...;
  case 'completed':   return ...;
  case 'failed':      return ...;
  default: {
    const _: never = status; // compile error if new status value added
    return _exhaustive;
  }
}
```

### Research Insights

**Note on backend enum:** Before finalizing the union, verify against
`app/Enums/AgentTaskRunStatus.php` in the backend. The frontend uses `running`
and `success` values not present in the backend enum, while the backend may have
`paused`. The union must match the backend's canonical values.

**`AgentRunStatusBadge` currently accepts `string`** — converting to
`AgentRunStatus | null` is a breaking change for that component's prop type.
Coordinate the changes: extract the type, update the badge component's props,
then update all call sites.

---

### 13. `AgentActionError` duplicates `ActionResult<T>` from shared

**File:** `features/agents/model/types.ts:167–185`

`AgentActionError` and `isAgentActionError()` re-implement `ActionResult<T>`
from `shared/types/server-action.ts`.

**Fix:** Remove `AgentActionError` and `isAgentActionError()`. Update
`actionAgentApi` return type to `ActionResult<T>`. Remove the `status` field
(confirmed unread by callers — verified by grep).

> ⚠️ **Call-site transformation required:** Every post-error-check code accesses
> `result.id` or `result.someField` directly after the guard. After migration:
>
> ```ts
> // ❌ Old (after isAgentActionError guard, result was T)
> router.push(`${ROUTES.DASHBOARD.AGENT_PROFILES}/${result.id}`);
>
> // ✅ New (after result.error guard, must access via result.data)
> router.push(`${ROUTES.DASHBOARD.AGENT_PROFILES}/${result.data.id}`);
> ```
>
> Affected files: `agent-profile-form.tsx:139`, `agent-task-form.tsx:198`. The
> TypeScript compiler will flag all remaining sites after deleting
> `isAgentActionError`.

> ⚠️ **Delete functions have a third bespoke shape:** `deleteAgentProfile` and
> `deleteAgentTask` return `{ error: string | null, status: number }` — not
> `AgentActionError` and not yet `ActionResult<T>`. Address these under Bug #3 /
> raw fetch migration.

**Run `tsc --noEmit` after deleting `isAgentActionError` to get a
compiler-guided list of all affected call sites.**

---

### 14. `AgentActivityResponse` duplicates `PaginatedResult<T>`

**File:** `features/agents/model/types.ts:155–159`

`AgentActivityResponse { data, totalCount, hasMore }` is structurally identical
to `PaginatedResult<AgentActivityItem>` from `shared/types/common.ts`.

**Fix:** Delete `AgentActivityResponse`. Update the return type annotation in
`activity.ts` and all consumers to `PaginatedResult<AgentActivityItem>`. No
runtime behavior changes (structural identity).

---

### 15. (NEW) Index signatures defeat TypeScript safety on core types

**File:** `features/agents/model/types.ts` — `AgentProfile`, `AgentTaskRun`,
`AgentTask` all have `[key: string]: unknown`

These open index signatures disable excess property checking, meaning typos in
property access compile silently and only fail at runtime. Example:
`profile.lateest_run_status` is valid TypeScript with an index signature.

**Fix:** Remove all `[key: string]: unknown` index signatures. The
`AgentJsonPreview` component which renders the full object with `JSON.stringify`
does not require an index signature — it can accept `Record<string, unknown>` or
`unknown` as its prop type instead.

> **Security note:** `AgentJsonPreview` renders the full agent profile/task JSON
> in the browser. Verify that `AgentProfileResource.php` and
> `AgentTaskResource.php` do not expose backend-internal fields that should not
> be client-visible.

---

## Shared Component Migrations 🔧

### 16. Raw `<input type="checkbox">` → `Checkbox` from shared

**File:** `features/agents/ui/agent-task-form.tsx:326–335`

**Fix:**

```tsx
import { Checkbox } from '@/shared/ui/input';
<Checkbox checked={field.value} onCheckedChange={field.onChange} />;
```

---

### 17. Raw `<Link>` styled as button → `ButtonLink`

**File:** `app/dashboard/agents/profiles/page.tsx:80–84`

**Fix:**

```tsx
import { ButtonLink } from '@/shared/ui/button';
<ButtonLink href={ROUTES.DASHBOARD.AGENT_PROFILES_NEW}>New profile</ButtonLink>;
```

---

### 18. Deep imports from shared barrel → use barrel index

**Files:** `features/agents/ui/agent-profile-form.tsx:18`,
`features/agents/ui/agent-task-form.tsx:19`

```ts
// ❌ Old
import { Button } from '@/shared/ui/button/Button';
import { Input } from '@/shared/ui/input/Input';
// ✅ New
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
```

---

## FSD Boundary Violation

### 19. `features/agents/lib/access.ts` imports from `features/organization`

**File:** `features/agents/lib/access.ts:3`

```ts
// ❌ Old — cross-feature import
import { getOrganizations } from '@/features/organization';
```

> ⚠️ **The migration target (`entities/organization`) does not yet have an
> `api/` layer.** It currently exports only types. The migration requires
> creating the entity's API layer.

**Migration steps:**

1. Create `entities/organization/api/organization.ts` with `'use server'`
   directive
2. Move `getOrganizations` (keep the `React.cache()` wrapper — critical for
   deduplication) into this file using `httpClientList<OrganizationProps>`
3. Re-export from `entities/organization/index.ts`
4. Update `features/agents/lib/access.ts` to import from
   `@/entities/organization`
5. Update `features/organization/api/organization.ts` to import from
   `entities/organization` (or deprecate the duplicate)

> **Scope the FSD fix to `features/agents` only.** Other features that import
> `getOrganizations` from `features/organization` can be migrated separately. Do
> not attempt a full cross-codebase migration in this refactor.

**Additional fix:** Add `'use server'` to `features/agents/lib/access.ts` (or
move to `features/agents/api/access.ts`). The file calls `cookies()` from
`next/headers` but is not marked server-only — if it is ever imported near a
Client Component boundary, it will silently break.

---

## Missing `loading.tsx` Files

### 20. Task detail layout has no loading skeleton

**Path:** `app/dashboard/agents/tasks/[id]/loading.tsx` — missing

The layout fetches `getAgentAccessContext()` + `getAgentTask()` sequentially
with no streaming fallback. The 4 inner sub-tab loading files already exist
(`overview/loading.tsx`, `runs/loading.tsx`, `config/loading.tsx`,
`json/loading.tsx`). This file covers the layout-level render only.

**Fix:** Create using the project's established bare pattern:

```tsx
import { SkeletonList } from '@/shared/ui/layout/skeleton';
export default function Loading() {
  return <SkeletonList rows={5} />;
}
```

### 21. Profile detail page has no loading skeleton

**Path:** `app/dashboard/agents/profiles/[id]/loading.tsx` — missing

### 22. Profile new page has no loading skeleton

**Path:** `app/dashboard/agents/profiles/new/loading.tsx` — missing. Fetches
`getAgentTasksMeta()` and `getAgentTools()`.

### Research Insights

**`loading.tsx` IS Suspense.** Next.js automatically wraps the page in a
Suspense boundary — there is no architectural difference between `loading.tsx`
and an explicit `<Suspense>`. Use `loading.tsx` for route-level fallbacks; use
explicit `<Suspense>` for granular streaming within a page.

**Pattern consistency:** Top-level tab `loading.tsx` files use bare
`SkeletonList` (no `PageContainer` wrapper) when the parent layout already
provides padding. Sub-tab detail pages inside a card use `SpinLoader`. Do not
add `PageContainer` inside a loading file if the parent layout already wraps
content in it.

---

## Pagination Gap

### 23. `AgentProfilesList` — add limit cap, NOT infinite scroll (YAGNI revision)

**File:** `features/agents/ui/agent-profiles-list.tsx:101`

The original plan proposed adding `useInfiniteScroll`. This is over-engineering.

**Reasoning:** Agent profiles are administrative configuration objects, not feed
content. A typical organization is expected to have fewer than 20. Adding
infinite scroll (Client Component boundary, `useCallback`, sentinel ref,
`SpinLoader`) to a 5–15 row table adds complexity with no demonstrated benefit.

**Fix:** Add a server-side `limit` cap to `getAgentProfiles()` matching the
backend's default, and display a static "Showing N of M" count if
`totalCount > data.length`:

```ts
// getAgentProfiles — add limit param (verify backend supports it first)
export async function getAgentProfiles(
  limit = 50,
): Promise<PaginatedResult<AgentProfile>> {
  return httpClientList<AgentProfile>(
    `${API_URL}/agent-profiles?limit=${limit}`,
  );
}
```

If the backend does not support pagination for this endpoint, document that
explicitly and remove the unused `totalCount` handling from `profiles/page.tsx`.

> **Revisit this decision** only if evidence shows organizations with >50
> profiles.

---

## Minor Code Quality

### 24. Misleading function name `isOrganizationManager`

**File:** `features/agents/lib/access.ts:13`

Both `'manager'` and `'employee'` roles pass this check. The backend itself
currently permits both roles on agent endpoints (checked in
`AgentProfileController::assertUserCanManageProfiles`). The function name is
misleading but the logic is intentionally correct.

**Fix:** Rename to `hasAgentAccess` AND add a comment explaining why employees
qualify:

```ts
// Both manager and employee roles can access agent management.
// Backend enforces the same permission via assertUserCanManageProfiles.
// When the backend adds manager-only guards (AppException: AGENT_PROFILE_MANAGER_REQUIRED),
// narrow this to ['manager'] only.
function hasAgentAccess(role: string): boolean {
  const normalized = role.toLowerCase();
  return normalized === 'manager' || normalized === 'employee';
}
```

### Research Insights

**Security note:** The `managerOrganizations` array computed in
`getAgentAccessContext` also filters by this function. Both the rename and the
comment must propagate there as well.

---

## Acceptance Criteria

### Bugs Fixed

- [ ] "Edit" button navigates to `/tasks/${id}/config` (not `?tab=config`)
- [ ] Run detail link navigates to `/tasks/${taskId}/runs?runId=${run.id}` (no
      `?tab=runs`)
- [ ] `getAgentTask` is wrapped in `React.cache()` — verified by checking
      network logs for single backend request
- [ ] DELETE actions handled via `httpClient` with proper 401 redirect behavior
- [ ] `OpState` state machine prevents concurrent dispatch + enable/disable
- [ ] `deleteAgentTask` has explicit `.catch()` error handling

### API Layer Clean

- [ ] No raw `fetch` in `api/agents.ts` or `api/activity.ts`
- [ ] `requestAgentApi` deleted; replaced with `httpClient` / `httpClientList`
- [ ] `actionAgentApi` return type changed to `ActionResult<T>` (or deleted if
      the simplified migration approach is used)
- [ ] All mutations return `ActionResult<T>` (no `AgentActionError`)
- [ ] `revalidatePath` called after every mutation with specific paths +
      `'layout'` argument for detail routes
- [ ] `httpClientList.hasMore` formula fixed (or manual calculation preserved)
      before migration

### Dead Code Removed

- [ ] `agent-tasks-feed.tsx` deleted
- [ ] `AgentRunStatus` removed from `index.ts` exports
- [ ] `profile_schema` removed from `AgentProfile`
- [ ] `config_schema` and `task_payload_schema` added to `AgentProfile` (backend
      contract gaps)
- [ ] Redundant `.map()` in `normalizeToolOptions` removed
- [ ] `today-activity-feed.tsx` `STATUS_VARIANT` replaced with
      `AgentRunStatusBadge`

### Types Tightened

- [ ] `export type AgentRunStatus` extracted and applied to
      `AgentTaskRun.status`, `AgentTaskLatestRun.status`,
      `AgentTask.latest_run_status`
- [ ] `AgentActionError` and `isAgentActionError()` deleted
- [ ] `AgentActivityResponse` replaced with `PaginatedResult<AgentActivityItem>`
- [ ] Index signatures removed from `AgentProfile`, `AgentTask`, `AgentTaskRun`

### Shared Components Used

- [ ] `Checkbox` from `@/shared/ui/input` in agent-task-form
- [ ] `ButtonLink` from `@/shared/ui/button` on profiles page
- [ ] All imports use barrel paths (`@/shared/ui/button`, `@/shared/ui/input`)

### FSD Boundaries

- [ ] `entities/organization/api/organization.ts` created with `'use server'`
      and `cache()`-wrapped `getOrganizations`
- [ ] `features/agents/lib/access.ts` imports `getOrganizations` from
      `@/entities/organization`
- [ ] `features/agents/lib/access.ts` marked `'use server'` (or moved to
      `features/agents/api/`)
- [ ] `fsd-boundary-guard` agent run — confirms no remaining violations in
      `features/agents`

### UX / Loading States

- [ ] `loading.tsx` created at `tasks/[id]/`, `profiles/[id]/`, `profiles/new/`
      (verify sub-tab files exist, do not recreate)
- [ ] `AgentProfilesList` has a `limit` cap in `getAgentProfiles()`

### TypeScript Compilation

- [ ] `tsc --noEmit` passes with zero errors after all changes

---

## Implementation Notes

### Order of operations (revised — dependency-aware)

1. **Backend contract check** — read `AgentProfileResource.php`,
   `AgentTaskResource.php`, `AgentTaskRunStatus.php` to finalize the
   `AgentRunStatus` union and the `config_schema`/`task_payload_schema`
   additions.

2. **Dead code** — delete `agent-tasks-feed.tsx`, strip dead exports/types, fix
   `normalizeToolOptions`. Zero risk.

3. **Type extraction** — extract `AgentRunStatus` union. Remove index signatures
   from `AgentProfile`, `AgentTask`, `AgentTaskRun`. These are foundational —
   TypeScript guides all downstream changes.

4. **`AgentActionError` + `AgentActivityResponse` migration** — these are
   interconnected with the API layer. Do as a single coordinated commit: update
   `actionAgentApi` return type → delete `AgentActionError` +
   `isAgentActionError` → run `tsc --noEmit` to find all 8 affected call sites →
   fix them → replace `AgentActivityResponse` with
   `PaginatedResult<AgentActivityItem>`.

5. **Bug fixes** — navigation URLs, `React.cache()` for double fetch, `OpState`
   state machine, fix `.catch()` on delete chain.

6. **Fix `httpClientList.hasMore` formula** — must happen before agents migrate
   to use it.

7. **API layer migration** — delete `requestAgentApi`, update `actionAgentApi`
   to use `httpClient` internally, add `revalidatePath` calls. Verify safe JSON
   parsing.

8. **FSD boundary** — create `entities/organization/api/organization.ts`,
   migrate `access.ts` import, add `'use server'`.

9. **Shared components** — `Checkbox`, `ButtonLink`, barrel imports,
   `AgentRunStatusBadge` in `today-activity-feed.tsx`.

10. **Loading skeletons** — create the 3 missing `loading.tsx` files (verify
    which are truly missing first).

11. **Profiles limit cap** — add `limit` parameter to `getAgentProfiles()`.

12. **Final** — run `fsd-boundary-guard` agent, run `tsc --noEmit`, run
    `npm run lint`.

### Files to delete

- `features/agents/ui/agent-tasks-feed.tsx`

### Files to create

- `entities/organization/api/organization.ts` (with `'use server'` + `cache()`)
- `app/dashboard/agents/tasks/[id]/loading.tsx`
- `app/dashboard/agents/profiles/[id]/loading.tsx`
- `app/dashboard/agents/profiles/new/loading.tsx`

### Key files to modify

| File                                                | Changes                                                                                                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/agents/api/agents.ts`                     | `React.cache()` on `getAgentTask`; delete `requestAgentApi`; update `actionAgentApi` to `ActionResult<T>`; delete delete raw fetch; add `revalidatePath`                          |
| `features/agents/api/activity.ts`                   | Replace raw fetch with `httpClientList`; fix `hasMore` formula                                                                                                                    |
| `features/agents/model/types.ts`                    | Extract `AgentRunStatus`; remove index signatures; delete `AgentActionError`; delete `AgentActivityResponse`; remove `profile_schema`; add `config_schema`, `task_payload_schema` |
| `features/agents/ui/agent-task-actions.tsx`         | Navigation URLs; `OpState` state machine; fix delete `.catch()`                                                                                                                   |
| `features/agents/ui/agent-task-runs-list.tsx`       | Navigation URLs (remove `?tab=runs`, keep `?runId=`)                                                                                                                              |
| `features/agents/ui/agent-task-form.tsx`            | `Checkbox`, barrel imports; update call sites for `ActionResult`                                                                                                                  |
| `features/agents/ui/agent-profile-form.tsx`         | Barrel imports; update call sites for `ActionResult`                                                                                                                              |
| `features/agents/ui/agent-profiles-list.tsx`        | Limit cap                                                                                                                                                                         |
| `features/agents/ui/today-activity-feed.tsx`        | Replace `STATUS_VARIANT` with `AgentRunStatusBadge`                                                                                                                               |
| `features/agents/lib/access.ts`                     | Rename `isOrganizationManager` → `hasAgentAccess`; add `'use server'`; update import                                                                                              |
| `features/agents/lib/format.ts`                     | Remove redundant `.map()`                                                                                                                                                         |
| `features/agents/index.ts`                          | Remove dead `AgentRunStatus` export                                                                                                                                               |
| `app/dashboard/agents/profiles/page.tsx`            | `ButtonLink`                                                                                                                                                                      |
| `app/dashboard/agents/tasks/[id]/layout.tsx`        | `Promise.all` for parallel fetches                                                                                                                                                |
| `app/dashboard/agents/tasks/[id]/overview/page.tsx` | Remove duplicate `getAgentTask` (handled by `React.cache()`)                                                                                                                      |
| `app/dashboard/agents/tasks/[id]/json/page.tsx`     | Remove duplicate `getAgentTask`                                                                                                                                                   |
| `entities/organization/index.ts`                    | Re-export `getOrganizations` from api layer                                                                                                                                       |
| `shared/lib/httpClient.ts`                          | Fix `hasMore` formula in `httpClientList`                                                                                                                                         |

---

## References

- `shared/lib/httpClient.ts` — HTTP client with auth, 401 handling, redirect
- `shared/types/server-action.ts` — `ActionResult<T>`
- `shared/types/common.ts` — `PaginatedResult<T>`
- `shared/ui/layout/skeleton.tsx` — `Skeleton`, `SkeletonList`
- `shared/ui/button/button-link.tsx` — `ButtonLink`
- `shared/ui/input/Checkbox.tsx` — `Checkbox`
- `shared/hooks/use-infinite-scroll.ts` — pagination hook (not needed for
  profiles)
- `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
  — safe JSON parsing (text → parse → validate)
- CLAUDE.md — API layer rules 1-7, FSD layer rules, revalidatePath rule
- [Next.js — Fetching Data: Sharing data with React.cache](https://nextjs.org/docs/app/getting-started/fetching-data#sharing-data-with-context-and-reactcache)
- [Next.js — revalidatePath API reference](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js — Streaming guide](https://nextjs.org/docs/app/guides/streaming)
