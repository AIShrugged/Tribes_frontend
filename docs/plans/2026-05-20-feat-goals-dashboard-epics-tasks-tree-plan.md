---
title: "feat: Goals Dashboard — Epics as Goals with Tasks Tree"
type: feat
status: active
date: 2026-05-20
deepened: 2026-05-20
---

# feat: Goals Dashboard — Epics as Goals with Tasks Tree

## Enhancement Summary

**Deepened on:** 2026-05-20
**Research agents used:** architecture-strategist, performance-oracle, kieran-typescript-reviewer, security-sentinel, code-simplicity-reviewer, julik-frontend-races-reviewer, best-practices-researcher, framework-docs-researcher, pattern-recognition-specialist, feasibility+product reviewer, testing strategy, learnings applicability, frontend-design

### Key Improvements Discovered

1. **No `features/goals/` slice needed** — merge 7 planned files into 4 files inside `features/issues/ui/`. Epics are issues; the FSD slice would create cross-feature import violations.
2. **`Issue` type lives in `features/issues/`, not `entities/`** — `features/goals/` cannot legally import it. Either migrate `Issue` to `entities/issue/` first, or keep everything in `features/issues/`.
3. **N+1 fan-out of 100 epics × 100 tasks = catastrophic** — use Suspense streaming (each EpicCard is an async Server Component) + `React.cache()` on `getEpics()`, not `Promise.all` with N requests.
4. **`child_issues` only loaded on `GET /issues/{id}` (show), NOT on list** — confirmed from backend research. Fan-out or per-card fetch is required.
5. **`httpClient` strips `meta` field** — `getFocusedIssues()` must use raw fetch with safe text-then-parse pattern to surface `has_focus`/`matched_count`.
6. **Progress bar needs RAG coloring** (0%=gray, 1-33%=amber, 34-66%=violet, 67-99%=green, 100%=gradient) — industry standard for OKR dashboards.
7. **`sessionStorage` in `FocusReminderBanner` causes SSR hydration mismatch** — must use `useEffect` to defer the check.
8. **`isLinking` guard required** on link-to-epic button to prevent double-submit race.
9. **Unlinked task cap (100) is a silent data correctness bug** — not just UX; tasks beyond the limit are silently excluded. Must show warning or paginate.
10. **Tab redirect must stay in sync**: if Goals tab is added first, `redirect()` in `issues/page.tsx` must change to `ISSUES_GOALS`, or Goals goes after Kanban.

### New Considerations Discovered

- `FocusedIssuesMeta` should be a discriminated union: `{ has_focus: false } | { has_focus: true; focus_text: string; matched_count: number }`
- `computeProgress` should use `reduce` (single pass) and include `blocked` count for paused/review/reopen tasks
- `LinkToEpicButton` must live in `entities/issue/ui/` (presentation shell only) or `features/issues/ui/` (with mutation) — NOT in `features/goals/`
- `EpicGoalCard` hover should use named group `group/epic` to prevent CSS leaking into nested `group/taskrow`
- Missing `loading.tsx` for the new Goals tab is a required convention per CLAUDE.md
- `epic_id=null` filter does not exist on backend — must request backend addition or show "up to N" warning
- `inProgress` field in `GoalProgress` should be renamed `active` and count all non-terminal statuses

---

## Overview

Add a **"Goals"** tab inside the existing issues section at `/dashboard/issues/goals`. The page gives managers a single view of all open epics (= goals) with their linked tasks, progress bars, and an **"Unlinked Tasks"** block for tasks not attached to any epic.

**Key product rules confirmed:**
- Goal = Epic = Issue with `type: 'epic'`; depth is 2 (epic → tasks only, no sub-epics)
- Progress = % of child tasks with `status: 'done'`
- Only non-archived, non-done epics are shown (see gap: recently-done epics pass `exclude_archived` — needs explicit `status != done` filter or dedicated section)
- Clicking an epic header → `/dashboard/issues/[id]` (existing detail page)
- "View in Kanban" → `/dashboard/issues/kanban?epic_id=X` (1 click)

---

## Problem Statement

- Managers see tasks in a flat list or kanban with no sense of which epics/goals they contribute to.
- Employees have no way to see "why does this task matter" in-context.
- `task_groups.focused` and `GET /api/v1/me/issues/focused` are implemented in the backend but unused in the frontend.
- `features/user-focus/` described in `docs/focus-tasks.md` as complete is **absent** from the repo — those components need to be rebuilt from scratch.
- Issue detail page (`/dashboard/issues/[id]`) shows `epic_id` but renders no parent-epic link visually.

---

## Backend API Contracts (no new backend work needed for Phase 1)

### Epics list
```
GET /api/v1/issues?type=epic&exclude_archived=true&limit=100
```
Response: `IssueResource[]` with `assignee`, `issueType`, `epic` (always null for epics).
**`child_issues` is NOT returned on list** — only on `GET /api/v1/issues/{id}` (show).

### Child tasks for one epic
```
GET /api/v1/issues?epic_id={id}&exclude_archived=true&limit=100
```
Progress computed client-side: `done_count / total * 100`.

### Unlinked tasks
⚠️ **Gap**: no `epic_id=null` filter exists in backend `IssueRequest`. Work-around: fetch all non-epic tasks, filter `epic_id === null` client-side. **Known correctness bug: tasks beyond `limit:100` per type are silently missed.** Show a UI warning: "Showing up to 200 tasks — some may not appear."

Request backend add `unlinked=1` param (1-line change in controller).

### Alternative for child tasks (avoids per-epic fan-out)
```
GET /api/v1/issues/{epicId}    ← returns child_issues[] inline
```
Use per-card lazy-load: when card expands, trigger `getIssue(epicId)` to load `child_issues`. This eliminates upfront fan-out entirely.

### Focus endpoints
```
GET    /api/v1/me/focus
PUT    /api/v1/me/focus   { focus_text, deadline?, issue_ids? }
DELETE /api/v1/me/focus
GET    /api/v1/me/issues/focused   → meta: { has_focus, focus_text, matched_count }
```

---

## Architecture

### CRITICAL: No `features/goals/` slice

The `Issue` type lives in `features/issues/model/types.ts`, not `entities/`. A new `features/goals/` slice would need to import from `features/issues/` — a cross-feature FSD violation.

**Decision:** All new Goals UI goes in `features/issues/ui/`. The Goals tab is a new view of issues, not a separate domain.

To reuse `LinkToEpicButton` on the issue detail page (Phase 3), it must go in `entities/issue/ui/link-to-epic-button.tsx` (presentation only, no Server Action call). The mutation wrapper stays in `features/issues/ui/`.

### New routes

```
/dashboard/issues/goals    ← new tab in issues section
```

Add to `shared/lib/routes.ts`:
```ts
ISSUES_GOALS: '/dashboard/issues/goals',
```

Add to `app/dashboard/issues/(tabs)/`:
```
(tabs)/goals/page.tsx        ← async Server Component, Suspense streaming
(tabs)/goals/loading.tsx     ← required by CLAUDE.md tab convention
```

**Tab ordering and redirect:** Add Goals tab to `issues-tabs-nav.tsx`. Because `app/dashboard/issues/page.tsx` currently redirects to `ISSUES_KANBAN`, either:
- Keep Goals as 2nd tab (after Kanban), or
- Change the redirect to `ISSUES_GOALS` if it's intended as the primary view.
Both the tab array order and the redirect must be kept in sync.

Add tab with `preserveSearchParams={true}` (inherited from existing `IssuesTabsNav`).

### New files (4 files, not 7)

```
features/issues/ui/
  goals-page.tsx              ← server component orchestration
  epic-goal-card.tsx          ← card + progress bar + collapsible trigger + local EpicTaskRow
  unlinked-tasks-section.tsx  ← dashed-border section for orphaned tasks
  link-to-epic-button.tsx     ← popover to pick epic, calls linkTaskToEpic Server Action

entities/issue/ui/
  link-to-epic-button.tsx     ← (Phase 3) presentation shell only, no Server Action;
                                 accepts onLink: (epicId: number) => void prop
```

**Do NOT create standalone files for:**
- `goals-empty-state.tsx` — inline `<EmptyState icon={Target} title="No open goals yet" />` from `shared/ui/feedback/empty-state`
- `epic-task-row.tsx` — local function `EpicTaskRow` inside `epic-goal-card.tsx`
- `epic-tasks-list.tsx` — inline inside `epic-goal-card.tsx` using `CollapsibleSection` from `shared/ui/layout/collapsible-section`

### Restore `features/user-focus/` (Phase 2, built from scratch)

```
features/user-focus/
  api/
    focus.ts              ← getFocus(), setFocus(), clearFocus(), getFocusedIssues()
  model/
    types.ts              ← UserFocus, FocusedIssuesMeta (discriminated union)
  ui/
    focus-block.tsx           ← editable focus text + deadline
    readonly-focus-block.tsx  ← read-only display
    focus-reminder-banner.tsx ← dismissible banner (sessionStorage via useEffect)
    focused-tasks-block.tsx   ← server component, calls getFocusedIssues()
  index.ts
```

---

## TypeScript Types

### `features/issues/model/` additions (or new file `goals-types.ts`)

```ts
export interface GoalProgress {
  total: number;
  done: number;
  active: number;       // renamed from inProgress; counts in_progress | paused | review | reopen
  open: number;         // not yet started
  percent: number;      // Math.round(done / total * 100) or 0
  isEmpty: boolean;     // total === 0 — prevents 0% bar looking same as "no tasks"
  trend: 'up' | 'flat' | 'down';  // MVP: always 'flat'
}

export interface EpicWithProgress {
  epic: Issue;          // full Issue with type='epic'
  tasks: Issue[];       // child tasks (non-epic only: filter child_issues where type !== 'epic')
  progress: GoalProgress;
}
```

### `features/user-focus/model/types.ts`

```ts
export interface UserFocus {
  focus_text: string | null;
  deadline: string | null;    // 'YYYY-MM-DD'
  expires_at: string | null;  // ISO datetime
}

// Discriminated union — eliminates impossible states
export type FocusedIssuesMeta =
  | { has_focus: false; focus_text: null; matched_count?: never }
  | { has_focus: true; focus_text: string; matched_count: number };

export interface FocusedIssuesResult {
  data: Issue[];
  meta: FocusedIssuesMeta;
}
```

---

## Progress Calculation

```ts
// features/issues/model/goals-progress.ts

const ACTIVE_STATUSES = new Set<IssueStatus>(['in_progress', 'paused', 'review', 'reopen']);

export function computeProgress(tasks: Issue[]): GoalProgress {
  // Filter out any nested epics (depth guard)
  const nonEpicTasks = tasks.filter(t => t.type !== 'epic');

  const counts = nonEpicTasks.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<IssueStatus, number>>,
  );

  const total = nonEpicTasks.length;
  const done = counts.done ?? 0;
  const active = nonEpicTasks.filter(t => ACTIVE_STATUSES.has(t.status)).length;
  const open = counts.open ?? 0;

  return {
    total,
    done,
    active,
    open,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    isEmpty: total === 0,
    trend: 'flat',
  };
}
```

---

## Data Loading Strategy

### Page-level (Suspense streaming — NO upfront fan-out)

```tsx
// app/dashboard/issues/(tabs)/goals/page.tsx
import { Suspense } from 'react';
import { getEpics } from '@/features/issues/api/issues';  // already React.cache()-wrapped
import { EpicGoalCard, EpicGoalCardSkeleton } from '@/features/issues/ui/epic-goal-card';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Target } from 'lucide-react';
import { getCurrentOrgId } from '@/shared/lib/org';

export default async function GoalsPage() {
  const orgId = await getCurrentOrgId();
  const epics = await getEpics(orgId);  // fast — React.cache() deduplicates with layout

  if (epics.length === 0) {
    return <EmptyState icon={Target} title="No open goals yet" description="Create an epic to start tracking team goals." />;
  }

  return (
    <div className="space-y-4 p-6">
      {epics.map((epic) => (
        <Suspense key={epic.id} fallback={<EpicGoalCardSkeleton />}>
          {/* Each card is async — fetches its own tasks on expand or load */}
          <EpicGoalCard epic={epic} />
        </Suspense>
      ))}
      <Suspense fallback={<UnlinkedTasksSkeleton />}>
        <UnlinkedTasksSection orgId={orgId} epics={epics} />
      </Suspense>
    </div>
  );
}
```

### Per-card task loading (two options — choose one)

**Option A: Lazy-load on expand (recommended for performance)**
- Card renders with epic header + progress bar showing 0/empty initially
- User expands → client calls `getIssue(epicId)` to get `child_issues` inline
- No upfront fan-out; tasks load on demand

**Option B: Upfront streaming per card (better UX for small epic counts)**
```tsx
// features/issues/ui/epic-goal-card.tsx (async Server Component)
export async function EpicGoalCard({ epic }: { epic: Issue }) {
  const { data: tasks } = await getIssues({
    epic_id: epic.id,
    exclude_archived: true,
    limit: 100,
  });
  const nonEpicTasks = tasks.filter(t => t.type !== 'epic');
  const progress = computeProgress(nonEpicTasks);
  return <EpicGoalCardClient epic={epic} tasks={nonEpicTasks} progress={progress} />;
}
```

With Suspense, each card's tasks stream in independently. 20 parallel card fetches are tolerable (not 100).

**For unlinked tasks:**
```ts
// features/issues/ui/unlinked-tasks-section.tsx (async Server Component)
async function UnlinkedTasksSection({ orgId, epics }: { orgId: number; epics: Issue[] }) {
  // Fetch up to 200 tasks (100 dev + 100 org) in parallel
  const epicIds = new Set(epics.map(e => e.id));
  const [devResult, orgResult] = await Promise.allSettled([
    getIssues({ type: 'development', exclude_archived: true, limit: 100, organization_id: orgId }),
    getIssues({ type: 'organization', exclude_archived: true, limit: 100, organization_id: orgId }),
  ]);
  const devTasks = devResult.status === 'fulfilled' ? devResult.value.data : [];
  const orgTasks = orgResult.status === 'fulfilled' ? orgResult.value.data : [];

  const unlinked = [...devTasks, ...orgTasks].filter(t => t.epic_id === null);
  const hasMore = (devResult.status === 'fulfilled' && devResult.value.hasMore)
                || (orgResult.status === 'fulfilled' && orgResult.value.hasMore);

  return (
    <UnlinkedTasksSectionClient
      tasks={unlinked}
      epics={epics}
      hasMore={hasMore}  // show "up to 200 tasks" warning when true
    />
  );
}
```

### React.cache() for getEpics deduplication

The `(tabs)/layout.tsx` already calls `getEpics()`. The Goals page also calls it. Wrap with `React.cache()` to deduplicate within a single render:

```ts
// features/issues/api/issues.ts
import { cache } from 'react';

export const getEpics = cache(async (organizationId?: number | null): Promise<Issue[]> => {
  // existing implementation unchanged
});
```

---

## API Layer

### `features/issues/api/issues.ts` additions

```ts
// New: single-task link (singular variant of existing linkIssuesToEpic)
// Note: parameter order matches existing convention: epicId first, then issueIds
export async function linkTaskToEpic(
  epicId: number,
  taskId: number,
): Promise<ActionResult<Issue>> {
  // Guard against invalid IDs
  if (!Number.isInteger(epicId) || epicId <= 0 || !Number.isInteger(taskId) || taskId <= 0) {
    return { data: null, error: 'Invalid task or epic ID' };
  }
  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ epic_id: epicId }),
      headers: { 'Content-Type': 'application/json' },
    });
    revalidatePath('/dashboard/issues', 'layout');  // layout scope: refreshes all tabs
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', 'Failed to link task');
      return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
    }
    throw error;
  }
}
```

### `features/user-focus/api/focus.ts`

```ts
'use server';

import { httpClient } from '@/shared/lib/httpClient';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';
import { ServerError } from '@/shared/lib/errors';
import { parseApiError } from '@/shared/lib/apiError';
import { revalidatePath } from 'next/cache';
import { API_URL } from '@/shared/lib/config';
import type { ActionResult } from '@/shared/types/server-action';
import type { UserFocus, FocusedIssuesResult } from '../model/types';

export async function getFocus(): Promise<UserFocus | null> {
  const { data } = await httpClient<UserFocus>(`${API_URL}/me/focus`);
  return data;
}

export async function setFocus(payload: {
  focus_text: string;
  deadline?: string | null;
  issue_ids?: number[] | null;
}): Promise<ActionResult<UserFocus>> {
  // Validate length at the Server Action boundary (HTML maxLength can be bypassed)
  if (payload.focus_text.length > 500) {
    return { data: null, error: 'Focus text must be 500 characters or fewer' };
  }
  try {
    const { data } = await httpClient<UserFocus>(`${API_URL}/me/focus`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    revalidatePath('/dashboard/issues', 'layout');
    revalidatePath('/dashboard/today', 'layout');
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', 'Failed to set focus');
      return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
    }
    throw error;
  }
}

export async function clearFocus(): Promise<ActionResult<null>> {
  try {
    await httpClient(`${API_URL}/me/focus`, { method: 'DELETE' });
    revalidatePath('/dashboard/issues', 'layout');
    revalidatePath('/dashboard/today', 'layout');
    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', 'Failed to clear focus');
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

// getFocusedIssues uses raw fetch because httpClient strips the meta field.
// The meta field (has_focus, focus_text, matched_count) is critical for display logic.
export async function getFocusedIssues(): Promise<FocusedIssuesResult> {
  const authHeaders = await getAuthHeaders();
  const url = `${API_URL}/me/issues/focused`;

  const res = await fetch(url, {
    headers: authHeaders as HeadersInit,
    cache: 'no-store',
  });

  // Safe text-then-parse (prevents SyntaxError on Laravel HTML 5xx pages)
  const text = await res.text();
  let json: { data: Issue[]; meta: FocusedIssuesMeta };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new ServerError('Invalid JSON from focused issues endpoint', {
      url, responseBody: text, status: res.status,
    });
  }

  if (!res.ok) {
    throw new ServerError('Failed to load focused issues', {
      url, responseBody: text, status: res.status,
    });
  }

  return { data: json.data ?? [], meta: json.meta };
}
```

---

## Implementation Phases

### Phase 1 — Goals tab (epics tree + unlinked tasks) ← DEMO MVP

**Acceptance criteria:**
- [ ] `ISSUES_GOALS: '/dashboard/issues/goals'` added to `shared/lib/routes.ts`
- [ ] Goals tab added to `features/issues/ui/issues-tabs-nav.tsx` with `preserveSearchParams`
- [ ] Tab order and `redirect()` in `issues/page.tsx` are in sync
- [ ] `app/dashboard/issues/(tabs)/goals/loading.tsx` created (required by CLAUDE.md)
- [ ] `getEpics()` wrapped with `React.cache()` in `features/issues/api/issues.ts`
- [ ] Page uses Suspense streaming — each EpicGoalCard is a separate async Server Component
- [ ] Each epic card shows: name, description (line-clamp-2), RAG progress bar, task counts, assignee
- [ ] Progress bar uses RAG coloring: 0%=gray, 1-33%=amber, 34-66%=violet, 67-99%=green, 100%=gradient
- [ ] `computeProgress` counts all non-terminal statuses as `active` (not just `in_progress`)
- [ ] Epic cards with 0 tasks show "No tasks yet" instead of a 0% progress bar (`isEmpty` flag)
- [ ] Sub-epics in `child_issues` are filtered out before progress calculation
- [ ] Collapsible task list starts collapsed; auto-expands if any task is `in_progress` or `review`
- [ ] Tasks list uses disclosure widget ARIA: `aria-expanded`, `aria-controls`, `role="region"`
- [ ] Progress bar has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`
- [ ] "View in Kanban" link: `href="/dashboard/issues/kanban?epic_id={id}"`, visible on hover
- [ ] "Tasks Without a Goal" section at bottom with dashed border treatment
- [ ] Unlinked tasks section: shows "up to 200 tasks" warning when `hasMore === true`
- [ ] `LinkToEpicButton` in unlinked section has `isLinking` guard (prevents double-submit)
- [ ] After linking, `revalidatePath('/dashboard/issues', 'layout')` called
- [ ] `linkTaskToEpic` validates `Number.isInteger(id) && id > 0` before sending to backend
- [ ] Empty state: `<EmptyState icon={Target} title="No open goals yet" />` (no separate file)
- [ ] Mobile-responsive (stacked cards on small screens)

**Files to create/modify:**

| File | Action |
|------|--------|
| `shared/lib/routes.ts` | Add `ISSUES_GOALS` constant |
| `features/issues/ui/issues-tabs-nav.tsx` | Add Goals tab; sync with `issues/page.tsx` redirect |
| `app/dashboard/issues/page.tsx` | Update redirect if Goals becomes primary tab |
| `app/dashboard/issues/(tabs)/goals/page.tsx` | New: Suspense streaming page |
| `app/dashboard/issues/(tabs)/goals/loading.tsx` | New: skeleton (required) |
| `features/issues/api/issues.ts` | Wrap `getEpics` with `React.cache()`; add `linkTaskToEpic()` |
| `features/issues/model/goals-progress.ts` | New: `GoalProgress`, `computeProgress()` |
| `features/issues/ui/epic-goal-card.tsx` | New: async Server Component + client island |
| `features/issues/ui/unlinked-tasks-section.tsx` | New: async Server Component + client section |
| `features/issues/ui/link-to-epic-button.tsx` | New: popover + isLinking guard |

---

### Phase 2 — User Focus UI (rebuild from scratch)

**Acceptance criteria:**
- [ ] `features/user-focus/api/focus.ts` exists with all 4 functions
- [ ] `getFocusedIssues()` uses raw fetch with safe text-then-parse (not httpClient) for meta field
- [ ] `FocusedIssuesMeta` is a discriminated union
- [ ] `FocusReminderBanner` checks `sessionStorage` only in `useEffect` (not during render) to avoid hydration mismatch
- [ ] `FocusedTasksBlock` server component renders on `/dashboard/today/tasks`
- [ ] `FocusReminderBanner` placed in `app/dashboard/issues/(tabs)/layout.tsx`
- [ ] `FocusBlock` (editable) on `/dashboard/profile/account`
- [ ] `ReadonlyFocusBlock` on `/dashboard/today/tasks`
- [ ] `TodayBriefing` TypeScript type extended with `task_groups?: TodayTaskGroups`
- [ ] `setFocus` validates `focus_text.length <= 500` at Server Action level

**Files to create/modify:**

| File | Action |
|------|--------|
| `features/user-focus/api/focus.ts` | New: 4 functions (raw fetch for getFocusedIssues) |
| `features/user-focus/model/types.ts` | New: UserFocus, FocusedIssuesMeta discriminated union |
| `features/user-focus/ui/focus-block.tsx` | New (editable) |
| `features/user-focus/ui/readonly-focus-block.tsx` | New |
| `features/user-focus/ui/focus-reminder-banner.tsx` | New (useEffect for sessionStorage) |
| `features/user-focus/ui/focused-tasks-block.tsx` | New (server component) |
| `features/user-focus/index.ts` | New |
| `features/today-briefing/model/types.ts` | Add `task_groups` field |
| `app/dashboard/today/tasks/page.tsx` | Mount `FocusedTasksBlock` |
| `app/dashboard/issues/(tabs)/layout.tsx` | Mount `FocusReminderBanner` |

---

### Phase 3 — Issue detail: parent epic link + unlinked hint

**Acceptance criteria:**
- [ ] When viewing a task with `epic !== null`: show `Epic: [epic.name]` breadcrumb → links to `/dashboard/issues/[epic.id]`
- [ ] When viewing a task with `epic_id === null`: show "This task is not linked to any goal" hint + link button
- [ ] `LinkToEpicButton` presentation shell extracted to `entities/issue/ui/link-to-epic-button.tsx` (no Server Action, accepts `onLink` prop)
- [ ] Issue detail re-uses the same presentation component without cross-feature import

**Files to modify:**

| File | Action |
|------|--------|
| `entities/issue/ui/link-to-epic-button.tsx` | New: presentation shell only |
| `app/dashboard/issues/[id]/page.tsx` or rendered component | Add epic breadcrumb |
| `features/issues/ui/issue-detail.tsx` | Add epic link + unlinked hint using entity button |

**MVP acceleration:** Move the epic breadcrumb to Phase 1 — it's a 30-minute change to the detail page and directly addresses the employee JTBD. Add a single conditional block above the form.

---

## Component Design (Tailwind Classes)

### Progress Bar (RAG-colored)

```tsx
const PROGRESS_FILL: Record<string, string> = {
  empty:   'bg-neutral-700',
  low:     'bg-amber-400',       // 1-33%
  mid:     'bg-violet-400',      // 34-66%  (--primary-400)
  high:    'bg-emerald-400',     // 67-99%  (--success-500)
  done:    'bg-gradient-to-r from-violet-400 to-emerald-400',  // 100%
};

function getProgressFill(pct: number): string {
  if (pct === 0)   return PROGRESS_FILL.empty;
  if (pct <= 33)   return PROGRESS_FILL.low;
  if (pct <= 66)   return PROGRESS_FILL.mid;
  if (pct < 100)   return PROGRESS_FILL.high;
  return PROGRESS_FILL.done;
}

// Track + fill
<div
  role="progressbar"
  aria-valuenow={pct}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuetext={`${pct}% complete`}
  className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10"
>
  <div
    className={`h-full rounded-full transition-[width] duration-300 ease-out ${getProgressFill(pct)}`}
    style={{ width: `${pct}%` }}
  />
</div>
```

### EpicGoalCard outer shell

```tsx
// Named group to prevent CSS bleed into nested rows
<div className="
  group/epic
  rounded-[var(--radius-card)]
  border border-border
  bg-card
  transition-shadow duration-200
  hover:shadow-[0_0_0_1px_var(--primary-700)]
  hover:border-primary-700/40
">
```

### EpicTaskRow (local function inside epic-goal-card.tsx)

```tsx
function EpicTaskRow({ task }: { task: Issue }) {
  return (
    <Link href={`/dashboard/issues/${task.id}`} className="
      group/taskrow
      flex items-center justify-between gap-3
      border-b border-border last:border-b-0
      px-5 py-2.5
      hover:bg-white/5
      transition-colors duration-150
    ">
      <div className="flex items-center gap-2.5 min-w-0">
        <IssueStatusBadge status={task.status} />
        <span className="truncate text-sm text-foreground
          group-hover/taskrow:text-primary-300 transition-colors duration-150">
          {task.name}
        </span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {task.assignee?.name ?? 'Unassigned'}
      </span>
    </Link>
  );
}
```

### UnlinkedTasksSection (dashed border, de-emphasized)

```tsx
<section className="
  rounded-[var(--radius-card)]
  border border-dashed border-border
  bg-white/[0.02]
  overflow-hidden
">
  {/* Header */}
  <div className="flex items-center gap-2 px-5 py-3 border-b border-dashed border-border">
    <Unlink className="h-4 w-4 text-muted-foreground" />
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
      Tasks Without a Goal
    </span>
    <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
      {count}
    </span>
  </div>
  {/* Warning when truncated */}
  {hasMore && (
    <p className="px-5 py-2 text-xs text-amber-400 bg-amber-400/5 border-b border-dashed border-border">
      Showing up to 200 tasks — some unlinked tasks may not appear.
    </p>
  )}
</section>
```

---

## ARIA / Accessibility

### Collapsible task list (disclosure widget — not `role="tree"`)

```tsx
<button
  type="button"
  aria-expanded={open}
  aria-controls={`tasks-${epic.id}`}
  onClick={toggle}
  className="..."
>
  <ChevronDown className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
  {open ? 'Hide tasks' : `Show ${total} tasks`}
</button>
<div
  id={`tasks-${epic.id}`}
  role="region"
  aria-label={`Tasks for: ${epic.name}`}
  hidden={!open}
>
  {tasks.map(task => <EpicTaskRow key={task.id} task={task} />)}
</div>
```

Note: Use disclosure widget (Option B from research), not `role="tree"`. Tree role requires arrow-key navigation which is unusual for web UIs.

---

## Race Conditions & Async Safety

### LinkToEpicButton — double-submit guard

```tsx
'use client';
const [isLinking, setIsLinking] = useState(false);

const handleLink = async (epicId: number) => {
  if (isLinking) return;   // close the door immediately
  setIsLinking(true);
  try {
    const result = await linkTaskToEpic(epicId, taskId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Task linked to goal');
      setOpen(false);
    }
  } finally {
    setIsLinking(false);
  }
};
```

### FocusReminderBanner — avoid hydration mismatch

```tsx
'use client';
const [dismissed, setDismissed] = useState(false);  // always render visible on server

useEffect(() => {
  // Only runs client-side, after hydration is complete
  if (sessionStorage.getItem('focus_banner_dismissed') === 'true') {
    setDismissed(true);
  }
}, []);

if (dismissed || !focus) return null;
```

---

## Known Gaps & Risks

| Gap | Severity | Mitigation |
|-----|----------|------------|
| No `epic_id=null` backend filter | High | Client-side filter with "up to 200" warning; request backend `unlinked=1` param |
| Recently-done epics pass `exclude_archived` | Medium | Add explicit `status != done` filter or show in "Completed Goals" section |
| `child_issues` not on list endpoint — requires per-card fetch | Medium | Suspense streaming + lazy-load on expand; acceptable for ≤20 epics |
| N concurrent card fetches can pressure backend | Medium | Cap via Suspense: browser streams naturally; limit=50 per card |
| `features/user-focus/` entirely absent | High | Phase 2: rebuild from scratch per docs/focus-tasks.md spec |
| `task_groups` missing from `TodayBriefing` TypeScript type | Medium | Phase 2: add with proper DTO mapping |
| `getEpics()` not wrapped with `React.cache()` currently | Medium | Phase 1 prerequisite: wrap before page ships |
| `httpClient` strips `meta` field | Medium | `getFocusedIssues()` uses raw fetch with safe text-then-parse |
| No IDOR scope check for `epicId` on PATCH | Medium | Read `IssueUpdateRequest.php` + Policy before writing action; UI scopes picker to org epics |
| No `middleware.ts` for dashboard auth | Low | Existing pattern; not introduced by this feature |

---

## Testing Strategy

### Unit tests (highest ROI first)

**`computeProgress()` — 11 cases**
```ts
// features/issues/model/__tests__/goals-progress.test.ts
describe('computeProgress', () => {
  it('returns 0 percent for empty array');
  it('returns 0 when no tasks done, total > 0');
  it('returns 100 when all tasks done');
  it('rounds 1/3 down to 33');
  it('rounds 2/3 up to 67');
  it('counts all ACTIVE_STATUSES in active field (paused, review, reopen, in_progress)');
  it('sets isEmpty: true when total === 0');
  it('sets isEmpty: false when total > 0');
  it('filters out nested epics before calculation');
  it('always returns trend: flat');
  it('computes in single pass (immutable reduce)');
});
```

**`linkTaskToEpic()` Server Action — 7 cases**
```ts
// features/issues/api/__tests__/linkTaskToEpic.test.ts
// Mock httpClient, revalidatePath
it('calls PATCH /issues/{taskId} with { epic_id: epicId }');
it('returns { data, error: null } on success');
it('calls revalidatePath after success');
it('returns { data: null, error } when ServerError thrown');
it('does NOT call revalidatePath on failure');
it('re-throws non-ServerError exceptions');
it('returns error when taskId or epicId is invalid integer');
```

**`EpicGoalCard` — 10 RTL cases**
```ts
it('renders epic name and description');
it('renders progress bar with role="progressbar"');
it('"View in Kanban" link has correct href with epic_id param');
it('task list hidden by default');
it('task list expands on toggle click');
it('button label changes to "Hide tasks" when expanded');
it('collapses on second click');
it('does not render toggle when 0 tasks');
it('shows "No tasks yet" when isEmpty: true');
it('auto-expands when a task is in_progress');
```

**`LinkToEpicButton` — 8 RTL cases + `FocusReminderBanner` — 7 cases** (see Enhancement Summary)

### E2E (Playwright — `e2e/goals.spec.ts`)
- Page loads and shows epic cards
- "View in Kanban" navigates with correct `?epic_id=X` param
- Task list expand/collapse
- Link task to epic → success toast
- FocusReminderBanner dismiss + stays dismissed on reload
- Empty state when no epics exist

---

## FSD Compliance Summary

| Import | Legal? | Notes |
|--------|--------|-------|
| `features/issues/ui/` → `entities/issue/` | ✅ | Shared domain types/badges |
| `features/issues/ui/` → `shared/ui/` | ✅ | Reusable primitives |
| `features/user-focus/` → `entities/issue/` | ✅ | Issue type for focused tasks |
| `features/user-focus/` → `features/issues/` | ❌ | Use `entities/issue/` instead |
| `app/` → `features/issues/` public API | ✅ | Via index.ts |
| `entities/issue/ui/` → Server Actions | ❌ | Entities are presentation only |

---

## Success Criteria

- Manager opens Goals tab and within 30 seconds sees all open epics with progress bars
- Progress bar color immediately signals on-track vs. at-risk (RAG coloring)
- "View in Kanban" for an epic shows only that epic's tasks
- "Tasks Without a Goal" block is visible with link-to-goal action
- Task detail page shows parent epic breadcrumb (Phase 3 or accelerated to Phase 1)
- No new backend endpoints required for Phase 1 MVP

---

## References

### Internal
- `features/issues/api/issues.ts` — `getEpics()` (~line 360), `getIssues()` (~line 81), `linkIssuesToEpic()`
- `features/issues/model/types.ts` — `Issue`, `IssueFilters`, `IssueStatus`
- `entities/issue/model/types.ts` — `IssueStatus`, `EpicOption`, `SharedFilters`
- `features/issues/ui/issues-tabs-nav.tsx` — tab definition pattern; must keep `preserveSearchParams`
- `app/dashboard/issues/(tabs)/layout.tsx` — server layout with parallel fetches
- `app/dashboard/issues/(tabs)/progress/page.tsx` — server page with Suspense + searchParams
- `shared/ui/feedback/empty-state.tsx` — reuse for empty Goals state
- `shared/ui/layout/collapsible-section.tsx` — use for collapsible task list
- `shared/lib/routes.ts` — add `ISSUES_GOALS`
- `docs/focus-tasks.md` — full spec for `features/user-focus/` rebuild
- `docs/solutions/integration-issues/server-action-html-response-json-parse.md` — safe text-then-parse pattern (applied to `getFocusedIssues`)

### Backend
- `GET /api/v1/issues` — `type`, `epic_id`, `exclude_archived`, `limit`, `offset` filters
- `PATCH /api/v1/issues/{id}` — `{ epic_id: number | null }` to link/unlink
- `GET /api/v1/issues/{id}` — returns `child_issues[]` on show (not on list)
- `GET /api/v1/me/focus` / `PUT` / `DELETE` — UserFocus CRUD
- `GET /api/v1/me/issues/focused` — returns `data: Issue[]` + `meta: { has_focus, focus_text, matched_count }`
- `IssueResource.php` — `epic_id`, `epic` (id/name/status), `child_issues` (show only), `assignee`

### External research
- [Next.js v16 — Parallel data fetching + `Promise.allSettled`](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js v16 — Suspense streaming](https://nextjs.org/docs/app/getting-started/fetching-data)
- [React.cache() deduplication](https://nextjs.org/docs/app/getting-started/caching)
- [ARIA disclosure widget pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- [ARIA progressbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/progressbar_role)
- [OKR progress status coloring — Microsoft Viva Goals](https://learn.microsoft.com/en-us/viva/goals/track-okr-progress-status)

---

## Implementation Log

### Phase 1 — Goals Tab MVP ✅ Done (2026-05-20)

**Что реализовано:** Вкладка «Goals» в разделе issues, дерево Цель → Задачи с прогресс-баром и блоком непривязанных задач.

#### Новые файлы

| Файл | Назначение |
|------|-----------|
| `app/dashboard/issues/(tabs)/goals/page.tsx` | Страница Goals — async Server Component со Suspense-стримингом по каждому эпику |
| `app/dashboard/issues/(tabs)/goals/loading.tsx` | Skeleton-fallback при навигации (required by CLAUDE.md) |
| `features/issues/ui/epic-goal-card.tsx` | Карточка одного эпика: название, RAG прогресс-бар, список дочерних задач. Содержит `EpicGoalCardSkeleton`. |
| `features/issues/ui/unlinked-tasks-section.tsx` | Блок «Tasks without a goal» — задачи без `epic_id`. Предупреждение при >100 задачах. |
| `features/issues/ui/link-to-epic-button.tsx` | Client Component: inline-дропдаун для привязки задачи к эпику. `isLinking`-guard от двойного сабмита. |
| `features/issues/model/goals-progress.ts` | `computeProgress(tasks)` → `GoalProgress`. `getProgressColor(progress)` → RAG Tailwind-класс. |

#### Изменённые файлы

| Файл | Что изменилось |
|------|----------------|
| `shared/lib/routes.ts` | Добавлен `ISSUES_GOALS: '/dashboard/issues/goals'` |
| `features/issues/api/issues.ts` | `getEpics()` обёрнут в `React.cache()` для дедупликации; добавлен `linkTaskToEpic(epicId, taskId)` |
| `features/issues/index.ts` | Экспортирован `linkTaskToEpic` |
| `features/issues/ui/issues-tabs-nav.tsx` | Добавлена вкладка «Goals» (4-я, после Progress) |

#### Как открыть

`/dashboard/issues` → вкладка **Goals** (последняя справа).

#### Известные ограничения (Phase 1)

- Бэкенд не поддерживает `epic_id=null` фильтр → непривязанные задачи фильтруются на фронте из первых 100. При >100 задачах в организации часть может не отображаться (показывается предупреждение).
- Запрошено у бэкенда: добавить `unlinked=1` параметр в `IssueRequest`.

---

### Phase 2 — Rebuild `features/user-focus/` ⬜ Pending

Файлы: `features/user-focus/api/focus.ts`, `model/types.ts`, `ui/focus-block.tsx`, `ui/readonly-focus-block.tsx`, `ui/focus-reminder-banner.tsx`, `ui/focused-tasks-block.tsx`.

### Phase 3 — Issue detail: parent epic breadcrumb ⬜ Pending

Файл: `entities/issue/ui/link-to-epic-button.tsx` (presentation shell), добавить в `/dashboard/issues/[id]`.
