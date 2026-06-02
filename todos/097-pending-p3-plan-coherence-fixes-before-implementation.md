---
status: pending
priority: p3
issue_id: '097'
tags: [code-review, documentation, today-briefing, planning]
dependencies: ['090', '092']
---

# Plan Coherence Issues — Fix Before Implementation Begins

## Problem Statement

The coherence review found 9 specific inconsistencies in the plan document that
would confuse an implementer. Several are minor, but two create actual
build-breaking ambiguity. These should be fixed in the plan before
implementation starts to avoid churn.

## Findings

| #   | Issue                                                                                                                                                         | Impact                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Unresolved deletion decision for TaskStatsBlock/ClosedTasksBlock pollutes both "keep" (Step 7 fixes FSD imports) and "delete" (recommendation) simultaneously | Implementer cannot determine what to do                       |
| 2   | Step 9 (verify index.ts exports) should be part of Step 1, not a late verification                                                                            | Steps 3 and 8 will fail to compile if Step 9 isn't done first |
| 3   | `searchParams` type update not mentioned in Step 3 body (only in AC)                                                                                          | Implementer may miss adding `date?: string` to the type       |
| 4   | `briefing` variable used in AC (`key={briefing.date}`) without being defined in any step                                                                      | Creates undefined reference confusion                         |
| 5   | `VALID_PERIODS` inline const in current `progress/page.tsx` must be removed when adding `isIssueHistoryPeriod` — not mentioned in Steps 2 or 3                | Would result in duplicate validation logic                    |
| 6   | `loading.tsx` for tasks route is listed as "Delete (if present)" but it definitely exists                                                                     | Hedge creates unnecessary ambiguity                           |
| 7   | Overview says "rename Progress → Tasks" which appears to say rename the label, but doesn't mention the existing Tasks tab being removed                       | Confusing without reading all steps                           |
| 8   | AiNudge/AiPrepPanel ordering: plan says "insight at top, prep at bottom" — but both are inside BriefingSection above IssueProgressPage                        | Structural contradiction (see todo #090)                      |
| 9   | Step ordering: Step 1 creates files, Step 3 imports them, Step 9 exports them — but Step 3 depends on Step 9                                                  | Create compile error if done in plan order                    |

## Proposed Solutions

### Option 1: Update the plan document to fix all coherence issues

Spend 20 minutes updating the plan markdown before anyone starts coding:

- Resolve the deletion question for TaskStatsBlock/ClosedTasksBlock
- Merge Step 9 into Step 1
- Add `date?: string` explicitly to Step 3's implementation notes
- Replace `briefing` variable reference in AC with a clear description
- Add "remove inline `VALID_PERIODS`" to Step 3 if type guard is kept
- Remove "(if present)" from loading.tsx deletion
- Reframe Overview to explicitly say "remove the existing Tasks entry from the
  nav"
- Update to reflect the two-component solution for todo #090

**Effort:** Small (20 min) **Risk:** None

---

### Option 2: Proceed with known ambiguities, resolve during implementation

Use the todos (#090, #092) to track the unresolved questions and resolve during
implementation.

**Pros:** Faster to start. **Cons:** Implementer must hold multiple open
questions in mind simultaneously. **Effort:** Zero plan-update effort **Risk:**
Low — todos track the decisions

## Recommended Action

Option 2 — the todos (#090, #092, #093) capture the critical decisions. The plan
is good enough to start implementation; fix it incrementally as decisions are
made. Update the plan checkboxes as implementation proceeds (per
`/workflows:work` conventions).

## Technical Details

**File to update:**

- `docs/plans/2026-05-28-refactor-today-dashboard-tabs-restructure-plan.md`

## Acceptance Criteria

- [ ] Before implementation: TaskStatsBlock/ClosedTasksBlock fate is decided
- [ ] Before Step 3: index.ts exports are confirmed (BriefingSection /
      AiNudgeSection)
- [ ] Step 3 implementation notes include `date?: string` in searchParams type

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (coherence review agent)

**Actions:**

- Coherence review identified 9 inconsistencies
- Categorized by impact (build-breaking vs. confusing)
- Recommended proceeding with todos rather than blocking on plan update
