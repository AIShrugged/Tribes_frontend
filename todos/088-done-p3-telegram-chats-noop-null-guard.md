---
status: done
priority: p3
issue_id: '088'
tags: [code-review, typescript, correctness, telegram]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P3: `chats ?? []` is a no-op in the new page — `PaginatedResult.data` is always `T[]`

## Problem Statement

In the proposed `app/dashboard/telegram/page.tsx`:

```tsx
const [{ data: chats }, { data: organizations }] = await Promise.all([
  getTelegramChats(),
  getOrganizations(),
]);
// ...
initialChats={chats ?? []}
```

`getTelegramChats()` returns `PaginatedResult<TelegramChatRegistration>` (from
`httpClientList`), where `data` is always `T[]` — never `null | undefined`. The
`chats ?? []` fallback is therefore dead code.

The `organizations ?? []` on the other hand IS necessary because
`getOrganizations()` returns `ApiResponse<T>` where `data` is `T | undefined`.

This is not a runtime bug but it's misleading — it suggests `chats` can be falsy
when it can't, which can confuse future readers.

## Findings

TypeScript reviewer: "`getTelegramChats()` returns
`PaginatedResult<TelegramChatRegistration>` (shape:
`{ data, totalCount, hasMore }`), not `{ data: T | undefined }`. The
`chats ?? []` fallback is a no-op since `data` in `PaginatedResult` is always
`T[]`."

## Proposed Solution

In the new `app/dashboard/telegram/page.tsx`:

```tsx
// Before:
initialChats={chats ?? []}

// After:
initialChats={chats}
```

Only if `TelegramChatsManagement` accepts `TelegramChatRegistration[]` (not
nullable). Verify the prop type first.

**Effort:** Trivial | **Risk:** None

## Acceptance Criteria

- [ ] `chats ?? []` replaced with `chats` in new page (or the existing page if
      both are updated)
- [ ] `TelegramChatsManagement.initialChats` prop type is confirmed as
      `TelegramChatRegistration[]` (not nullable)

## Work Log

- 2026-05-26: Identified during /technical_review. TypeScript reviewer flagged.
