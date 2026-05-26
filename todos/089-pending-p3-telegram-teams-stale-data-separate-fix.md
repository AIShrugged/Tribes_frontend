---
status: pending
priority: p3
issue_id: '089'
tags: [code-review, revalidatePath, teams, telegram, cache]
dependencies: []
---

# P3: Teams page shows stale Telegram chat data after mutations (pre-existing bug)

## Problem Statement

`app/dashboard/teams/page.tsx` calls `getTelegramChats()` to populate an
`availableChats` prop (Telegram chat picker on the Teams page). When a Telegram
workspace chat is added or deleted via `features/telegram/api/telegram.ts`, only
the Telegram page is revalidated — the Teams page is not, so it will show the
old list of available chats until the cache expires.

This is a **pre-existing bug** that exists today at
`/dashboard/profile/telegram` and will continue at `/dashboard/telegram` after
the route migration. It was surfaced during the route move review but should be
fixed in a separate commit.

**Note:** This was intentionally removed from the route migration plan (see todo
#083) to keep the route move focused. It should be fixed independently.

## Findings

Architecture agent: "After the move, `createTelegramWorkspaceChat` and
`deleteTelegramWorkspaceChat` will `revalidatePath(ROUTES.DASHBOARD.TELEGRAM)`.
However, `getTelegramChats` is also consumed by
`app/dashboard/teams/page.tsx`... the Teams page will serve stale linked-chat
data until the Teams page's own cache expires."

## Proposed Solution

In `features/telegram/api/telegram.ts`, after updating `revalidatePath` to use
the new route (todo #082), also add:

```ts
import { ROUTES } from '@/shared/lib/routes';

// In createTelegramWorkspaceChat:
revalidatePath(ROUTES.DASHBOARD.TELEGRAM);
revalidatePath(ROUTES.DASHBOARD.TEAMS);

// In deleteTelegramWorkspaceChat:
revalidatePath(ROUTES.DASHBOARD.TELEGRAM);
revalidatePath(ROUTES.DASHBOARD.TEAMS);
```

Add a comment explaining the cross-page dependency to prevent future removal.

**Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Both mutation actions in `telegram.ts` call
      `revalidatePath(ROUTES.DASHBOARD.TEAMS)` in addition to the Telegram page
      path
- [ ] A comment explains why the Teams path is also revalidated
- [ ] Teams page shows updated chat list immediately after add/delete on the
      Telegram page

## Work Log

- 2026-05-26: Surfaced during route migration review. Intentionally excluded
  from migration plan; tracked here as separate fix.
