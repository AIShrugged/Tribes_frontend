---
status: pending
priority: p2
issue_id: '092'
tags: [code-review, product, today-briefing, ux]
dependencies: []
---

# WaitingOnYou and StaleItems Fate Unresolved — Unique Signals at Risk of Silent Deletion

## Problem Statement

The plan deletes the Tasks tab and moves only `AiNudge` + `AiPrepPanel` to the
new Tasks page. The plan leaves the fate of `WaitingOnYou` and `StaleItems` as a
"product decision" but does not block implementation on resolving it. These two
components contain unique actionable intelligence not available anywhere else in
the app:

- **`WaitingOnYou`** — tasks requiring the current user's action, with age-based
  urgency coloring (red after 7 days). Data from `data.waiting_on_you`.
- **`StaleItems`** — tasks with no progress across multiple meeting syncs
  (`task.syncs_since_created`). AI-derived signal.

Neither appears in `IssueProgressPage`. If they are silently removed with the
Tasks tab, users lose the only proactive "stuck items" view on the daily
dashboard.

## Findings

- `WaitingOnYou` and `StaleItems` are rendered only in
  `app/dashboard/today/tasks/page.tsx` (lines 46–47)
- `IssueProgressPage` shows aggregate KPI cards + trend chart — no equivalent to
  per-task urgency signals
- The plan recommends deleting `TaskStatsBlock` and `ClosedTasksBlock` (their
  stats are covered by `IssueProgressKpiCards`) — this is sound
- The plan is silent on `WaitingOnYou` and `StaleItems`
- If these components are deleted, users lose visibility into "tasks waiting on
  me" and "stuck tasks" — both critical for standup prep

## Proposed Solutions

### Option 1: Move WaitingOnYou + StaleItems to the Meetings tab — Recommended

Both components are driven by `TodayBriefing.waiting_on_you` and
`TodayBriefing.stale` — data from the same endpoint used by the Meetings tab
(`getTodayBriefing`). Moving them to the Meetings tab makes contextual sense:
they are meeting-prep signals, not progress-analytics signals.

```tsx
// app/dashboard/today/meetings/page.tsx — add after MeetingsContent
<WaitingOnYou tasks={data.waiting_on_you} />
<StaleItems tasks={data.stale} />
```

**Pros:** Contextually correct (meeting-driven signals near meeting content). No
data fetching changes (Meetings page already fetches getTodayBriefing).
**Cons:** Meetings tab becomes longer; users must know to look there for task
signals. **Effort:** Small (30 min) **Risk:** Low

---

### Option 2: Keep WaitingOnYou + StaleItems in the new Tasks (ex-Progress) page

Add both panels below the IssueProgressPage content on the new Tasks page.
Requires including them in the data fetch (BriefingSection already calls
getTodayBriefing, so data is available).

```tsx
// Below IssueProgressPage, inside AiPrepSection or a new section:
<WaitingOnYou tasks={briefing.waiting_on_you} />
<StaleItems tasks={briefing.stale} />
```

**Pros:** Users find task-oriented content in the "Tasks" tab (semantically
consistent with the new label). **Cons:** Mixes meeting-AI signals with
progress-analytics content. **Effort:** Small **Risk:** Low

---

### Option 3: Delete them (accept the loss)

If analytics shows these panels have very low engagement, deleting them
simplifies the codebase.

**Pros:** Simplification. **Cons:** Loss of unique actionable signals; no
analytics data confirmed. **Effort:** Trivial **Risk:** Medium (user regression
without data to support the decision)

## Recommended Action

Option 1 (move to Meetings tab). The signals are meeting-context driven, the
data is already there, and the move is lowest-effort with zero regression risk.
Confirm with product owner before implementing.

## Technical Details

**Affected files:**

- `app/dashboard/today/meetings/page.tsx` — add WaitingOnYou, StaleItems
  rendering (if Option 1)
- `app/dashboard/today/tasks/page.tsx` — source file being deleted
- `features/today-briefing/index.ts` — WaitingOnYou, StaleItems already exported
  (no change)

## Acceptance Criteria

- [ ] Product decision made: Option 1, 2, or 3
- [ ] WaitingOnYou and StaleItems either have a defined location or are
      explicitly deleted
- [ ] If kept, they appear in the correct tab with access to briefing data

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (product-lens + coherence review agents)

**Actions:**

- Identified unique data signals in WaitingOnYou (waiting_on_you) and StaleItems
  (stale)
- Confirmed no equivalent in IssueProgressPage
- Three placement options documented
