---
status: pending
priority: p2
issue_id: '056'
tags: [mobile-chat, fsd, imports, ios, overscroll, accessibility]
dependencies: []
---

# Fix Deep Path Imports, overscroll-contain, and Path Guard in MobileChatDrawer

## Problem Statement

Three correctness issues that each affect either FSD compliance, iOS Safari
scrolling behavior, or a pre-existing latent bug in `DashboardChatColumn`. All
are straightforward fixes.

## Findings

**Issue 1: Deep path imports in layout.tsx and MobileChatDrawer** (Kieran TS
HIGH #8, LOW #14, #15)

Plan proposes:

```ts
// In layout.tsx:
import { getChats } from '@/features/chat/api/chats';
import { getMessages } from '@/features/chat/api/messages';
import type { Message } from '@/features/chat/model/types';

// In MobileChatDrawer.tsx:
import { DashboardChatPanel } from '@/widgets/dashboard-chat/ui/DashboardChatPanel';
import type { Chat, Message } from '@/features/chat/model/types';
```

Per `CLAUDE.md`: consumers must import from `@/features/<name>` public API,
never deep paths. `features/chat/index.ts` already re-exports all three. The
same-widget import for `DashboardChatPanel` should use a relative path
`'./DashboardChatPanel'` to avoid a cross-boundary absolute path smell.

**Correct:**

```ts
// layout.tsx:
import { getChats, getMessages } from '@/features/chat';
import type { Message } from '@/features/chat';

// MobileChatDrawer.tsx:
import { DashboardChatPanel } from './DashboardChatPanel';
import type { Chat, Message } from '@/features/chat';
```

**Issue 2: `overscroll-contain` absent from sheet JSX** (Kieran TS HIGH #9)

Plan research section line 590: "use `overscroll-behavior: contain` on the inner
scrollable div to prevent scroll propagation through the sheet." Without this,
on iOS the position-fixed scroll lock can be defeated by overscrolling at the
top/bottom of the chat list inside the drawer — the background page scrolls
instead.

This class must be applied to the scrollable container inside the sheet (the
wrapper around `DashboardChatPanel`):

```tsx
<div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
  <DashboardChatPanel ... />
</div>
```

The acceptance criteria must also include a test for this behavior.

**Issue 3: `startsWith` false-positive in DashboardChatColumn** (Architecture
Strategist, additional finding; plan also identifies this)

`DashboardChatColumn.tsx:25`:

```ts
const isHidden = HIDDEN_ON_PATHS.some((p) => pathname.startsWith(p));
```

This would match a hypothetical `/dashboard/chat-settings` or
`/dashboard/chat-history` route, hiding the chat column incorrectly. Plan
proposes fixing to:

```ts
const isHidden = HIDDEN_ON_PATHS.some(
  (p) => pathname === p || pathname.startsWith(`${p}/`),
);
```

This is a latent bug in existing code that should be fixed regardless of whether
the full mobile chat feature ships.

## Proposed Solutions

### Option 1: Fix all three in the same commit

**Approach:** All three are small, low-risk changes that should land together
since they are all part of the `MobileChatDrawer` implementation work.

**Effort:** 30 minutes total  
**Risk:** None

## Recommended Action

Fix all three as part of implementing `MobileChatDrawer`. Issue 3 (path guard)
should land even if the mobile drawer is deferred, since it's a pre-existing
bug.

## Technical Details

**Affected files:**

- `widgets/dashboard-chat/ui/DashboardChatColumn.tsx:25` — fix `startsWith`
  guard
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — fix imports, add
  `overscroll-contain`
- `app/dashboard/layout.tsx` (or `MobileChatDrawerLoader.tsx`) — fix deep path
  imports

## Acceptance Criteria

- [ ] `DashboardChatColumn` path guard uses `=== p || startsWith(p + '/')`
      pattern
- [ ] All imports in `MobileChatDrawer` and layout use public `@/features/chat`
      API (no deep paths)
- [ ] `DashboardChatPanel` is imported via `'./DashboardChatPanel'` relative
      path within the widget
- [ ] Sheet's inner scrollable container has `overscroll-contain` class
- [ ] On iOS Safari: overscrolling at top/bottom of chat list does not scroll
      the background page

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**

- Kieran TS flagged deep path imports (HIGH #8, LOW #14/15) and overscroll
  missing (HIGH #9)
- Architecture Strategist flagged path guard bug as latent and recommend fixing
  in this changeset
