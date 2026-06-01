---
status: pending
priority: p2
issue_id: '094'
tags: [code-review, product, ux, today-briefing]
dependencies: ['090']
---

# AiNudge Renders Above KPI Chart — Wrong User Intent Match for "Tasks" Tab

## Problem Statement

The plan places `AiNudge` at the very top of the new "Tasks" (ex-Progress) tab,
above the KPI chart and issue stats. The product-lens review flagged this as
incoherent: users navigating to a tab called "Tasks" that was previously the
progress analytics tab will encounter an AI-generated meeting context nudge
before seeing any task data. The nudge is calendar-driven (`getTodayBriefing`);
the tab's primary content is issue statistics (`IssueProgressPage`). These serve
different user intents and moments.

Additionally, the nudge only renders when `data.events.length > 0` — on days
with no meetings, the top of the tab is empty and the KPI chart starts from the
very top. This creates unpredictable visual weight.

## Findings

- `AiNudge` is generated from `TodayBriefing.nudge` — an AI analysis of today's
  calendar events
- `IssueProgressPage` shows org-wide issue statistics with period filtering
  (day/week/month)
- The Meetings tab is the natural home for calendar-context AI content
- On no-meeting days: `AiNudge` disappears → KPI chart shifts to top
- On meeting days: KPI chart is buried below an AI nudge and multiple prep
  panels
- The current Meetings tab already loads `getTodayBriefing` — placing `AiNudge`
  there is zero-cost
- The product-lens review recommended: "Move AiNudge and AiPrepPanel to the
  Meetings tab, where they already have calendar context"

## Proposed Solutions

### Option 1: Move AiNudge to the Meetings tab — Recommended

```tsx
// app/dashboard/today/meetings/page.tsx
// Add after DayTimeline / MeetingDetailCard content:
{
  data.nudge && <AiNudge key={data.date} text={data.nudge} date={data.date} />;
}
```

`getTodayBriefing` is already called on the Meetings page. Zero additional
fetch. The nudge appears adjacent to the meeting content it was generated from.

**Pros:** Contextually correct. No performance cost. Semantically coherent (AI
nudge next to meetings). **Cons:** If the product intent is specifically to
surface the nudge on the progress page, this contradicts it. **Effort:** Trivial
**Risk:** Low

---

### Option 2: Keep AiNudge on the Tasks page but move it below IssueProgressPage

Place the nudge below the KPI content rather than above it:

```
IssueProgressPage (KPI chart)
AiNudge
AiPrepPanel blocks
```

**Pros:** Satisfies the "Tasks tab has AI context" intent. KPI chart is always
the first thing users see. **Cons:** AiNudge is no longer "at the very top" —
contradicts the stated acceptance criteria. **Effort:** Trivial **Risk:** Low

---

### Option 3: Keep as planned (AiNudge above KPI)

Accept the UX inconsistency. Users will adapt.

**Pros:** Matches plan as written. **Cons:** Calendar-AI content above analytics
content is incoherent. Unpredictable visual layout on no-meeting days.
**Effort:** Zero **Risk:** UX regression

## Recommended Action

Clarify with product owner before implementing. The original request says
"инсайт в самый верх" (insight at the very top) — which suggests the AI nudge
should dominate the visual hierarchy. If that is intentional, Option 3 is
correct. If the chart should be the primary content, Option 2 is best. Option 1
is best if the AI nudge belongs with meeting context.

## Technical Details

**Affected files:**

- `app/dashboard/today/progress/page.tsx` — where AiNudge is proposed to land
- `app/dashboard/today/meetings/page.tsx` — alternative home (Option 1)

## Acceptance Criteria

- [ ] Product decision confirmed on visual hierarchy: chart first or nudge first
- [ ] AiNudge placement matches product intent
- [ ] No-meeting-day empty state is handled gracefully (AiNudge absence doesn't
      leave awkward gap)

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (product-lens review agent)

**Actions:**

- Identified UX incoherence between calendar-AI content and analytics content on
  same tab
- Confirmed zero-cost alternative placement (Meetings tab already has the data)
- Three options documented
