---
status: pending
priority: p2
issue_id: '064'
tags: [code-review, testing, chat, jest, server-actions]
dependencies: ['060']
---

# createChat Tests Will Break Without getOrganizationId Mock

## Problem Statement

If `createChat` is modified to call `getOrganizationId()` internally (as the
plan proposes), every existing test in
`features/chat/api/__tests__/chats.test.ts` will throw at runtime in Jest.
`getOrganizationId()` calls `cookies()` from `next/headers`, which is not
available in the jsdom environment.

The plan acknowledges adding the mock but presents it as additive ("File 3"). In
reality, it must be inserted into the **existing** mock section at the top of
the describe block — failure to do so will break all current `createChat` tests
immediately.

**Note:** This todo is conditional on whether `getOrganizationId` is called
inside `createChat`. If todo #060 is resolved by keeping org_id as an explicit
parameter, this todo becomes moot.

## Findings

Existing mock pattern in `chats.test.ts` (established convention):

```typescript
jest.mock('@/shared/lib/getAuthToken', () => ({
  getAuthToken: jest.fn().mockResolvedValue('mock-token'),
}));
```

Required addition (same pattern, same location — top of file with other mocks):

```typescript
jest.mock('@/shared/lib/getOrganizationId', () => ({
  getOrganizationId: jest.fn().mockResolvedValue('42'),
}));
```

**Missing test cases the plan should include:**

1. `organization_id: 42` (from mock cookie string `'42'`) is included in POST
   body
2. Guard fires correctly when `getOrganizationId` returns a non-integer string
   (e.g. `'abc'`) — uses `FrontendError`
3. Redirect propagates when `getOrganizationId` throws (simulate missing cookie
   redirect)

## Proposed Solutions

### Option 1 (Recommended): Add mock to existing mock block + 3 test cases

Insert the mock into the existing `jest.mock` block. Add tests for:

- Cookie value included in POST body
- Invalid cookie throws `FrontendError`
- Missing cookie redirect propagates

**Effort:** Small | **Risk:** None

### Option 2: Resolve via todo #060 (preferred if moving org_id to explicit param)

If `createChat` no longer reads the cookie internally, no mock is needed and no
existing tests break.

## Recommended Action

Resolve #060 first. If cookie reading stays inside `createChat`, apply Option 1.

## Technical Details

**Affected files:**

- `features/chat/api/__tests__/chats.test.ts` — add mock to existing mock block,
  add 3 test cases

## Acceptance Criteria

- [ ] All existing `createChat` tests pass after the change
- [ ] Mock for `getOrganizationId` is in the same mock block as `getAuthToken`
      (not in a separate describe)
- [ ] Test verifies `organization_id` appears in the POST body with the numeric
      value from the cookie
- [ ] Test verifies invalid cookie (non-integer) throws `FrontendError`

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (kieran-typescript-reviewer, pattern-recognition-specialist)

Both reviewers independently flagged that the test suite will break without the
mock in the correct location.
