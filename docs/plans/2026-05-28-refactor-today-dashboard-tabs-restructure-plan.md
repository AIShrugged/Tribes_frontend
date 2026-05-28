---
title: "refactor: Restructure Today Dashboard Tabs — Move AI Blocks, Delete Tasks Tab, Rename Tabs"
type: refactor
status: active
date: 2026-05-28
---

# refactor: Restructure Today Dashboard Tabs

## Enhancement Summary

**Deepened on:** 2026-05-28
**Research agents used:** best-practices-researcher, architecture-strategist, code-simplicity-reviewer, performance-oracle, julik-frontend-races-reviewer, kieran-typescript-reviewer, feasibility-reviewer

### Key Improvements Discovered

1. **`getTodayBriefing` must be behind a Suspense boundary**, not in `Promise.all` — otherwise the KPI chart (fast, ~300ms) is blocked by the briefing fetch (slow, AI-backed). Suspense streaming lets both render concurrently.
2. **`TaskStatsBlock`, `ClosedTasksBlock`, `WaitingOnYou`, `StaleItems` fate is unresolved** — the plan must explicitly state whether they move or are deleted (they are not in the proposed code but the plan does not say they are dropped).
3. **`AiNudge` needs `key={date}` at the call site** — stale nudge text will flash on date change without it.
4. **The old `/dashboard/today/tasks` route should redirect, not 404** — bookmarked users deserve a graceful redirect.
5. **`isIssueHistoryPeriod` type guard should be added** — replace the unsafe `as IssueHistoryPeriod` cast to match the project's established pattern.
6. **`progress/loading.tsx` needs updating** — it only covers KPI cards; after this refactor it must also represent the AI blocks.
7. **Two FSD deep-import violations discovered** that this refactor touches and should fix.

---

## Overview

Reorganise the four-tab layout of the `/dashboard/today` section:

1. Move `AiNudge` ("AI Insight") and `AiPrepPanel` ("AI Prep") from the **Tasks** tab to the **Progress** tab (insight at top, AI Prep at bottom).
2. Delete the **Tasks** tab (route + page file); redirect old URL to Progress.
3. Rename the **Progress** tab → **Tasks**.
4. Rename the **Activity** tab → **Critical Path**.

End result: three tabs — **Meetings**, **Tasks** (ex-Progress), **Critical Path** (ex-Activity).

---

## Current State

### Tab order (`features/today-briefing/ui/today-tabs-nav.tsx`)

| # | Label | Route constant | URL |
|---|-------|---------------|-----|
| 1 | Meetings | `TODAY_MEETINGS` | `/dashboard/today/meetings` |
| 2 | **Tasks** | `TODAY_TASKS` | `/dashboard/today/tasks` |
| 3 | **Activity** | `TODAY_ACTIVITY` | `/dashboard/today/activity` |
| 4 | **Progress** | `TODAY_PROGRESS` | `/dashboard/today/progress` |

### AI blocks in Tasks tab (`app/dashboard/today/tasks/page.tsx`)

- `AiNudge` — renders amber-bordered "AI insight" text (line 43), shown only when `data.events.length > 0`
- `AiPrepPanel` — one per event in `data.events` (lines 33–37); collapsible "AI prep" section per meeting

Other content in Tasks tab (explicit disposition required — see Decision below):
- `TaskStatsBlock` — cross-org task stats (line 25)
- `ClosedTasksBlock` — recently closed tasks (line 26)
- `WaitingOnYou` — tasks waiting on current user (line 46)
- `StaleItems` — overdue/stale tasks (line 47)

### Progress tab (`app/dashboard/today/progress/page.tsx`)

Renders `IssueProgressPage` (KPI cards + chart + weekly summary). This page keeps its content; AI blocks are added via Suspense streaming (not `Promise.all`).

### Activity tab (`app/dashboard/today/activity/page.tsx`)

Renders `CriticalPathPageClient`. Label changes to "Critical Path", no logic changes.

---

## Decision: Fate of TaskStatsBlock, ClosedTasksBlock, WaitingOnYou, StaleItems

> **Product decision needed before implementation starts.** The plan's code examples do not include these components in the new "Tasks" (ex-Progress) page. If they are intentionally dropped, delete them and their dead exports from `index.ts`. If they should be preserved, they must be explicitly placed — e.g., in the new Tasks page below the AI blocks.

**Recommendation from simplicity review:** Delete `TaskStatsBlock` and `ClosedTasksBlock` — their stats are already covered by `IssueProgressKpiCards` inside `IssueProgressPage`. `WaitingOnYou` and `StaleItems` have unique data; include them in the new Tasks page only if the product requires it.

---

## Acceptance Criteria

- [ ] `/dashboard/today` redirects to `/dashboard/today/meetings` (unchanged)
- [ ] Tab strip shows exactly 3 tabs: **Meetings** · **Tasks** · **Critical Path**
- [ ] `/dashboard/today/tasks` redirects to `/dashboard/today/progress` (graceful, not 404)
- [ ] `/dashboard/today/activity` tab label is "Critical Path" (URL stays the same)
- [ ] `/dashboard/today/progress` tab label is "Tasks"
- [ ] New Tasks page renders `AiNudge` at the very top (inside Suspense boundary), then KPI/chart/summary, then `AiPrepPanel` blocks at the bottom
- [ ] KPI chart is visible immediately (~300ms); AI blocks stream in independently via Suspense
- [ ] AI blocks are only shown when `briefing.events.length > 0`
- [ ] `AiNudge` receives `key={briefing.date}` to prevent stale text flashing on date change
- [ ] `searchParams` on the progress page includes both `{ period?: string; date?: string }`
- [ ] No TypeScript errors, no ESLint errors
- [ ] No broken imports
- [ ] FSD deep-import violations fixed as part of this pass

---

## Implementation Plan

### Step 0 — Decision checkpoint (before coding)

Confirm with product: are `TaskStatsBlock`, `ClosedTasksBlock`, `WaitingOnYou`, `StaleItems` moved to the new Tasks page or deleted?

### Step 1 — Add `BriefingSection` async Server Component

Create a new file inside `features/today-briefing/ui/` for the async streaming component. Do NOT inline it in the page — it must be a separate async Server Component to enable Suspense streaming.

```tsx
// features/today-briefing/ui/briefing-section.tsx
import { getTodayBriefing } from '../api/today';
import { AiNudge } from './ai-nudge';
import { AiPrepPanel } from './ai-prep-panel';

interface BriefingSectionProps {
  date?: string;
}

export async function BriefingSection({ date }: BriefingSectionProps) {
  const briefing = await getTodayBriefing(date);

  if (briefing.events.length === 0) return null;

  return (
    <div className='flex flex-col gap-8'>
      {/* AiNudge: key=date prevents stale text flashing on date change */}
      <AiNudge key={briefing.date} text={briefing.nudge} date={briefing.date} />
      {briefing.events.map((event) => (
        <AiPrepPanel
          key={event.id}
          event={event}
          tasks={event.tasks}
          carriedTasks={briefing.carried_tasks}
        />
      ))}
    </div>
  );
}
```

Also add a skeleton companion for the Suspense fallback:

```tsx
// features/today-briefing/ui/briefing-section-skeleton.tsx
import { Skeleton } from '@/shared/ui/layout/skeleton';

export function BriefingSectionSkeleton() {
  return (
    <div className='rounded-[var(--radius-card)] border border-border bg-card p-5'>
      <Skeleton className='mb-3 h-4 w-48' />
      <Skeleton className='h-20 w-full' />
    </div>
  );
}
```

Export both from `features/today-briefing/index.ts`.

### Step 2 — Add `isIssueHistoryPeriod` type guard to the model

Add alongside the type definition in `features/issues/model/types.ts` (or wherever `IssueHistoryPeriod` is defined) to match the project's existing `isIssueSortField` / `isIssueStatus` pattern:

```ts
// features/issues/model/types.ts
export const VALID_HISTORY_PERIODS = new Set<IssueHistoryPeriod>([
  'day',
  'week',
  'month',
]);

export function isIssueHistoryPeriod(value: string): value is IssueHistoryPeriod {
  return VALID_HISTORY_PERIODS.has(value as IssueHistoryPeriod);
}
```

Export `isIssueHistoryPeriod` from `features/issues/index.ts`.

### Step 3 — Update `app/dashboard/today/progress/page.tsx`

Replace the existing `Promise.all` pattern with Suspense streaming. `getTodayBriefing` moves into the `BriefingSection` async child component (Step 1), not the page-level `Promise.all`.

```tsx
// app/dashboard/today/progress/page.tsx
import { Suspense } from 'react';
import {
  getIssueStats,
  getIssueStatsHistory,
  IssueProgressPage,
  isIssueHistoryPeriod,
} from '@/features/issues';
import type { IssueHistoryPeriod } from '@/features/issues';
import {
  BriefingSection,
  BriefingSectionSkeleton,
} from '@/features/today-briefing';

export const metadata = { title: 'Tasks' };

export default async function TodayProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const { period: rawPeriod, date } = await searchParams;
  const period: IssueHistoryPeriod =
    rawPeriod !== undefined && isIssueHistoryPeriod(rawPeriod)
      ? rawPeriod
      : 'week';

  const [stats, history] = await Promise.all([
    getIssueStats(),
    getIssueStatsHistory(period),
  ]);

  return (
    <div className='flex flex-col gap-4'>
      {/* Briefing (AI Insight + AI Prep) streams in independently.
          Suspense allows KPI content to show immediately while briefing loads. */}
      <Suspense fallback={<BriefingSectionSkeleton />}>
        <BriefingSection date={date} />
      </Suspense>

      <IssueProgressPage stats={stats} history={history} period={period} />
    </div>
  );
}
```

> **Performance note:** The KPI chart renders at ~300ms (fast stats queries). `getTodayBriefing` may be slower (AI endpoint, aggregated meetings data). With Suspense, the chart is visible immediately; the AI blocks stream in concurrently without blocking it. Total wall-clock time = same as before, but TTFB for meaningful content drops from `max(stats, history, briefing)` to `max(stats, history)`.

### Step 4 — Replace Tasks tab with a redirect

Instead of a 404, redirect bookmarked users gracefully. Replace the contents of `app/dashboard/today/tasks/page.tsx`:

```tsx
// app/dashboard/today/tasks/page.tsx
import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export default function TodayTasksPage() {
  redirect(ROUTES.DASHBOARD.TODAY_PROGRESS);
}
```

Then delete `app/dashboard/today/tasks/loading.tsx` if it exists (the redirect fires before loading is shown).

> **Alternative:** delete the tasks route entirely and remove `TODAY_TASKS` from routes.ts. Prefer the redirect approach — it protects bookmarks and any external links.

### Step 5 — Update `features/today-briefing/ui/today-tabs-nav.tsx`

Remove the **Tasks** tab entry, rename **Progress** → **Tasks**, rename **Activity** → **Critical Path**:

```tsx
'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  {
    href: ROUTES.DASHBOARD.TODAY_MEETINGS,
    label: 'Meetings',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_ACTIVITY,
    label: 'Critical Path',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_PROGRESS,
    label: 'Tasks',
    match: 'exact' as const,
  },
] as const;

export function TodayTabsNav() {
  return <PageTabsNav tabs={TABS} preserveSearchParams />;
}
```

> Route constants (`TODAY_TASKS`, `TODAY_ACTIVITY`, `TODAY_PROGRESS`) and their URLs stay unchanged. Only labels change. Active state is pathname-derived — no runtime risk.

### Step 6 — Update `app/dashboard/today/activity/page.tsx`

Change `metadata.title`:

```tsx
export const metadata = { title: 'Critical Path' };
```

Also fix the existing FSD deep-import violation on line 1 (discovered by architecture review):

```tsx
// Before (deep import — FSD violation):
import { CriticalPathPageClient } from '@/features/issues/ui/critical-path-page';

// After (public index):
import { CriticalPathPageClient } from '@/features/issues';
```

### Step 7 — Fix FSD deep-import violations in today-briefing components

Two files have deep cross-feature imports that this refactor touches. Fix them as part of this pass:

- `features/today-briefing/ui/task-stats-block.tsx` line 4: change `@/features/issues/api/issue-stats` → `@/features/issues`
- `features/today-briefing/ui/closed-tasks-block.tsx` line 3: change `@/features/issues/api/issue-stats` → `@/features/issues`

Both `getIssueStats` is already re-exported from `features/issues/index.ts`.

### Step 8 — Update `app/dashboard/today/progress/loading.tsx`

The existing loading skeleton only covers KPI cards and a chart. After this refactor the page also renders `BriefingSection` (AI blocks). Update to prepend a nudge skeleton above the KPI block:

```tsx
// Add above the existing KPI skeleton rows:
<div className='rounded-[var(--radius-card)] border border-border bg-card p-5'>
  <Skeleton className='mb-3 h-4 w-48' />
  <Skeleton className='h-20 w-full' />
</div>
```

> Note: the `<Suspense>` boundary inside the page handles the in-page streaming skeleton (uses `BriefingSectionSkeleton`). The `loading.tsx` only fires on route navigation (before the page component starts). Both can show a briefing skeleton — `loading.tsx` shows the full-page placeholder, Suspense shows the per-section placeholder once the KPI content is already visible.

### Step 9 — Verify exports from `features/today-briefing/index.ts`

Confirm all newly added components are exported:
- `BriefingSection`
- `BriefingSectionSkeleton`

Existing exports (`AiNudge`, `AiPrepPanel`, `getTodayBriefing`) are already present — no change needed for them.

### Step 10 — Optional: wrap `getTodayBriefing` with React `cache()`

`getIssueStats` is already wrapped with `cache()` at `features/issues/api/issue-stats.ts` line 11. Apply the same pattern to `getTodayBriefing` in `features/today-briefing/api/today.ts` as defensive practice:

```ts
import { cache } from 'react';

export const getTodayBriefing = cache(async function getTodayBriefing(
  date?: string,
): Promise<TodayBriefing> {
  // ... existing implementation unchanged
});
```

This prevents double-fetches if `getTodayBriefing` is ever called from two places in the same render tree. It costs nothing and matches the existing convention.

---

## Files to Touch

| File | Change |
|------|--------|
| `features/today-briefing/ui/briefing-section.tsx` | **Create** — async Server Component (AiNudge + AiPrepPanel) |
| `features/today-briefing/ui/briefing-section-skeleton.tsx` | **Create** — Suspense fallback skeleton |
| `features/today-briefing/index.ts` | Export `BriefingSection`, `BriefingSectionSkeleton` |
| `features/issues/model/types.ts` | Add `isIssueHistoryPeriod` type guard + `VALID_HISTORY_PERIODS` |
| `features/issues/index.ts` | Export `isIssueHistoryPeriod` |
| `app/dashboard/today/progress/page.tsx` | Add Suspense + `BriefingSection`; use `isIssueHistoryPeriod`; add metadata; update searchParams type |
| `app/dashboard/today/tasks/page.tsx` | Replace with redirect to `TODAY_PROGRESS` |
| `app/dashboard/today/tasks/loading.tsx` | **Delete** (if present) |
| `features/today-briefing/ui/today-tabs-nav.tsx` | Remove Tasks tab, rename Progress→"Tasks", Activity→"Critical Path" |
| `app/dashboard/today/activity/page.tsx` | Update `metadata.title`; fix FSD deep-import |
| `app/dashboard/today/progress/loading.tsx` | Add briefing skeleton block |
| `features/today-briefing/ui/task-stats-block.tsx` | Fix FSD deep-import |
| `features/today-briefing/ui/closed-tasks-block.tsx` | Fix FSD deep-import |
| `features/today-briefing/api/today.ts` | (optional) Wrap `getTodayBriefing` with `cache()` |

---

## Risks & Edge Cases

### Performance — RESOLVED with Suspense

- **Risk:** `getTodayBriefing` blocks KPI chart render when put in `Promise.all`.
- **Resolution:** Extract into `BriefingSection` async Server Component behind `<Suspense>`. KPI renders at ~300ms; AI blocks stream in concurrently. See Step 3.

### AiNudge stale text on date change

- **Risk:** Without `key={date}`, `AiNudge` React state carries over when date changes — user sees the previous day's nudge for one render.
- **Resolution:** Pass `key={briefing.date}` at the `AiNudge` call site inside `BriefingSection` (already included in Step 1 code).

### AiNudge non-abortable background POST

- **Risk:** When `nudge` is null, `AiNudge` fires `generateNudge(date)` in `useEffect`. This Server Action POST cannot be aborted if the user switches dates rapidly. The backend may cache the nudge under the wrong date if nudge cache is keyed by user only (not by date).
- **Mitigation:** Verify backend caches nudges keyed by `(user_id, date)`. The client-side `cancelled` flag prevents UI mutation but does not cancel the POST.

### Bookmarked `/dashboard/today/tasks` → redirect (not 404)

- **Resolution:** Replace tasks page with `redirect(ROUTES.DASHBOARD.TODAY_PROGRESS)` instead of deleting the route. See Step 4.

### `searchParams` carrying both `period` and `date` across all tabs

- **Risk:** `preserveSearchParams` carries both `?period=week&date=2026-05-28` when switching tabs. The Meetings tab only reads `date`, ignoring `period` — harmless.
- **Note:** Ensure all tab pages destructure only the params they need; unused params are silently ignored by Next.js searchParams.

### `TODAY_TASKS` route constant — keep or remove?

- With the redirect approach (Step 4), `TODAY_TASKS` remains valid and `app/dashboard/today/tasks/page.tsx` exists (as a redirect page). The constant stays in `routes.ts`.
- If you later decide to delete the route entirely, run the grep first: `grep -rn "TODAY_TASKS" --include="*.ts" --include="*.tsx" .` — currently only `shared/lib/routes.ts:14` and `features/today-briefing/ui/today-tabs-nav.tsx:13` reference it.

### FSD violations discovered (fix in this pass)

- `app/dashboard/today/activity/page.tsx:1` — deep import from `@/features/issues/ui/critical-path-page` (fix to `@/features/issues`)
- `features/today-briefing/ui/task-stats-block.tsx:4` — deep import from `@/features/issues/api/issue-stats` (fix to `@/features/issues`)
- `features/today-briefing/ui/closed-tasks-block.tsx:3` — deep import from `@/features/issues/api/issue-stats` (fix to `@/features/issues`)

---

## References

### Internal
- `features/today-briefing/ui/today-tabs-nav.tsx` — current tab definitions
- `app/dashboard/today/tasks/page.tsx` — Tasks tab page (becomes redirect)
- `app/dashboard/today/progress/page.tsx` — Progress tab page (primary modification)
- `app/dashboard/today/activity/page.tsx` — Activity tab page (metadata rename + FSD fix)
- `features/today-briefing/ui/ai-nudge.tsx` — AiNudge component (existing race-condition design)
- `features/today-briefing/ui/ai-prep-panel.tsx` — AiPrepPanel component
- `features/today-briefing/api/today.ts` — `getTodayBriefing` implementation
- `features/issues/api/issue-stats.ts:11` — `getIssueStats` already uses `cache()` — reference pattern
- `features/issues/model/types.ts` — `isIssueSortField`, `isIssueStatus` type guards — reference pattern
- `shared/lib/routes.ts` — route constants (lines 12–16)
- `app/dashboard/today/progress/loading.tsx` — loading skeleton to update

### Best Practices
- [Next.js 16: Getting Started: Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) — Promise.all and Suspense streaming patterns
- [Next.js File Conventions: page.js](https://nextjs.org/docs/app/api-reference/file-conventions/page) — searchParams typing