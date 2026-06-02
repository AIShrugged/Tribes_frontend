---
title: Move Goals Tab from Issues to Today Dashboard
type: refactor
status: completed
date: 2026-05-29
---

# refactor: Move Goals Tab from Issues to Today Dashboard

## Enhancement Summary

**Deepened on:** 2026-05-29 **Research agents used:** architecture-strategist,
kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer,
pattern-recognition-specialist, julik-frontend-races-reviewer,
spec-flow-analyzer

### Key Improvements Discovered

1. **Use `git mv` instead of copy-then-redirect** — avoids wrong import paths
   being introduced and is the simplest correct approach
2. **`revalidatePath` gap is a real bug** — mutations don't invalidate
   `/dashboard/today/goals`; must be fixed
3. **`LinkToEpicButton` doesn't call `router.refresh()`** — pre-existing bug
   that becomes more prominent when Goals is the primary entry point; fix during
   this migration
4. **Wrong import paths in the original plan** — `getOrganizationId` and
   `EmptyState` paths were incorrect; `git mv` prevents this entirely
5. **`UnlinkedTasksSkeleton` is a private local function** — must be preserved
   when moving the file
6. **Use `permanentRedirect()` not `redirect()`** — this is a stable route
   consolidation, not a temporary redirect
7. **`features/issues/index.ts` should export goals components** — currently
   uses deep-path imports; fix as part of this work

### New Considerations Discovered

- `preserveSearchParams` on `TodayTabsNav` will append `?date=` to Goals URL —
  harmless but semantically wrong
- The onboarding completion toast references "issue tracker" for goals — should
  be updated
- The Issues layout's filter bar (org switcher, assignee filter) will be absent
  in Today — confirmed intentional (Goals in Today = high-level overview)
- `getEpics(orgId)` in Today layout has no parent layout calling it — no
  `React.cache()` hit from layout, but this is fine since Today has
  `force-dynamic`
- `metadata` export should be typed as `Metadata` from `next`

---

## Overview

Move `app/dashboard/issues/(tabs)/goals/` to `app/dashboard/today/goals/`,
preserving all existing logic and rendering. The goals tab becomes the 4th tab
in the Today section (`Meetings | Tasks | Critical Path | Goals`). The old route
permanently redirects to the new one.

## Problem Statement

The Goals view (epics + linked tasks + unlinked tasks) currently lives inside
the Issues section, wrapped by the `IssuesLayoutClient` filter context it
doesn't actually use. It semantically belongs to the "Today" daily-planning
section alongside meetings, progress, and critical path.

## Current State

### Goals page tree (issues layout)

```
app/dashboard/issues/(tabs)/
  layout.tsx                   ← IssuesLayoutClient filter context (Goals ignores it entirely)
    goals/
      page.tsx                 ← async SC: getOrganizationId() + getEpics(orgId)
      loading.tsx              ← 3× EpicGoalCardSkeleton inside space-y-4 p-6
```

### Components involved

| File                                            | Type           | Role                                      |
| ----------------------------------------------- | -------------- | ----------------------------------------- |
| `features/issues/ui/epic-goal-card.tsx`         | async SC       | Epic header + progress + nested tasks     |
| `features/issues/ui/epic-goal-card-client.tsx`  | `'use client'` | Progress bar, task list, detach button    |
| `features/issues/ui/unlinked-tasks-section.tsx` | async SC       | Tasks with no epic, link-to-epic dropdown |
| `features/issues/model/goals-progress.ts`       | utility        | `computeProgress()`, `getProgressColor()` |

### API calls (from `features/issues/api/issues.ts`)

| Function                         | Method | Endpoint                                                                       |
| -------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `getEpics(orgId?)`               | GET    | `/api/v1/issues?type=epic&organization_id=...&limit=100&exclude_archived=true` |
| `getIssues({ epic_id })`         | GET    | `/api/v1/issues?epic_id=...&limit=100`                                         |
| `getIssues({ organization_id })` | GET    | `/api/v1/issues?organization_id=...&limit=100`                                 |
| `detachTaskFromEpic(taskId)`     | PATCH  | `/api/v1/issues/{id}` → `{ epic_id: null }`                                    |
| `linkTaskToEpic(epicId, taskId)` | PATCH  | `/api/v1/issues/{id}` → `{ epic_id: epicId }`                                  |

`getEpics` is `React.cache()`-wrapped — per-request deduplication is safe under
`force-dynamic`.

### Today section current tabs (3 tabs, `match: 'exact'`)

```
Meetings      → /dashboard/today/meetings
Tasks         → /dashboard/today/progress
Critical Path → /dashboard/today/activity
```

---

## Proposed Solution

### Simplified 5-step plan (simplified from original 7 steps)

1. **`git mv`** `app/dashboard/issues/(tabs)/goals/page.tsx` →
   `app/dashboard/today/goals/page.tsx`
2. **`git mv`** `app/dashboard/issues/(tabs)/goals/loading.tsx` →
   `app/dashboard/today/goals/loading.tsx`
3. **Rename constant** in `shared/lib/routes.ts`: `ISSUES_GOALS` →
   `TODAY_GOALS`, value `'/dashboard/today/goals'`
4. **Update `IssuesTabsNav`** — remove Goals tab entry (file:
   `features/issues/ui/issues-tabs-nav.tsx`)
5. **Update `TodayTabsNav`** — add Goals as 4th tab (file:
   `features/today-briefing/ui/today-tabs-nav.tsx`)

No redirect page needed — no consumers point to the old URL except the issues
nav tab being removed in step 4.

### Additional fixes (bugs surfaced during research)

6. **Fix `revalidatePath`** in `detachTaskFromEpic` and `linkTaskToEpic` — add
   `/dashboard/today/goals`
7. **Fix `LinkToEpicButton`** — add `router.refresh()` after successful link
   (pre-existing bug, now the primary entry point)
8. **Export goals components from `features/issues/index.ts`**
9. **Update onboarding toast** — remove "issue tracker" reference to goals
10. **Delete `app/dashboard/issues/(tabs)/goals/`** — both files are gone after
    `git mv`; if a redirect is still desired for old bookmarks, add to
    `next.config.ts` `redirects` array instead (see Research Insights below)

---

## No Changes Required To

- All components in `features/issues/ui/` — they stay with unchanged internal
  logic
- Server actions in `features/issues/api/issues.ts` (except adding one
  `revalidatePath` line to two functions)
- Types in `features/issues/model/types.ts` and
  `features/issues/model/goals-progress.ts`
- The Issues `(tabs)/layout.tsx` — Goals tab removal doesn't require layout
  changes
- The `EpicGoalCardClient` `router.refresh()` call after detach — already
  correct

---

## Implementation Checklist

### Step 1 — Move route files

```bash
git mv "app/dashboard/issues/(tabs)/goals/page.tsx" "app/dashboard/today/goals/page.tsx"
git mv "app/dashboard/issues/(tabs)/goals/loading.tsx" "app/dashboard/today/goals/loading.tsx"
```

**Why `git mv` not copy:** Avoids introducing wrong import paths, preserves git
history, prevents a window where two identical files exist.

**Verify after move:** The moved `page.tsx` contains a private
`UnlinkedTasksSkeleton` function and imports:

- `import { getOrganizationId } from '@/shared/lib/getOrganizationId'` ← correct
  path
- `import { EmptyState } from '@/shared/ui/feedback/empty-state'` ← correct path
- `import type { Metadata } from 'next'` +
  `export const metadata: Metadata = { title: 'Goals' }`

These are already correct in the source file. `git mv` preserves them.

### Step 2 — Rename route constant

**`shared/lib/routes.ts`** — rename `ISSUES_GOALS` to `TODAY_GOALS` and update
its value:

```ts
// Before:
ISSUES_GOALS: '/dashboard/issues/goals',

// After:
TODAY_GOALS: '/dashboard/today/goals',
```

### Step 3 — Remove Goals tab from IssuesTabsNav

**`features/issues/ui/issues-tabs-nav.tsx`** — remove the Goals entry:

```ts
// Remove this entry from TABS:
{ href: ROUTES.DASHBOARD.ISSUES_GOALS, label: 'Goals' },
```

After removal, `ISSUES_GOALS` has zero consumers — the constant rename in Step 2
handles cleanup.

### Step 4 — Add Goals tab to TodayTabsNav

**`features/today-briefing/ui/today-tabs-nav.tsx`** — append Goals as 4th tab:

```ts
const TABS = [
  {
    href: ROUTES.DASHBOARD.TODAY_MEETINGS,
    label: 'Meetings',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_PROGRESS,
    label: 'Tasks',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_ACTIVITY,
    label: 'Critical Path',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_GOALS,
    label: 'Goals',
    match: 'exact' as const,
  },
] as const;
```

> **Note on `preserveSearchParams`:** `TodayTabsNav` currently passes
> `preserveSearchParams` to `PageTabsNav`. This will append `?date=` from the
> meetings/progress tabs to the Goals URL when switching. Goals does not use a
> date parameter — verify whether `PageTabsNav` supports per-tab
> `preserveSearchParams: false` override, or accept the cosmetically wrong (but
> functionally harmless) URL.

### Step 5 — Fix `revalidatePath` in mutation actions

**`features/issues/api/issues.ts`** — add `/dashboard/today/goals` revalidation
alongside existing `/dashboard/issues`:

```ts
// In detachTaskFromEpic (around line 449):
revalidatePath('/dashboard/issues', 'layout');
revalidatePath('/dashboard/today/goals'); // ← add this

// In linkTaskToEpic (around line 409):
revalidatePath('/dashboard/issues', 'layout');
revalidatePath('/dashboard/today/goals'); // ← add this

// Also in linkIssuesToEpic (batch link):
revalidatePath('/dashboard/issues', 'layout');
revalidatePath('/dashboard/today/goals'); // ← add this
```

**Why this matters:** Without `revalidatePath('/dashboard/today/goals')`,
mutations from the Goals tab will succeed but the server-side RSC cache won't be
invalidated. `router.refresh()` in `EpicGoalCardClient` saves the detach case
accidentally (because `force-dynamic` forces a live fetch), but this is fragile.
Add explicit revalidation.

### Step 6 — Fix `LinkToEpicButton` missing router.refresh()

**`features/issues/ui/link-to-epic-button.tsx`** — add `router.refresh()` after
successful link:

```tsx
'use client';
import { useRouter } from 'next/navigation';

export function LinkToEpicButton({ taskId, epics }: Props) {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleLink(epicId: number) {
    setIsLinking(true);
    const result = await linkTaskToEpic(epicId, taskId);
    setIsLinking(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    router.refresh(); // ← add this: refreshes UnlinkedTasksSection and epic card counts
  }
  // ...
}
```

**Why:** Without `router.refresh()`, linking a task succeeds on the server but
the task stays visible in "Tasks without a goal" until the user manually
refreshes. `revalidatePath` alone doesn't update the already-rendered
client-side RSC tree — `router.refresh()` is required.

### Step 7 — Export goals components from features/issues/index.ts

**`features/issues/index.ts`** — add exports:

```ts
export { EpicGoalCard, EpicGoalCardSkeleton } from './ui/epic-goal-card';
export { UnlinkedTasksSection } from './ui/unlinked-tasks-section';
```

This fixes the pre-existing deep-path import violation. The moved `page.tsx`
uses these imports — after adding the exports, they can optionally be updated to
`@/features/issues` (though deep-path imports work fine and this is optional
cleanup).

### Step 8 — Update onboarding toast

**`features/onboarding/ui/onboarding-wizard.tsx`** (around line 196) — update
the success toast:

```tsx
// Before:
toast.success('Onboarding complete', {
  description: 'Your goals are ready in the issue tracker.',
});

// After:
toast.success('Onboarding complete', {
  description: 'Your goals are ready in the Today section.',
});
```

### Step 9 — Optional: add permanent redirect to next.config.ts

If there's concern about old bookmarks, add a static redirect instead of a page
component:

**`next.config.ts`**:

```ts
async redirects() {
  return [
    {
      source: '/dashboard/issues/goals',
      destination: '/dashboard/today/goals',
      permanent: true,  // 308 — tells browsers and crawlers to update cached URL
    },
  ];
},
```

**Why `next.config.ts` redirects > a redirect page component:**

- Fires before any React render — no skeleton flash, no round-trip cost
- Browser caches the 308 permanently — repeat visitors pay zero cost
- Keeps `app/dashboard/issues/(tabs)/goals/` directory empty/deleted cleanly

If a redirect page is used instead, use `permanentRedirect()` from
`next/navigation`, not `redirect()` (which emits 307 Temporary).

---

## Acceptance Criteria

- [x] `/dashboard/today/goals` renders epics with progress bars, task lists,
      detach/link buttons
- [x] `/dashboard/issues/goals` redirects to `/dashboard/today/goals` (either
      via `next.config.ts` or the directory is simply 404 — acceptable if no
      external links exist)
- [x] `TodayTabsNav` shows 4 tabs: Meetings | Tasks | Critical Path | Goals
- [x] Goals tab is active/highlighted when at `/dashboard/today/goals`
- [x] `IssuesTabsNav` shows 3 tabs: Kanban | Tasktracker | Progress (no Goals)
- [x] `loading.tsx` renders 3× `EpicGoalCardSkeleton` skeleton while goals data
      loads
- [x] Detach task: task disappears from epic card; card progress updates; no
      stale state
- [x] Link task to epic: task disappears from "Tasks without a goal" section
      immediately
- [x] Epic name link navigates to `/dashboard/issues/{id}`
- [x] Kanban link navigates to `/dashboard/issues/kanban?epic_id={id}`
- [x] Empty state renders when org has no epics
- [x] No TypeScript errors (`npm run lint`)
- [x] `ISSUES_GOALS` constant no longer exists in `routes.ts` (renamed to
      `TODAY_GOALS`)
- [x] No dead references to `ISSUES_GOALS` anywhere in the codebase

---

## Risk Analysis

| Risk                                                 | Severity | Mitigation                                                           |
| ---------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| Stale Goals page after detach/link mutations         | High     | Add `revalidatePath('/dashboard/today/goals')` to mutations (Step 5) |
| `LinkToEpicButton` silent no-refresh                 | High     | Add `router.refresh()` (Step 6)                                      |
| Wrong import paths in new page                       | Medium   | Use `git mv` — preserves original correct imports                    |
| `UnlinkedTasksSkeleton` private function lost        | Medium   | `git mv` preserves it; copy creates risk of losing it                |
| Old bookmarks 404                                    | Low      | Add `next.config.ts` permanent redirect (Step 9, optional)           |
| `preserveSearchParams` appends `?date=` to Goals URL | Low      | Cosmetically wrong, functionally harmless; accept or fix per-tab     |
| `getEpics()` no layout-level dedup in Today          | Low      | `force-dynamic` means fresh fetch per request anyway; no regression  |

---

## Research Insights

### On `redirect()` vs `permanentRedirect()` vs `next.config.ts`

For a permanent route consolidation (not a conditional/session-based redirect),
prefer `next.config.ts` `redirects` with `permanent: true`. This emits HTTP 308
before React renders anything, caches in browsers, and costs zero SSR compute on
repeat visits. If using a page component, always use `permanentRedirect()` from
`next/navigation`, never `redirect()` (307 Temporary), for stable route moves.

### On `React.cache()` and `force-dynamic` interaction

`force-dynamic` on a layout segment is a Next.js build/router directive — it
ensures no static generation and forces SSR on every request. `React.cache()` is
per-request in-memory memoization — it deduplicates calls **within** a single
render tree. The two operate at different scopes and do not interfere.
`force-dynamic` ensures every request is fresh; `React.cache()` deduplicates
within that fresh request. Moving Goals under the `force-dynamic` today layout
causes no regression.

### On `revalidatePath` scope

`revalidatePath('/dashboard/issues', 'layout')` — the `'layout'` scope
invalidates the Issues section and all its children. It has **no effect** on
`/dashboard/today/**`. Always add explicit `revalidatePath` for every route that
displays the mutated data. `router.refresh()` on the client saves you when the
parent layout is `force-dynamic`, but this is accidental protection — explicit
`revalidatePath` is the correct solution.

### On FSD boundary correctness

`app/dashboard/today/goals/page.tsx` importing from `features/issues/ui/` is NOT
a violation. The `app/` layer can import from any feature — that is the
permitted direction (`app → features`). The existing `today/activity/page.tsx`
and `today/progress/page.tsx` already import from `features/issues/`. This
migration follows the same established pattern.

Cross-feature imports (e.g., `features/today-briefing/` importing from
`features/issues/`) would be a violation — but `TodayTabsNav` only references a
route string from `ROUTES.DASHBOARD` (which lives in `shared/lib/`), not from
`features/issues/`. No boundary violation.

### On N+1 fetch pattern

The goals page has an N+2 fetch pattern: 1 for epics list → N for each epic's
tasks (parallel via Suspense) → 1 for unlinked tasks. Under normal usage (under
~20 epics), this is acceptable. The N task fetches run in parallel courtesy of
Suspense streaming. `UnlinkedTasksSection` has a known limitation of fetching up
to 100 tasks and filtering client-side (backend has no `epic_id=null` filter).
This pre-dates the migration and is not introduced by it.

---

## References

- `app/dashboard/issues/(tabs)/goals/page.tsx` — source of truth for page logic
  (to be moved)
- `features/issues/ui/epic-goal-card.tsx` — main epic card component
- `features/issues/ui/unlinked-tasks-section.tsx` — unlinked tasks component
- `features/issues/ui/link-to-epic-button.tsx` — needs `router.refresh()` fix
- `features/issues/api/issues.ts` — `detachTaskFromEpic` (line ~449),
  `linkTaskToEpic` (line ~409), `linkIssuesToEpic`
- `features/today-briefing/ui/today-tabs-nav.tsx` — tab nav to update
- `features/issues/ui/issues-tabs-nav.tsx` — tab nav to update (remove Goals)
- `shared/lib/routes.ts` — rename `ISSUES_GOALS` → `TODAY_GOALS`
- `features/onboarding/ui/onboarding-wizard.tsx` — update toast description
  (~line 196)
- `app/dashboard/today/layout.tsx` — destination section layout
  (`force-dynamic`)
- `next.config.ts` — optional permanent redirect entry
