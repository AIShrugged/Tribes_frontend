---
status: pending
priority: p2
issue_id: "062"
tags: [code-review, nextjs, chat, conventions, caching]
dependencies: ["060"]
---

# createChat: Missing `revalidatePath` After Successful Creation

## Problem Statement

The plan's proposed `createChat` implementation does not call `revalidatePath` after a successful chat creation. Every other mutation in the codebase that changes data visible in the UI calls `revalidatePath` on the most specific path. This is a codebase-wide convention.

Without `revalidatePath('/dashboard/chat')`, new chats will not appear in the chat sidebar list until the user navigates away and back.

## Findings

Codebase convention (confirmed by pattern-recognition-specialist): `createTeam`, `createAgentProfile`, `updateOrganization`, and all other mutations call `revalidatePath` after success. `createChat` and `deleteChat` currently do not — this is a pre-existing gap, and the plan is the right opportunity to fix it.

**Location:** `features/chat/api/chats.ts:createChat` (and `deleteChat` — related)

```typescript
// Missing in the plan's proposed implementation:
revalidatePath(ROUTES.DASHBOARD.CHAT); // after successful httpClient call
```

## Proposed Solutions

### Option 1 (Recommended): Add revalidatePath to createChat and deleteChat

```typescript
// After successful chat creation:
revalidatePath(ROUTES.DASHBOARD.CHAT);
return { data: data, error: null };
```

Also add to `deleteChat` for the same reason.

**Effort:** Trivial (1 line per action) | **Risk:** None

### Option 2: Add only to createChat (minimal scope)

Fix only what the plan explicitly addresses.

**Effort:** Trivial | **Risk:** None

## Recommended Action

Option 1 — fix both `createChat` and `deleteChat` in the same PR since they are in the same file and have the same gap.

## Technical Details

**Affected files:**
- `features/chat/api/chats.ts` — add `revalidatePath(ROUTES.DASHBOARD.CHAT)` in `createChat` and `deleteChat`
- Import: `import { revalidatePath } from 'next/cache'` and `import { ROUTES } from '@/shared/lib/routes'`

## Acceptance Criteria

- [ ] After `createChat` succeeds, the chat list at `/dashboard/chat` is revalidated
- [ ] After `deleteChat` succeeds, the chat list is revalidated
- [ ] No new chats require a page reload to appear in the sidebar

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (pattern-recognition-specialist)

Flagged as a missing convention. Pre-existing in `deleteChat` too; the plan is the right place to fix both.
