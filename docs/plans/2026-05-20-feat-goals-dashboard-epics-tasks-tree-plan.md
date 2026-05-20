---
title: "feat: Goals Dashboard — Epics as Goals with Tasks Tree"
type: feat
status: active
date: 2026-05-20
---

# feat: Goals Dashboard — Epics as Goals with Tasks Tree

## Overview

Add a **"Goals"** tab to the existing issues section at `/dashboard/issues/goals`. The page gives managers a single view of all open epics (= goals) with their linked tasks (progress bar, assignee, direction), plus an **"Unlinked Tasks"** block for tasks not attached to any epic. Individual issue cards already show an `epic_id` link — we make it visible and clickable.

**Key product rules confirmed:**
- Goal = Epic = Issue with `type: 'epic'`; depth is 2 (epic → tasks only, no sub-epics)
- Progress = % of child tasks with `status: 'done'`
- Only non-closed (non-archived) epics are shown
- Clicking on an epic header goes to the existing `/dashboard/issues/[id]` detail page
- "One-click to kanban with filter" = navigate to `/dashboard/issues/kanban?epic_id=X`

---

## Problem Statement

- Managers see tasks in a flat list or kanban with no sense of which epics/goals they contribute to.
- Employees have no way to see "why does this task matter" in-context.
- `task_groups.focused` and `GET /api/v1/me/issues/focused` are implemented in the backend but unused in the frontend.
- `features/user-focus/` described in `docs/focus-tasks.md` as complete is **absent** from the repo — those components need to be rebuilt.
- Issue detail page (`/dashboard/issues/[id]`) shows `epic_id` but renders no parent-epic link visually.

---

## Backend API Contracts (no new backend work needed)

### Epics list
```
GET /api/v1/issues?type=epic&exclude_archived=true&limit=100
```
Response: `IssueResource[]` with `assignee`, `issueType`, `epic` (always null for epics). **`child_issues` is NOT returned on list** — we must load them separately per epic.

### Child tasks for one epic
```
GET /api/v1/issues?epic_id={id}&exclude_archived=true&limit=100
```
Response: paginated `IssueResource[]`. Progress computed client-side: `done_count / total_count * 100`.

### Unlinked tasks
```
GET /api/v1/issues?exclude_archived=true&epic_id=null   // backend does not support epic_id=null filter!
```
⚠️ **Gap**: the backend `IssueRequest` does NOT support `epic_id=null` to filter "no epic". Work-around: fetch all non-epic tasks (`type=development` and `type=organization`), then filter client-side for `epic_id === null`. Since the list may be large, fetch with `limit=100&offset=0` and paginate if needed. Use `exclude_archived=true`.

Alternative work-around for unlinked tasks: backend team can add `unlinked=true` param — but MVP should not block on this. Client-side filter is acceptable for the demo.

### Single epic with child_issues (for detail view)
```
GET /api/v1/issues/{epicId}
```
Returns `child_issues: IssueResource[]` inline.

### Focus endpoints (already documented in docs/focus-tasks.md)
```
GET  /api/v1/me/focus
PUT  /api/v1/me/focus   { focus_text, deadline?, issue_ids? }
DELETE /api/v1/me/focus
GET  /api/v1/me/issues/focused
```

---

## Architecture

### New routes

```
/dashboard/issues/goals                 → Goals tab (new tab in issues section)
```

Add to `shared/lib/routes.ts`:
```ts
ISSUES_GOALS: '/dashboard/issues/goals',
```

Add to `app/dashboard/issues/(tabs)/`:
```
(tabs)/goals/page.tsx        ← server component, fetches epics in parallel
(tabs)/goals/loading.tsx     ← skeleton
```

Add tab to `features/issues/ui/issues-tabs-nav.tsx`:
```ts
{ href: ROUTES.DASHBOARD.ISSUES_GOALS, label: 'Goals' },
```

Insert as first tab (most important view for managers), or between Kanban and Tasktracker.

---

### New feature module: `features/goals/`

```
features/goals/
  api/
    goals.ts          ← getEpicsWithProgress(), getUnlinkedTasks(), linkTaskToEpic()
  model/
    types.ts          ← EpicWithProgress, GoalProgress
  ui/
    goals-page.tsx          ← main layout (server component); fetches data, renders sections
    epic-goal-card.tsx      ← one epic card: name, desc, progress-bar, assignee, actions
    epic-tasks-list.tsx     ← collapsible list of child tasks under an epic
    epic-task-row.tsx       ← single task row in the goal tree
    unlinked-tasks-block.tsx  ← "Tasks Without a Goal" section
    link-to-epic-button.tsx   ← dropdown to pick an epic and link the task (1-click)
    goals-empty-state.tsx     ← shown when no open epics exist
  index.ts
```

---

### Restore `features/user-focus/` (described in docs but missing from repo)

Per `docs/focus-tasks.md`, these components are designed but absent:

```
features/user-focus/
  api/
    focus.ts              ← getFocus(), setFocus(), clearFocus(), getFocusedIssues()
  model/
    types.ts              ← UserFocus, FocusedIssuesMeta
  ui/
    focus-block.tsx       ← editable focus text + deadline; used in /dashboard/profile/account
    readonly-focus-block.tsx  ← read-only display; used in /dashboard/today/tasks
    focus-reminder-banner.tsx  ← dismissible banner in issues layout
    focused-tasks-block.tsx    ← server component, calls getFocusedIssues(), shows cards
  index.ts
```

**MVP scope:** The Goals dashboard does NOT require user-focus. However since the PRD gap table lists this as "малая" complexity and it blocks `/dashboard/today/tasks` UX, include it in this plan as Phase 2.

---

### Fix: Issue detail page — show parent epic link

File: `app/dashboard/issues/[id]/page.tsx` or its rendered component.

When `issue.epic_id !== null && issue.epic !== null`:
- Show a breadcrumb/badge: `Epic: [epic.name]` → links to `/dashboard/issues/[epic.id]`
- When `issue.epic === null` and issue is a non-epic task: show hint "This task is not linked to any goal. Link it?"

---

## TypeScript Types

### `features/goals/model/types.ts`
```ts
export interface GoalProgress {
  total: number;
  done: number;
  inProgress: number;
  percent: number;          // Math.round(done / total * 100) or 0
  trend: 'up' | 'flat';    // MVP: always 'flat' — trend requires historical data
}

export interface EpicWithProgress {
  epic: Issue;              // full Issue with type='epic'
  tasks: Issue[];           // child tasks fetched via epic_id filter
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

export interface FocusedIssuesMeta {
  has_focus: boolean;
  focus_text: string | null;
  matched_count?: number;
}
```

---

## Implementation Phases

### Phase 1 — Goals tab (epics tree + unlinked tasks) ← DEMO MVP

**Acceptance criteria:**
- [ ] New "Goals" tab appears in issues tabs nav
- [ ] Page loads all open epics (type=epic, exclude_archived=true)
- [ ] Each epic card shows: name, description (truncated), progress bar (% done), assignee avatar+name, task count
- [ ] Clicking epic name goes to `/dashboard/issues/[id]`
- [ ] "View in Kanban" button navigates to `/dashboard/issues/kanban?epic_id=[id]` (1 click)
- [ ] Tasks under each epic are shown in a collapsible list (collapsed by default), each row has status badge + assignee + name link
- [ ] "Tasks Without a Goal" block appears at the bottom, shows non-epic tasks where `epic_id === null` (client-side filter, max 50 shown, "load more" for rest)
- [ ] Each unlinked task has "Link to goal" button — opens a popover/select to choose an epic, calls `PATCH /api/v1/issues/{id}` with `{ epic_id: selectedEpicId }`
- [ ] After linking, the page re-validates (uses `revalidatePath`)
- [ ] Loading state: skeleton cards for epics, loading spinner for tasks
- [ ] Empty state when no epics exist: "No open goals. Create an epic to get started."
- [ ] Mobile-responsive (stacked cards on small screens)

**Files to create/modify:**

| File | Action |
|------|--------|
| `shared/lib/routes.ts` | Add `ISSUES_GOALS` constant |
| `features/issues/ui/issues-tabs-nav.tsx` | Add Goals tab |
| `app/dashboard/issues/(tabs)/goals/page.tsx` | New server page |
| `app/dashboard/issues/(tabs)/goals/loading.tsx` | New skeleton |
| `features/goals/api/goals.ts` | New: `getEpicsWithProgress()`, `getUnlinkedTasks()`, `linkTaskToEpic()` |
| `features/goals/model/types.ts` | New: `EpicWithProgress`, `GoalProgress` |
| `features/goals/ui/goals-page.tsx` | New: main orchestration component |
| `features/goals/ui/epic-goal-card.tsx` | New: one epic card |
| `features/goals/ui/epic-tasks-list.tsx` | New: collapsible tasks |
| `features/goals/ui/epic-task-row.tsx` | New: task row |
| `features/goals/ui/unlinked-tasks-block.tsx` | New: unlinked section |
| `features/goals/ui/link-to-epic-button.tsx` | New: link-to-epic action |
| `features/goals/ui/goals-empty-state.tsx` | New: empty state |
| `features/goals/index.ts` | New: public exports |

**Data loading strategy for page.tsx:**
```ts
// 1. Fetch all open epics
const epics = await getEpics(orgId);  // existing function, reuse

// 2. Fetch child tasks for each epic in parallel (Promise.all)
const epicTaskLists = await Promise.all(
  epics.map(epic => getIssues({ epic_id: epic.id, exclude_archived: true, limit: 100 }))
);

// 3. Fetch non-epic tasks for unlinked block (two calls: dev + org type)
const [devTasks, orgTasks] = await Promise.all([
  getIssues({ type: 'development', exclude_archived: true, limit: 100 }),
  getIssues({ type: 'organization', exclude_archived: true, limit: 100 }),
]);
const allNonEpicTasks = [...devTasks.data, ...orgTasks.data];
const unlinkedTasks = allNonEpicTasks.filter(t => t.epic_id === null);
```

**Progress calculation** (client-side in `features/goals/model/types.ts`):
```ts
export function computeProgress(tasks: Issue[]): GoalProgress {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  return {
    total,
    done,
    inProgress,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    trend: 'flat',  // MVP: no history
  };
}
```

---

### Phase 2 — User Focus UI (restore missing components)

**Acceptance criteria:**
- [ ] `features/user-focus/api/focus.ts` exists with `getFocus()`, `setFocus()`, `clearFocus()`, `getFocusedIssues()`
- [ ] `FocusedTasksBlock` server component renders on `/dashboard/today/tasks` between FocusBlock and TaskStatsBlock
- [ ] `FocusReminderBanner` dismissible banner placed in `app/dashboard/issues/(tabs)/layout.tsx`
- [ ] `FocusBlock` (editable) on `/dashboard/profile/account`
- [ ] `ReadonlyFocusBlock` on `/dashboard/today/tasks`
- [ ] `TodayBriefing` TypeScript type extended with `task_groups?: TodayTaskGroups`
- [ ] `task_groups.focused` rendered in today view

**Files to create/modify:**

| File | Action |
|------|--------|
| `features/user-focus/api/focus.ts` | New |
| `features/user-focus/model/types.ts` | New |
| `features/user-focus/ui/focus-block.tsx` | New (editable) |
| `features/user-focus/ui/readonly-focus-block.tsx` | New |
| `features/user-focus/ui/focus-reminder-banner.tsx` | New |
| `features/user-focus/ui/focused-tasks-block.tsx` | New (server component) |
| `features/user-focus/index.ts` | New |
| `features/today-briefing/model/types.ts` | Add `task_groups` field |
| `app/dashboard/today/tasks/page.tsx` | Mount `FocusedTasksBlock` |
| `app/dashboard/issues/(tabs)/layout.tsx` | Mount `FocusReminderBanner` |

**API functions in `features/user-focus/api/focus.ts`:**
```ts
'use server';

export async function getFocus(): Promise<UserFocus | null>
export async function setFocus(payload: { focus_text: string; deadline?: string | null; issue_ids?: number[] | null }): Promise<ActionResult<UserFocus>>
export async function clearFocus(): Promise<ActionResult<null>>
export async function getFocusedIssues(): Promise<{ data: Issue[]; meta: FocusedIssuesMeta }>
```

---

### Phase 3 — Issue detail: parent epic link + unlinked hint

**Acceptance criteria:**
- [ ] When viewing a task (`type !== 'epic'`) that has `epic !== null`, display `Epic: [epic.name]` breadcrumb linking to that epic's detail page
- [ ] When viewing a task with `epic_id === null`, display: "This task is not linked to any goal." with "Link to goal" button
- [ ] The link-to-goal button in detail view opens same `LinkToEpicButton` popover from Phase 1

**Files to modify:**

| File | Action |
|------|--------|
| `app/dashboard/issues/[id]/page.tsx` (or rendered component) | Add epic breadcrumb section |
| `features/issues/ui/issue-detail.tsx` (or equivalent) | Add epic link + unlinked hint |
| `features/goals/ui/link-to-epic-button.tsx` | Reuse from Phase 1 (must be exported via `features/goals/index.ts`) |

---

## Component Sketches

### `epic-goal-card.tsx`
```
┌─────────────────────────────────────────────────────────────────┐
│ [Epic icon] Q2 Platform Stability              [View in Kanban →]│
│ Improve system reliability and reduce bug rate                   │
│                                                                  │
│ ████████████░░░░░░░░  60%   8/13 tasks done                     │
│ Assigned to: Alex Kim                                            │
│                                                                  │
│ [▼ Show 13 tasks]                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Expanded tasks list
```
│   ✓ Fix auth token expiry bug          done      Alex Kim       │
│   → Refactor API rate limiting         in_progress  Alex Kim    │
│   ○ Add circuit breaker               open      Unassigned      │
│   ...                                                           │
```

### Unlinked tasks block
```
┌─────────────────────────────────────────────────────────────────┐
│ Tasks Without a Goal (12)                                       │
│                                                                  │
│ Update dependencies          open    Unassigned   [Link to goal]│
│ Write onboarding docs        open    Sam Chen     [Link to goal]│
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Known Gaps & Risks

| Gap | Severity | Mitigation |
|-----|----------|------------|
| No `epic_id=null` filter on backend | Medium | Client-side filter in Phase 1. Request backend add `unlinked=true` param for Phase 2. |
| N+1 problem: one request per epic for child tasks | Medium | Use `Promise.all()` so requests run in parallel. Acceptable for MVP (max ~100 epics). |
| No progress trend (direction indicator) | Low | Show 'flat' for MVP. Historical stats would require a new backend endpoint or storing snapshots. |
| `features/user-focus/` entirely absent despite docs saying "completed" | High | Rebuild from spec in Phase 2. All API contracts are known (docs/focus-tasks.md). |
| `task_groups` missing from `TodayBriefing` TypeScript type | Medium | Add in Phase 2 with proper DTO mapping. |
| Link-to-epic mutates `epic_id` via `PATCH /api/v1/issues/{id}` — must check auth | Low | Backend enforces ownership/policy; just handle 403 in `ActionResult`. |
| Kanban link with `?epic_id=X` — filter must be wired to `SharedFiltersBar` | Low | `epic_id` is already a valid `KanbanFilters` field; URL param already passes through `IssuesLayoutClient`. |

---

## FSD Compliance

- `features/goals/` imports from `entities/issue/` (`Issue` type, `IssueStatus`) — allowed
- `features/goals/` does NOT import from `features/issues/` — use `entities/issue/` for shared types
- `features/user-focus/` imports from `entities/issue/` for `Issue` type — allowed
- `app/dashboard/issues/(tabs)/goals/page.tsx` imports `GoalsPage` from `features/goals/` public API only
- `LinkToEpicButton` used in both `features/goals/` and issue detail — export it from `features/goals/index.ts`, import in issue detail via public API (**cross-feature import** — put it in `entities/issue/ui/` instead if used in multiple features)

**Recommendation:** `LinkToEpicButton` should live in `entities/issue/ui/link-to-epic-button.tsx` to avoid cross-feature import violations.

---

## Success Criteria

- Manager opens Goals tab and within 30 seconds sees all open epics with progress %
- Clicking "View in Kanban" for an epic shows only that epic's tasks in kanban board
- "Tasks Without a Goal" block is visible and non-empty tasks can be linked to an epic in one interaction
- Task detail page shows parent epic or prompts to link one
- No new backend endpoints needed for Phase 1

---

## References

### Internal
- `features/issues/api/issues.ts` — `getEpics()` (line ~360), `getIssues()` (line ~81), `linkIssuesToEpic()` 
- `features/issues/model/types.ts` — `Issue`, `IssueFilters`, `EpicOption` interfaces
- `entities/issue/model/types.ts` — `IssueStatus`, `SharedFilters`, `VALID_ISSUE_BACKEND_TYPES`
- `features/issues/ui/issues-tabs-nav.tsx` — tab definition pattern to follow
- `app/dashboard/issues/(tabs)/layout.tsx` — server layout pattern with parallel fetches
- `app/dashboard/issues/(tabs)/progress/page.tsx` — server page with search params pattern
- `shared/lib/routes.ts` — ROUTES.DASHBOARD constants
- `features/menu/lib/options.ts` — sidebar nav (no new nav item needed; Goals is a tab)
- `docs/focus-tasks.md` — full spec for `features/user-focus/` rebuild

### Backend
- `GET /api/v1/issues` — supports `type`, `epic_id`, `exclude_archived`, `limit`, `offset` filters
- `PATCH /api/v1/issues/{id}` — `{ epic_id: number | null }` to link/unlink
- `GET /api/v1/issues/{id}` — returns `child_issues[]` on show
- `GET /api/v1/me/focus` / `PUT` / `DELETE` — UserFocus CRUD
- `GET /api/v1/me/issues/focused` — focused issues with 3-level fallback
- `IssueResource.php` — `epic_id`, `epic` (id/name/status), `child_issues` (show only), `assignee`
