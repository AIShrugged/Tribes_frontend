---
title: feat: Goals Tab — Dashboard Enhancements
type: feat
status: active
date: 2026-05-28
deepened: 2026-05-28
---

# feat: Goals Tab — Dashboard Enhancements

## Enhancement Summary

**Deepened on:** 2026-05-28 **Research agents used:** feasibility-reviewer,
scope-guardian, kieran-typescript-reviewer, performance-oracle,
security-sentinel, julik-frontend-races-reviewer, code-simplicity-reviewer,
best-practices-researcher, frontend-design, architecture-strategist,
unit-test-booster, learning-file check

### Key Improvements Added by Deepening

1. **TypeScript bugs found** — `IssueProps` type doesn't exist (must be
   `Issue`); missing `'use server'` in action snippet; missing `data!` non-null
   assertion; implicit truthy check on `close_date` must be `!== null`
2. **Race condition fix** — `DetachFromEpicButton` must use card-level
   `isDetaching` flag, not per-row `useTransition`, to prevent concurrent detach
   double-revalidation
3. **sessionStorage flash fix** — `useState<boolean | null>(null)` pattern with
   `null` = not-yet-determined prevents layout shift; avoid `useEffect`-only
   approach
4. **Performance: revalidatePath narrowed** — use
   `revalidatePath('/dashboard/issues/goals')` (page scope) instead of
   `('layout')` for detach; layout-scope forces expensive parallel refetches
5. **Single-pass trend algorithm** — fold `doneRecent`/`donePrior` into the
   existing `for` loop in `computeProgress`; pre-compute cutoffs as `.getTime()`
   numbers
6. **Security guards** — add `Number.isInteger(taskId) && taskId > 0` guard in
   `detachTaskFromEpic` (mirrors `linkTaskToEpic`); add
   `isNaN(parsed.getTime())` guard for `close_date` parsing
7. **Simplification** — do NOT create `detach-from-epic-button.tsx` as a
   separate file; inline it in `epic-goal-card.tsx`; reuse `LinkToEpicButton`
   inside `IssueNoGoalHint`; omit "Notify manager" entirely
8. **FSD compliance** — only export `IssueNoGoalHint` from `index.ts`;
   `DetachFromEpicButton` stays internal
9. **Design system alignment** — specific Tailwind classes for all new UI
   elements (amber banner, hover-only detach button with `Unlink` icon, trailing
   trend icon)
10. **Test strategy** — 25+ test cases across 3 files; `goals-progress.test.ts`
    covers all 9 color branches + trend edge cases

### New Considerations Discovered

- `close_date` from `'date-fns'` `parseISO` is safer than `new Date()` — avoids
  timezone ambiguity on date-only strings
- `startOfDay(subDays(now, 7))` gives whole-day windows (not hour-accurate);
  this is correct for velocity trend
- `exclude_type` backend filter param has **no backend handler** — do not rely
  on it; always filter `t.type !== 'epic'` client-side
- Pre-existing FSD violation in `[id]/page.tsx` (deep import of
  `IssueAuditLogSection`) — fix opportunistically when touching that file
- `data!` non-null assertion is required in all `httpClient` success returns per
  codebase pattern

---

## Overview

The `/dashboard/issues/goals` tab already has a solid foundation (route,
`EpicGoalCard`, `UnlinkedTasksSection`, `computeProgress`, `LinkToEpicButton`).
This plan covers **four enhancements** to make the tab fully match the spec:

1. **Trend direction** on the progress bar (growing / stable / falling) —
   derived from `close_date` on already-fetched tasks, no new API call
2. **Assignee display** on `EpicGoalCard` — field is already present in the API
   response
3. **Detach task from goal** ("remove from focus" → inline button) —
   `PATCH epic_id: null` on each task row
4. **"No goal" hint on issue detail page** — dismissible banner when
   `issue.epic_id === null && issue.type !== 'epic'`

> **Key insight:** The Goals tab is ~70% implemented. All work is additive. No
> architectural changes, no new API routes, no new backend endpoints needed.

---

## What Already Exists (Do Not Re-implement)

| Item                              | File                                            | Status                                     |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Route + tab                       | `shared/lib/routes.ts` → `ISSUES_GOALS`         | ✅ done                                    |
| Tab in nav                        | `features/issues/ui/issues-tabs-nav.tsx`        | ✅ done                                    |
| Goals page                        | `app/dashboard/issues/(tabs)/goals/page.tsx`    | ✅ done                                    |
| `loading.tsx`                     | `app/dashboard/issues/(tabs)/goals/loading.tsx` | ✅ done                                    |
| `EpicGoalCard`                    | `features/issues/ui/epic-goal-card.tsx`         | ✅ done (missing assignee + trend display) |
| `computeProgress`                 | `features/issues/model/goals-progress.ts`       | ✅ done (trend hardcoded `'flat'`)         |
| `UnlinkedTasksSection`            | `features/issues/ui/unlinked-tasks-section.tsx` | ✅ done                                    |
| `LinkToEpicButton`                | `features/issues/ui/link-to-epic-button.tsx`    | ✅ done                                    |
| Kanban link with `epic_id` filter | `EpicGoalCard` kanbanHref                       | ✅ done                                    |

---

## Problem Statement

### What the spec requires that is missing

1. **Progress direction** — `computeProgress` always returns `trend: 'flat'`.
   The card shows no "growing/stable/falling" indicator.
2. **Goal owner** — `EpicGoalCard` does not render `epic.assignee`, though the
   field is always present in the API response (backend loads
   `['assignee', 'issueType', 'epic']` on `GET /api/v1/issues`).
3. **Detach from goal** — there is no way to unlink a task from its epic from
   the Goals tab. Only linking is possible.
4. **Issue detail hint** — a non-epic issue with `epic_id === null` shows no
   guidance suggesting the user link it to a goal.

---

## Technical Approach

### Backend API facts confirmed

- `GET /api/v1/issues?type=epic` lists epics with `assignee` eagerly loaded — no
  change needed
- `GET /api/v1/issues?epic_id=X` lists child tasks including their `close_date`
  — all data for trend is available
- `PATCH /api/v1/issues/{id}` with `{ epic_id: null }` is explicitly handled in
  `IssueRequest::getUpdateData()` via `if ($this->has('epic_id'))` — no new
  endpoint needed
- History endpoint `GET /api/v1/issues/stats/history` does NOT accept `epic_id`
  — trend must be computed client-side
- **`exclude_type` query param has no backend handler** — always filter
  `t.type !== 'epic'` client-side (as `UnlinkedTasksSection` already does)

### Trend algorithm (corrected)

Integrated into the **existing `for` loop** in `computeProgress` for a single
pass. Cutoff dates computed once as `.getTime()` numbers before the loop.

```ts
import { parseISO, subDays, startOfDay } from 'date-fns';

export function computeProgress(
  tasks: Issue[],
  now: Date = new Date(),
): GoalProgress {
  const nonEpicTasks = tasks.filter((t) => t.type !== 'epic');

  // Pre-compute cutoffs as ms numbers for performance — computed once outside loop
  const sevenDaysAgoMs = startOfDay(subDays(now, 7)).getTime();
  const fourteenDaysAgoMs = startOfDay(subDays(now, 14)).getTime();

  const counts: Partial<Record<IssueStatus, number>> = {};
  let doneRecent = 0; // closed in last 7 days
  let donePrior = 0; // closed 7–14 days ago

  for (const task of nonEpicTasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;

    if (task.status === 'done' && task.close_date !== null) {
      const parsed = parseISO(task.close_date);
      if (!isNaN(parsed.getTime())) {
        // guard against malformed dates
        const closedMs = parsed.getTime();
        if (closedMs >= sevenDaysAgoMs) {
          doneRecent++;
        } else if (closedMs >= fourteenDaysAgoMs) {
          donePrior++;
        }
      }
    }
  }

  const total = nonEpicTasks.length;
  const done = counts.done ?? 0;
  // ... rest of existing logic

  const trend: GoalProgress['trend'] =
    total === 0
      ? 'flat'
      : doneRecent > donePrior
        ? 'up'
        : doneRecent === 0 && donePrior > 0
          ? 'down'
          : 'flat';

  return { total, done, active, open, percent, isEmpty, trend };
}
```

**Key decisions from research:**

- Use `parseISO` from `date-fns` (not `new Date()`) — avoids timezone ambiguity
  on date-only strings
- Use `startOfDay(subDays(...))` for whole-day windows
- `isNaN(parsed.getTime())` guard — prevents silent bugs from malformed
  `close_date` strings
- `total === 0` → always `'flat'` (prevents misleading `'down'` on new epics
  with no tasks)

### "Remove from goal" — hard detach, inlined

**Decision: hard detach** (not localStorage soft-hide). Backend supports
`PATCH epic_id: null`.

**Simplification decision:** Do NOT create a separate
`detach-from-epic-button.tsx` file. Inline the button directly in
`EpicGoalCard`'s `EpicTaskRow` function — it has exactly one consumer and is ~15
lines.

**Race condition mitigation:** The detach button is controlled by a
**card-level** `isDetaching` state passed down to all rows, not per-row
`useTransition`. This prevents concurrent detach calls from racing with each
other's `revalidatePath`.

```tsx
// Inside EpicGoalCardContent (client component wrapper needed)
const [isDetaching, setIsDetaching] = useState(false);

async function handleDetach(taskId: number) {
  if (isDetaching) return;
  setIsDetaching(true);
  try {
    const result = await detachTaskFromEpic(taskId);
    if (result.error) toast.error(result.error);
    else toast.success('Removed from goal');
  } finally {
    setIsDetaching(false);
  }
}
```

**Note:** `EpicGoalCardContent` must become `'use client'` to hold the
`isDetaching` state. `EpicTasksList` remains an async Server Component; it
passes task data down to a client content wrapper.

### "No goal" hint — issue detail

Dismissible banner. **Reuse `LinkToEpicButton`** for the epic selector — do not
duplicate the dropdown logic.

**sessionStorage flash prevention** — use `useState<boolean | null>(null)` where
`null` means "not yet determined". Render nothing until the `useEffect` fires
and reads storage. This prevents the flash (component renders nothing → effect
reads storage → if not dismissed, shows banner):

```tsx
'use client';
const STORAGE_KEY = (issueId: number) =>
  `issue-hint-v1-${issueId}-no-goal-dismissed`;

export function IssueNoGoalHint({
  issueId,
  epics,
}: {
  issueId: number;
  epics: Issue[];
}) {
  // Validate prop before any storage interaction
  if (!Number.isInteger(issueId) || issueId <= 0) return null;

  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY(issueId)) === '1');
  }, [issueId]);

  // null = not yet determined → render nothing (prevents SSR/hydration flash)
  if (dismissed === null || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY(issueId), '1');
    setDismissed(true);
  }

  return (
    <div role='alert' className='...amber banner...'>
      <p>This task is not linked to any goal.</p>
      {epics.length > 0 && <LinkToEpicButton taskId={issueId} epics={epics} />}
      <button type='button' aria-label='Dismiss' onClick={handleDismiss}>
        <X className='h-3.5 w-3.5' />
      </button>
    </div>
  );
}
```

**"Notify manager" CTA: omit entirely.** Showing a disabled dead-end button
creates confusion and maintenance debt. It belongs in a future notification
feature.

---

## Implementation Phases

### Phase 1 — Trend direction in `computeProgress`

**Files to change:**

- `features/issues/model/goals-progress.ts` — update `computeProgress` per
  corrected algorithm above
- `features/issues/model/__tests__/goals-progress.test.ts` — update/add tests

**Changes:**

- Add `import { parseISO, subDays, startOfDay } from 'date-fns'`
- Update signature: `computeProgress(tasks: Issue[], now: Date = new Date())`
- Fold `doneRecent`/`donePrior` counters into the existing `for` loop
- Return correct `trend` value (see algorithm above)

**No other files need changing for Phase 1** — `EpicGoalCardContent` already
receives `progress.trend`.

---

### Phase 2 — Display trend + assignee in `EpicGoalCard`

**Files to change:**

- `features/issues/ui/epic-goal-card.tsx`

**Changes:**

1. **Assignee** — in the `EpicGoalCard` card header, add a third line after
   description:

```tsx
{
  epic.assignee !== null && epic.assignee !== undefined && (
    <p className='mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]/70'>
      <UserCircle className='h-3 w-3 shrink-0' aria-hidden='true' />
      <span className='truncate'>{epic.assignee.name}</span>
    </p>
  );
}
```

2. **Trend icon** — trailing the `%` label in `EpicGoalCardContent`:

```tsx
<span className='flex items-center gap-1 text-xs font-medium text-[var(--foreground)]'>
  {progress.isEmpty ? '—' : `${progress.percent.toString()}%`}
  {!progress.isEmpty &&
    (progress.trend === 'up' ? (
      <TrendingUp
        className='h-3 w-3 text-emerald-500 shrink-0'
        aria-label='trending up'
      />
    ) : progress.trend === 'down' ? (
      <TrendingDown
        className='h-3 w-3 text-amber-500 shrink-0'
        aria-label='trending down'
      />
    ) : (
      <Minus
        className='h-3 w-3 text-[var(--muted-foreground)] shrink-0'
        aria-label='stable'
      />
    ))}
</span>
```

3. Add imports: `TrendingUp`, `TrendingDown`, `Minus`, `UserCircle` from
   `lucide-react`

**Design rationale (from design research):**

- Trend icon **trails** the `%` number — keeps number right-aligned with the
  progress bar below
- `TrendingUp` → emerald (matches the ≥67% progress bar color)
- `TrendingDown` → amber (warning tier, matches ≤33% bar)
- `Minus` → muted (neutral, no alarm)
- Assignee at `text-[10px]` (one step below `text-xs`) with `/70` opacity —
  clear hierarchy without disappearing

---

### Phase 3 — Detach task from goal

**Two changes: one new action + one UI modification.**

**`features/issues/api/issues.ts`** — add `detachTaskFromEpic`:

```ts
export async function detachTaskFromEpic(
  taskId: number,
): Promise<ActionResult<Issue>> {
  // Mirror the guard in linkTaskToEpic
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { data: null, error: 'Invalid task ID' };
  }
  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ epic_id: null }),
      headers: { 'Content-Type': 'application/json' },
    });
    revalidatePath('/dashboard/issues/goals'); // page-scope only — not 'layout'
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to remove task from goal',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}
```

**Key decisions from research:**

- `revalidatePath('/dashboard/issues/goals')` (page scope, not `'layout'`) —
  `'layout'` forces expensive parallel refetches of organizations/persons/epics
  on every detach; only the goals page content needs revalidation
- `data!` non-null assertion — required by codebase pattern (all other actions
  do this)
- Return type `ActionResult<Issue>` (not `IssueProps` — that type doesn't exist)
- Integer guard mirrors `linkTaskToEpic` pattern

**`features/issues/ui/epic-goal-card.tsx`** — inline detach button in
`EpicTaskRow`:

`EpicGoalCardContent` needs to become `'use client'` to hold `isDetaching`
state. Restructure:

- `EpicTasksList` (async Server Component): fetches tasks, computes progress,
  renders
  `<EpicGoalCardClient tasks={tasks} progress={progress} barColor={barColor} />`
- `EpicGoalCardClient` (`'use client'`): holds `isDetaching` state, renders the
  progress bar + task rows + detach buttons

**`EpicTaskRow` detach button** (hover-only, inline in the same file):

```tsx
<button
  type='button'
  aria-label='Remove from goal'
  onClick={() => onDetach(task.id)}
  disabled={isDetaching}
  className={[
    'rounded p-0.5 transition-all duration-[var(--dur-fast)]',
    'opacity-0 group-hover/taskrow:opacity-100',
    'text-[var(--muted-foreground)] hover:text-amber-500 hover:bg-amber-500/10',
    'disabled:opacity-30 disabled:pointer-events-none',
  ].join(' ')}
>
  <Unlink className='h-3 w-3' />
</button>
```

**Design rationale:**

- `Unlink` icon (not `X`) — communicates detach/unlink, not delete; makes action
  feel reversible
- Hover-only (`opacity-0 group-hover/taskrow:opacity-100`) — `group/taskrow`
  already exists on the `<li>`; consistent with `LinkToEpicButton` appearing
  only on hover in `UnlinkedTasksSection`
- Amber hover color — warning tier (reversible action, not permanent delete)
- Card-level `isDetaching` disables ALL rows while one detach is in flight

---

### Phase 4 — "No goal" hint on issue detail

**New file:** `features/issues/ui/issue-no-goal-hint.tsx`

Full component per the design and sessionStorage flash fix described in
Technical Approach above.

**Visual design — amber banner:**

```tsx
<div
  role='alert'
  className={[
    'relative flex items-start gap-3 rounded-[var(--r-md)]',
    'border border-amber-500/30',
    'bg-amber-500/[0.06]',
    'px-3 py-2.5',
  ].join(' ')}
>
  <Info className='mt-0.5 h-4 w-4 shrink-0 text-amber-500' />
  <div className='flex-1 min-w-0'>
    <p className='text-xs text-[var(--foreground)]/90'>
      This task is not linked to any goal.
    </p>
    {epics.length > 0 && (
      <div className='mt-1.5'>
        <LinkToEpicButton taskId={issueId} epics={epics} />
      </div>
    )}
  </div>
  <button
    type='button'
    aria-label='Dismiss'
    onClick={handleDismiss}
    className='shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors'
  >
    <X className='h-3.5 w-3.5' />
  </button>
</div>
```

**Design rationale:**

- `border-amber-500/30` + `bg-amber-500/[0.06]` — visible amber framing without
  being garish on dark background
- `Info` icon at full `text-amber-500` — clearest semantic signal, occupies left
  attention anchor
- Reuses `LinkToEpicButton` — no duplicate epic dropdown logic
- No "Notify manager" button — omitted per scope guardian recommendation

**Files to change:**

- `features/issues/ui/issue-no-goal-hint.tsx` — **new**
- `features/issues/index.ts` — export `IssueNoGoalHint` (needed because `app/`
  imports from public API)
- `app/dashboard/issues/[id]/page.tsx` — render
  `<IssueNoGoalHint issueId={issue.id} epics={epics} />` above `<IssueForm>`;
  `epics` is already fetched on this page

---

## Acceptance Criteria

### Goals tab

- [ ] Each `EpicGoalCard` shows a trend icon (TrendingUp emerald / TrendingDown
      amber / Minus muted) trailing the progress percentage
- [ ] Empty epics (no tasks) show no trend icon and `—` instead of `%`
- [ ] Trend is `'up'` when more tasks closed in last 7 days than 7–14 days ago;
      `'down'` when none closed recently but some closed prior; `'flat'`
      otherwise
- [ ] Each `EpicGoalCard` shows `epic.assignee.name` (with UserCircle icon)
      below description when assignee is non-null; slot hidden when null
- [ ] Each task row inside `EpicGoalCard` shows a hover-only `Unlink` icon
      button (amber on hover)
- [ ] Clicking "Remove from goal" sends `PATCH /api/v1/issues/{id}` with
      `{ epic_id: null }` and triggers page revalidation
- [ ] While one detach is in flight, all detach buttons in the card are disabled
- [ ] "Remove from goal" shows `toast.error` on failure; `toast.success` on
      success
- [ ] `computeProgress` uses `parseISO` for date parsing; guards against `isNaN`
      from malformed dates
- [ ] `detachTaskFromEpic` guards `taskId > 0 && Number.isInteger(taskId)`

### Issue detail page

- [ ] When a non-epic issue has `epic_id === null`, amber hint banner appears
      above `IssueForm`
- [ ] Hint text: "This task is not linked to any goal."
- [ ] If `epics.length > 0`, renders `LinkToEpicButton` inside the hint
- [ ] Dismiss (X) button hides banner and writes to `sessionStorage`
- [ ] After dismissal, hint does not re-render in the same session
- [ ] Hint is NOT shown for `type === 'epic'` issues
- [ ] Hint is NOT shown for issues with `epic_id !== null`
- [ ] No flash of content on mount (banner uses `null`-until-mounted pattern)

### Non-regression

- [ ] Existing `linkTaskToEpic` from `UnlinkedTasksSection` continues to work
- [ ] Kanban `epic_id` filter link in `EpicGoalCard` still works
- [ ] `computeProgress` unit tests pass with updated trend logic
- [ ] ESLint + TypeScript strict mode pass with no new errors (`'use server'` in
      api file, no implicit `any`, `data!` present)

---

## Dependencies & Risks

| Risk                                                         | Severity | Mitigation                                                                                                     |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| `EpicGoalCardContent` refactor to `'use client'`             | Medium   | Restructure: keep `EpicTasksList` as Server Component; pass data to new `EpicGoalCardClient` client wrapper    |
| `close_date` may be empty string (not null)                  | Low      | `parseISO` + `isNaN` guard handles this                                                                        |
| Tasks reopened after done count toward prior done            | Low      | Accepted limitation; comment in code                                                                           |
| `epic.assignee` typed as `PersonOption \| null \| undefined` | Low      | Use `epic.assignee !== null && epic.assignee !== undefined` (not just `epic.assignee?.name`)                   |
| `PATCH epic_id: null` blocked if issue is itself an epic     | None     | `EpicTaskRow` only renders non-epic tasks; no guard needed at button level                                     |
| sessionStorage not available in SSR                          | None     | `IssueNoGoalHint` is `'use client'`; reads storage only in `useEffect`; `null` initial state prevents mismatch |
| sessionStorage throws in private mode                        | Very Low | Wrap `sessionStorage.getItem/setItem` in try/catch; default to not-dismissed                                   |
| Double-revalidation from concurrent detach clicks            | Medium   | Card-level `isDetaching` flag prevents concurrent calls                                                        |

---

## File Reference Map

| File                                                     | Action                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `features/issues/model/goals-progress.ts`                | Update `computeProgress` — add trend from `close_date` via `parseISO`                                        |
| `features/issues/model/__tests__/goals-progress.test.ts` | Update/add tests (see test strategy below)                                                                   |
| `features/issues/ui/epic-goal-card.tsx`                  | Add trend icon + assignee display; refactor content to `'use client'` for detach state; inline detach button |
| `features/issues/ui/issue-no-goal-hint.tsx`              | **New** — `'use client'` dismissible amber banner                                                            |
| `features/issues/api/issues.ts`                          | Add `detachTaskFromEpic` server action                                                                       |
| `features/issues/index.ts`                               | Export `IssueNoGoalHint` only (not DetachFromEpicButton — internal)                                          |
| `app/dashboard/issues/[id]/page.tsx`                     | Render `<IssueNoGoalHint>` above `<IssueForm>`; fix pre-existing deep import of `IssueAuditLogSection`       |

---

## Test Strategy

### `features/issues/model/__tests__/goals-progress.test.ts`

No mocks needed — pure functions.

**`computeProgress` — counting (tests 1–9):**

1. Empty array → `isEmpty: true`, all zeros
2. All `done` → `percent === 100`
3. All `open` → `percent === 0`
4. Mixed statuses → verify done/active/open counts separately; percent is
   `Math.round`
5. Rounding — 1/3 → `percent: 33`
6. All 4 active statuses (`in_progress`, `paused`, `review`, `reopen`) each
   count toward `active`
7. Epic children filtered — `type: 'epic'` tasks excluded from all counts
8. Mixed epics + tasks — correct `total`
9. Only epics → `isEmpty: true`

**`computeProgress` — trend (tests 10–16, use injectable
`now = new Date('2026-05-28T12:00:00Z')`):** 10. `trend: 'up'` — 3 closed in
last 7 days, 1 in prior 7 days 11. `trend: 'down'` — 1 recent, 3 prior 12.
`trend: 'flat'` — equal counts (2 and 2) 13. `trend: 'flat'` — no closed issues
at all 14. Malformed `close_date` (empty string) — does not crash; counted as 0
in both windows 15. `close_date` exactly on 7-day boundary — counted in recent
window 16. `total === 0` (all epic-type tasks filtered out) → `trend: 'flat'`

**`getProgressColor` — all 9 branches (tests 17–25):** 17. `isEmpty: true` →
muted class 18. `percent: 0, isEmpty: false` → muted class 19. `percent: 1` →
amber 20. `percent: 33` → amber (boundary) 21. `percent: 34` → violet primary
(boundary) 22. `percent: 66` → violet primary 23. `percent: 67` → emerald
(boundary) 24. `percent: 99` → emerald 25. `percent: 100` → gradient

### `features/issues/ui/__tests__/detach-from-epic-button.test.tsx`

(Button is inlined in `epic-goal-card.tsx`; tests live in
`__tests__/epic-goal-card-detach.test.tsx`)

Mocks: `jest.mock('@/features/issues/api/issues')`, `jest.mock('sonner', ...)`.

Key test cases:

- Renders `Unlink` button with `aria-label='Remove from goal'`
- Not visible until `group-hover` (CSS test or snapshot)
- Calls `detachTaskFromEpic(taskId)` on click
- Shows `toast.success` on `{ data: ..., error: null }`
- Shows `toast.error(message)` on `{ data: null, error: 'message' }`
- All detach buttons in card disabled while `isDetaching` is true

### `features/issues/ui/__tests__/issue-no-goal-hint.test.tsx`

Mocks: `jest.mock('@/features/issues/api/issues')`, `jest.mock('sonner', ...)`,
`beforeEach(() => sessionStorage.clear())`.

Key test cases:

- Renders nothing on first frame (null-until-mounted)
- After mount: renders hint if storage key absent
- Renders nothing if storage key already set to `'1'`
- Dismiss button sets sessionStorage and hides hint
- Renders `LinkToEpicButton` when `epics.length > 0`
- Renders no epic selector when `epics.length === 0`
- Returns null if `issueId` is invalid (`NaN`, 0, negative)

---

## Open Questions (Resolved)

| Question                       | Resolution                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Trend threshold                | Any positive delta = "up"; hardcode — no stakeholder decision needed               |
| "Remove from goal" label       | Icon-only `Unlink` with `aria-label` + hover tooltip (`group-hover`)               |
| Dismissal persistence          | `sessionStorage` (session-only); key: `issue-hint-v1-${issueId}-no-goal-dismissed` |
| "Notify manager" CTA           | **Omit entirely** — no defined notification channel; dead-end UI                   |
| Archived tasks in progress bar | Keep current `exclude_archived: true` default; note as known limitation            |

---

## References

### Internal (key files to read before implementing)

- `features/issues/ui/epic-goal-card.tsx` — full existing implementation
- `features/issues/model/goals-progress.ts` — current `computeProgress` and
  `GoalProgress` type
- `features/issues/ui/link-to-epic-button.tsx` — pattern for mutation buttons +
  the epic dropdown to reuse
- `features/issues/api/issues.ts` — `linkTaskToEpic` pattern (copy for
  `detachTaskFromEpic`)
- `features/issues/model/types.ts` lines 73–98 — full `Issue` interface
- `entities/issue/model/types.ts` — `EpicOption`, `PersonOption`
- `shared/types/server-action.ts` — `ActionResult<T>` definition
- `shared/lib/errors.ts` — `ServerError` class
- `shared/lib/apiError.ts` — `parseApiError` function

### Backend contracts confirmed

- `GET /api/v1/issues?type=epic` → `IssueResource[]` with `assignee` eagerly
  loaded
- `GET /api/v1/issues?epic_id=X` → child tasks with `close_date: string | null`
  present
- `PATCH /api/v1/issues/{id}` body `{ epic_id: null }` → unlinks task from epic
  (HTTP 200)
- History endpoint `/api/v1/issues/stats/history` does NOT support `epic_id`
  filter
- `exclude_type` query param is NOT handled by backend — filter client-side only

### External references

- [useOptimistic – React 19 official docs](https://react.dev/reference/react/useOptimistic)
- [date-fns parseISO](https://date-fns.org/docs/parseISO) — use instead of
  `new Date()` for ISO strings
- [date-fns startOfDay](https://date-fns.org/docs/startOfDay) — for whole-day
  trend windows
- [WAI-ARIA accessible icon buttons](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  — `aria-label` as accessible name
