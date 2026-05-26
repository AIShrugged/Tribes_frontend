---
status: done
priority: p1
issue_id: '082'
tags: [code-review, correctness, revalidatePath, telegram, next.js]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P1: `revalidatePath` must be updated in the same commit as the route move

## Problem Statement

`features/telegram/api/telegram.ts` lines 36 and 61 call
`revalidatePath('/dashboard/profile/telegram')`. After the route moves to
`/dashboard/telegram`, these calls target a path that no longer exists in the
router tree. Next.js will attempt to invalidate a dead path, and the new page at
`/dashboard/telegram` will serve stale RSC payload after every mutation until
the cache expires naturally.

This is a **silent correctness bug** — no error is thrown. Users who add or
delete a Telegram chat will see no change on the page (the old list persists)
until they force a full navigation or refresh.

## Findings

- Security sentinel: "a successful delete returns
  `{ data: undefined, error: null }` to the UI, which will then show the old
  list. A user could conclude the deletion failed, leaving a chat registration
  they intended to remove still active."
- Performance oracle: "The mutation will succeed, but the page the user is
  actually on will serve stale RSC payload until a full navigation or manual
  refresh. This is a silent correctness bug — no error is thrown, the purge just
  does nothing."
- Architecture agent: confirmed lines 36 and 61 are the only two call sites.

## Proposed Solutions

### Option A: Update revalidatePath in the same commit as the route (Recommended)

```ts
// Before (lines 36 and 61 in telegram.ts):
revalidatePath('/dashboard/profile/telegram');

// After:
import { ROUTES } from '@/shared/lib/routes';
revalidatePath(ROUTES.DASHBOARD.TELEGRAM);
```

**Pros:** Atomic change, no window where mutations fail silently. Uses constant
rather than hardcoded string (satisfies `sonarjs/no-duplicate-string` ESLint
rule). **Cons:** None. **Effort:** Small | **Risk:** None

### Option B: Use hardcoded string literal

```ts
revalidatePath('/dashboard/telegram');
```

**Pros:** No import needed. **Cons:** Violates the pattern of using ROUTES
constants; ESLint `sonarjs/no-duplicate-string` will flag two identical strings.
**Effort:** Small | **Risk:** Low (linting failure)

## Recommended Action

Option A. Import `ROUTES` and use `ROUTES.DASHBOARD.TELEGRAM`.

Note: Do NOT add `revalidatePath(ROUTES.DASHBOARD.TEAMS)` here — that is a
separate pre-existing bug tracked in a different ticket, not part of this route
migration.

## Acceptance Criteria

- [ ] Both `revalidatePath` calls in `features/telegram/api/telegram.ts` use
      `ROUTES.DASHBOARD.TELEGRAM`
- [ ] `ROUTES` is imported at the top of `telegram.ts`
- [ ] Change is in the same commit as the route move, not a follow-up

## Work Log

- 2026-05-26: Identified during /technical_review. Flagged as critical by
  security, performance, and architecture agents.
