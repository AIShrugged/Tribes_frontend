---
status: pending
priority: p2
issue_id: "095"
tags: [code-review, simplicity, today-briefing, architecture]
dependencies: ["090"]
---

# BriefingSection Is a Zero-Reuse Abstraction — Inline or Eliminate

## Problem Statement

The plan introduces `BriefingSection` as a new named async Server Component in `features/today-briefing/ui/`. This component has exactly one render site: the progress page. An abstraction with one implementation is speculative generalization (YAGNI). The same Suspense + data fetching logic could live inline in the page file with no loss in readability, and would require fewer files to create and maintain.

The scope-guardian review gave this HIGH confidence (0.90) as the clearest scope creep item. The simplicity reviewer also flagged it as the primary YAGNI violation.

## Findings

- `BriefingSection` is a new component that wraps `getTodayBriefing()` + `AiNudge` + `AiPrepPanel`
- It has exactly one render site: `app/dashboard/today/progress/page.tsx`
- Async Server Components in `ui/` are a valid FSD pattern (precedent: `TaskStatsBlock`, `ClosedTasksBlock`)
- BUT those components have multiple render sites or encapsulate genuinely reused logic
- The plan requires: 1 new `briefing-section.tsx` file + 1 new `briefing-section-skeleton.tsx` + exports in `index.ts`
- All of this complexity can be replaced by inline JSX in the page
- Per YAGNI: if `BriefingSection` is not consumed by a second location now, it should not be abstracted now

Note: This finding becomes moot if todo #090 is resolved via Option 1 (splitting into `AiNudgeSection` + `AiPrepSection`) — those two components would each encapsulate a distinct responsibility and likely be reused on the Meetings tab. In that case, the abstraction is justified.

## Proposed Solutions

### Option 1: Inline into progress/page.tsx — Recommended (if todo #090 Option 3 is chosen)

```tsx
// Directly in app/dashboard/today/progress/page.tsx:
const [stats, history, briefing] = await Promise.all([
  getIssueStats(),
  getIssueStatsHistory(period),
  getTodayBriefing(date),
]);

return (
  <div className='flex flex-col gap-4'>
    {briefing.events.length > 0 && (
      <AiNudge key={briefing.date} text={briefing.nudge} date={briefing.date} />
    )}
    <IssueProgressPage stats={stats} history={history} period={period} />
    {briefing.events.length > 0 && (
      <div className='flex flex-col gap-8'>
        {briefing.events.map((event) => (
          <AiPrepPanel key={event.id} event={event} tasks={event.tasks} carriedTasks={briefing.carried_tasks} />
        ))}
      </div>
    )}
  </div>
);
```

No new files. No new exports. Sacrifices Suspense streaming (briefing blocks the chart), but is dramatically simpler.

**Pros:** Zero new abstractions. Simplest possible implementation. Easy to read and modify.
**Cons:** KPI chart blocked by briefing fetch (performance regression — acceptable for most use cases).
**Effort:** Trivial
**Risk:** Low

---

### Option 2: Keep BriefingSection, justify the abstraction by adding a second consumer

If the Meetings tab also needs AI blocks, making `BriefingSection` the shared component is justified. This converts "one consumer" into "two consumers" and eliminates the YAGNI violation.

**Pros:** Abstraction is now justified. Reuse realized.
**Cons:** Changes the Meetings tab too — increased scope.
**Effort:** Small
**Risk:** Low

---

### Option 3: Keep BriefingSection but don't export from index.ts (page-private component)

Keep the async component in the page file as a private helper:

```tsx
// Still in app/dashboard/today/progress/page.tsx:
async function BriefingSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  if (briefing.events.length === 0) return null;
  return (/* ... */);
}
```

**Pros:** Enables Suspense streaming without a new feature file. Component is scoped to the page that uses it.
**Cons:** Slightly longer page file. Component is not reusable without moving.
**Effort:** Trivial
**Risk:** Low

## Recommended Action

Option 3 (page-private component) if Suspense streaming is required. Option 1 (inline) if performance is acceptable. Either way, do not create a new feature file for a single-consumer component.

## Technical Details

**Files affected:**
- `features/today-briefing/ui/briefing-section.tsx` — do not create
- `features/today-briefing/ui/briefing-section-skeleton.tsx` — do not create (or inline skeleton)
- `features/today-briefing/index.ts` — no new exports needed
- `app/dashboard/today/progress/page.tsx` — inline the logic here

## Acceptance Criteria

- [ ] No new feature-level file created for single-consumer async component
- [ ] Briefing data fetch and AI blocks rendered correctly regardless of approach chosen
- [ ] If Suspense streaming is used, component is page-private (Option 3)

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (scope-guardian + adversarial review agents)

**Actions:**
- Identified single-consumer abstraction as YAGNI
- Found three simpler alternatives
- Noted this is moot if todo #090 Option 1 is chosen (two-component split)