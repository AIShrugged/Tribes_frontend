---
status: pending
priority: p1
issue_id: "061"
tags: [code-review, typescript, chat, type-safety]
dependencies: []
---

# createChat: Unsafe Non-Null Assertion `data: data!`

## Problem Statement

The deepened plan carries forward (and codifies) the pattern `return { data: data!, error: null }` where `data` is typed as `T | null` at runtime despite the `T` compile-time type. This is an unsafe non-null assertion that suppresses TypeScript's type-checking on a value that could legitimately be `null`.

## Findings

`httpClient<T>` returns `{ data: T | null }` at runtime (the backend `ApiEnvelope.data` field is typed as `T | null`). The `data as T` cast inside `httpClient` already lies to TypeScript. Adding `data!` in `createChat` piles a second lie on top.

While a successful `POST /api/v1/chats` always returns the new `Chat` object (so `null` is not expected at runtime today), the plan should not normalize this unsafe pattern. The existing `httpClient.ts` already provides `httpClientAction` (or equivalent) that encodes the full `ActionResult<T>` contract without a non-null assertion.

**Location:** `features/chat/api/chats.ts` — proposed `createChat` implementation in the plan

## Proposed Solutions

### Option 1 (Recommended): Use `httpClientAction` helper

```typescript
return httpClientAction<Chat>(
  `${API_URL}/chats`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: payload.title ?? null, organization_id: organizationId }),
  },
  'Failed to create chat',
);
```

`httpClientAction` returns `ActionResult<Chat>` directly, encodes success/failure correctly, and requires no `data!` assertion.

**Effort:** Small | **Risk:** None

### Option 2: Add null check before returning

```typescript
if (!data) throw new FrontendError('createChat returned no data from backend');
return { data, error: null };
```

**Effort:** Small | **Risk:** Low — slightly noisier than Option 1

## Recommended Action

Option 1 — use `httpClientAction` if it exists in `shared/lib/httpClient.ts`. If it does not, use Option 2. Either way, remove the `!` assertion.

## Technical Details

**Affected files:**
- `features/chat/api/chats.ts` — the proposed `createChat` implementation
- `shared/lib/httpClient.ts` — verify if `httpClientAction` exists

## Acceptance Criteria

- [ ] `createChat` has no `data!` non-null assertion
- [ ] TypeScript compiles without suppressed errors in this function
- [ ] Success path still returns `{ data: Chat; error: null }`

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (kieran-typescript-reviewer)

The reviewer flagged that the plan codifies an unsafe pattern. The `!` assertion is in the existing codebase as tech debt; the new code should not add a fresh instance of it.
