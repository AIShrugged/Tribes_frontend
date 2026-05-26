---
status: pending
priority: p3
issue_id: '066'
tags: [code-review, typescript, chat, architecture, naming]
dependencies: ['060']
---

# createChat Plan: ChatCreatePayload Interface Is Over-Abstraction

## Problem Statement

The deepened plan introduces a new `ChatCreatePayload` interface in
`features/chat/model/types.ts` with a single effective field
(`title?: string | null`). This is a named abstraction for what amounts to
`{ title?: string | null }` — an inline type that TypeScript would infer
identically.

Additionally, the naming `ChatCreatePayload` alongside the existing
`ChatUpsertDTO` creates two overlapping type names for the same resource with no
clear boundary between them. `updateChat` uses `Partial<ChatUpsertDTO>` while
`createChat` would use `ChatCreatePayload` — inconsistent contracts for the same
field set.

**Note:** This is moot if todo #060 resolves by keeping `Partial<ChatUpsertDTO>`
as the parameter type (which is the preferred outcome).

## Findings

Naming conventions in `features/` layer (pattern-recognition-specialist):

- Newer pattern uses `*CreatePayload` (e.g. `AgentProfileCreatePayload`,
  `TelegramWorkspaceChatCreatePayload`)
- Existing chat types use `*UpsertDTO`

A single-field interface named `ChatCreatePayload` adds a new type family for no
benefit. Better alternatives (in order of preference):

1. Keep `Partial<ChatUpsertDTO>` — consistent with `updateChat`, no new type
2. `Pick<ChatUpsertDTO, 'title'>` — self-documenting, no new file changes
3. Inline `{ title?: string | null }` — simplest, most honest

## Proposed Solutions

### Option 1 (Recommended): Resolve via todo #060 — keep Partial<ChatUpsertDTO>

No new type needed at all.

**Effort:** None | **Risk:** None

### Option 2: Use Pick if org_id must be excluded

```typescript
export async function createChat(
  payload: Pick<ChatUpsertDTO, 'title'> = {},
): Promise<ActionResult<Chat>>;
```

Self-documenting, no new interface.

### Option 3: Add ChatCreatePayload as proposed

Accept the plan's interface, update JSDoc on `ChatUpsertDTO` to document the
relationship.

**Effort:** Small | **Risk:** Low — just naming confusion

## Recommended Action

Option 1 — let todo #060 resolve this by keeping `Partial<ChatUpsertDTO>`. If
#060 is not resolved that way, use Option 2.

## Technical Details

**Affected files:**

- `features/chat/model/types.ts` — no new interface needed under Option 1/2

## Acceptance Criteria

- [ ] No new `ChatCreatePayload` interface in `types.ts`
- [ ] `createChat` parameter type is consistent with `updateChat` (both use
      `ChatUpsertDTO` or both have explicitly named types)

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (kieran-typescript-reviewer, code-simplicity-reviewer,
pattern-recognition-specialist)

Three independent reviewers flagged the new interface as unnecessary
abstraction.
