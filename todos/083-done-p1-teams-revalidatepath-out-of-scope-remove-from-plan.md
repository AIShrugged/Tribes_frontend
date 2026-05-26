---
status: done
priority: p1
issue_id: '083'
tags: [code-review, plan-correction, telegram, revalidatePath]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P1: Remove `revalidatePath(ROUTES.DASHBOARD.TEAMS)` from plan — out of scope

## Problem Statement

The deepened plan's Step 8 adds `revalidatePath(ROUTES.DASHBOARD.TEAMS)` to both
mutation actions, claiming it "fixes latent stale-data issue on Teams page." The
simplicity reviewer confirmed that `app/dashboard/teams/page.tsx` does call
`getTelegramChats()`, so the Teams page does render Telegram data.

**However, this is a separate pre-existing bug, not introduced by this route
migration.** The plan is for a route move, not a bug fix sprint. Bundling this
in:

1. Adds `features/telegram` holding hidden knowledge of which external pages
   consume its data (implicit coupling, noted by architecture agent)
2. Couples two unrelated changes in one commit
3. Makes the migration harder to review and revert if needed

The simplicity reviewer conclusion: "Adding
`revalidatePath(ROUTES.DASHBOARD.TEAMS)` is out of scope, separate concern.
Remove it."

## Findings

- Simplicity agent: "revalidatePath(ROUTES.DASHBOARD.TEAMS) — out of scope,
  separate concern. Remove it."
- Architecture agent: "The plan does not name which bug this fixes... The
  architectural risk is that `features/telegram` now holds hard-coded knowledge
  of which external pages consume its data."
- Teams page does use telegram chat data (confirmed by reading
  `app/dashboard/teams/page.tsx`) — so a future fix is warranted, but it belongs
  in a separate ticket.

## Proposed Solutions

### Option A: Remove from this plan; create separate todo (Recommended)

Remove the `revalidatePath(ROUTES.DASHBOARD.TEAMS)` lines from Step 8 of the
plan. Create a separate P3 ticket tracking the Teams stale-data issue. **Pros:**
Clean scope, atomic migration commit. **Cons:** Teams stale-data bug persists
temporarily. **Effort:** Small | **Risk:** None

### Option B: Keep it with a code comment

Add a comment in `telegram.ts` explaining the dependency:

```ts
// Teams page also fetches telegram chats — must revalidate both
revalidatePath(ROUTES.DASHBOARD.TEAMS);
```

**Pros:** Fixes the pre-existing bug now. **Cons:** Mixes concerns in one
commit; implicit coupling persists. **Effort:** Small | **Risk:** Low

## Recommended Action

Option A — remove from this plan. The Teams stale-data issue should be a
separate P3 fix ticket with a proper investigation of all pages that consume
telegram chat data.

## Acceptance Criteria

- [ ] Step 8 of plan does NOT include `revalidatePath(ROUTES.DASHBOARD.TEAMS)`
- [ ] A separate P3 ticket exists to track Teams stale-data bug
- [ ] Plan is updated to remove this from Acceptance Criteria too

## Work Log

- 2026-05-26: Identified during /technical_review. Simplicity and architecture
  agents flagged as scope creep.
