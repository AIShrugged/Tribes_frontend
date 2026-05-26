---
status: done
priority: p2
issue_id: '084'
tags: [code-review, sidebar, navigation, telegram]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P2: Sidebar position 51 is too close to Chat(50) — use 60 instead

## Problem Statement

The plan places the Telegram sidebar item at `position: 51`, immediately after
AI Chat (position 50). The pattern-recognition agent flagged: "Position 51
implies Telegram is a secondary item under the Chat group... A value in the
55–70 range (e.g. 60) would more clearly signal an independent peer between Chat
and Agents."

Actual sidebar positions in `features/menu/lib/options.ts`:

- Today: 1, Meetings: 2, Tasks: 3, Teams: 5 (tight cluster = primary group)
- Chat: 50 (large gap = secondary zone start)
- Agents: 90 (large gap = peer item in secondary)

Position 51 places Telegram visually and logically adjacent to Chat (a 1-unit
gap), suggesting it's a sub-item of Chat rather than a peer. Position 60
provides equal spacing between Chat(50), Telegram(60), and Agents(90) — clearer
visual separation.

## Findings

- Pattern recognition agent: "Using 51 places Telegram immediately after Chat
  with a 39-unit gap to Agents... A value in the 55–70 range (e.g. `60`) would
  more clearly signal an independent peer."
- Frontend-design agent recommended secondary zone placement between Chat and
  Agents, position 51 was proposed but 60 is more balanced.

## Proposed Solutions

### Option A: Use position 60 (Recommended)

```ts
{
  id: 'telegram',
  label: 'Telegram',
  icon: 'send',
  href: ROUTES.DASHBOARD.TELEGRAM,
  position: 60,
}
```

**Pros:** Equal visual spacing between Chat(50), Telegram(60), Agents(90).
Clearly a peer item. **Cons:** Arbitrary — any value in 55-70 works equally
well. **Effort:** Trivial | **Risk:** None

### Option B: Keep position 51

**Pros:** Simple, works technically. **Cons:** Visual/semantic confusion — looks
like a sub-item of Chat. **Effort:** None | **Risk:** Low

## Recommended Action

Option A. Update `position: 51` to `position: 60` in Step 6 of the plan and in
implementation.

## Acceptance Criteria

- [ ] Telegram menu item uses `position: 60` in `getMenuItems()`
- [ ] Plan Step 6 updated to reflect position 60

## Work Log

- 2026-05-26: Identified during /technical_review. Pattern recognition agent
  flagged positional inconsistency.
