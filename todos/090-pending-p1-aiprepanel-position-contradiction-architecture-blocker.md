---
status: pending
priority: p1
issue_id: '090'
tags: [code-review, architecture, today-briefing, suspense]
dependencies: []
---

# AiPrepPanel Position Contradiction — Architecture Cannot Be Implemented As Written

## Problem Statement

The plan says "AI Insight at top, AI Prep at bottom" — but both `AiNudge` and
`AiPrepPanel` are placed inside a single `BriefingSection` component that sits
**above** `IssueProgressPage` in the JSX tree. It is impossible for
`AiPrepPanel` to render "at the bottom" (below `IssueProgressPage`) if it is
inside a component that renders before `IssueProgressPage`. The plan
acknowledges the contradiction but does not resolve it.

This is a blocker: the plan cannot be implemented until the component hierarchy
is decided.

## Findings

- Plan Step 1 places both `AiNudge` and `AiPrepPanel` inside `BriefingSection`
- Plan Step 3 places `<BriefingSection>` above `<IssueProgressPage>` in the JSX
- Plan Acceptance Criteria says: "AiNudge at the very top... then
  KPI/chart/summary, then AiPrepPanel blocks at the bottom"
- These two statements are mutually exclusive — cannot satisfy AC with the
  proposed architecture
- The original feature request (Russian) says: "инсайт в самый верх, ai prep
  вниз" = insight at the very top, AI prep below
- "Вниз" (below) implies below the IssueProgressPage content, not just below
  AiNudge

## Proposed Solutions

### Option 1: Split BriefingSection into two components — Recommended

Separate the concerns into two async Server Components that each call
`getTodayBriefing()` (deduplicated by React `cache()`):

```tsx
// features/today-briefing/ui/ai-nudge-section.tsx
export async function AiNudgeSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  if (!briefing.nudge && briefing.events.length === 0) return null;
  return (
    <AiNudge key={briefing.date} text={briefing.nudge} date={briefing.date} />
  );
}

// features/today-briefing/ui/ai-prep-section.tsx
export async function AiPrepSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  if (briefing.events.length === 0) return null;
  return (
    <div className='flex flex-col gap-8'>
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

Page layout:

```tsx
<Suspense fallback={<AiNudgeSkeleton />}><AiNudgeSection date={date} /></Suspense>
<IssueProgressPage stats={stats} history={history} period={period} />
<Suspense fallback={<AiPrepSkeleton />}><AiPrepSection date={date} /></Suspense>
```

**Pros:** Satisfies the layout spec exactly. React `cache()` deduplicates the
two `getTodayBriefing()` calls. Two independent Suspense boundaries mean each
resolves as soon as the single underlying fetch completes. **Cons:** Two new
component files instead of one. Requires `getTodayBriefing` to be wrapped with
`cache()` first (see todo #092). **Effort:** Small (1-2 hours) **Risk:** Low —
clean architecture, follows existing patterns

---

### Option 2: Single BriefingSection, accept that AI Prep is above IssueProgressPage

Change the acceptance criteria. Accept that "at the bottom" means "at the bottom
of BriefingSection" (below AiNudge, not below IssueProgressPage). Put
BriefingSection above IssueProgressPage. Layout becomes:
`AiNudge → AiPrepPanels → IssueProgressPage`.

**Pros:** Simpler — one component, one Suspense boundary. **Cons:** Does not
match "вниз" intent from the feature request. AI prep panels appear before the
KPI chart, not after. **Effort:** Trivial **Risk:** Low technically, but
mismatches product intent

---

### Option 3: Remove Suspense, use inline Promise.all, place AI blocks as originally planned

Revert to the simpler approach:
`Promise.all([getIssueStats(), getIssueStatsHistory(), getTodayBriefing()])`,
render `AiNudge` at top and `AiPrepPanel` at bottom wrapping `IssueProgressPage`
in the middle. No BriefingSection needed.

**Pros:** Exact layout intent satisfied. Simpler code, no new abstractions.
**Cons:** Blocks KPI chart on briefing fetch. Slower perceived load. **Effort:**
Trivial **Risk:** Performance regression (acceptable for this feature size)

## Recommended Action

Implement Option 1 (split into `AiNudgeSection` + `AiPrepSection`). This is the
only option that satisfies the layout spec AND preserves the Suspense streaming
benefit. Requires `getTodayBriefing` to be wrapped with `cache()` first.

## Technical Details

**Affected files:**

- `app/dashboard/today/progress/page.tsx` — page layout
- `features/today-briefing/ui/briefing-section.tsx` — split into two files
- `features/today-briefing/index.ts` — export two components instead of one
- `features/today-briefing/api/today.ts` — add `cache()` (prerequisite)

## Acceptance Criteria

- [ ] `AiNudge` renders above `IssueProgressPage`
- [ ] `AiPrepPanel` blocks render below `IssueProgressPage`
- [ ] Each is wrapped in its own `<Suspense>` boundary
- [ ] `getTodayBriefing` is called only once per request (via `cache()`)

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (review agents)

**Actions:**

- Identified contradiction between implementation plan and acceptance criteria
- Confirmed with original Russian feature request that "вниз" means below the
  chart
- Three resolution options documented with effort/risk analysis
