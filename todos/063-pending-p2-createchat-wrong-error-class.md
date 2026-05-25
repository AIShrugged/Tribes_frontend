---
status: pending
priority: p2
issue_id: "063"
tags: [code-review, typescript, chat, error-handling]
dependencies: ["060"]
---

# createChat: Wrong Error Class for Cookie Validation Failure

## Problem Statement

The plan's proposed guard throws `new Error(...)` for a corrupted/invalid `organization_id` cookie value. This bypasses the project's typed error system.

`shared/lib/errors.ts` exports `FrontendError` specifically for client-side logic errors, unexpected state, and invariant violations. A corrupt cookie value is exactly this — a `FrontendError` with `source: 'frontend'`. Using the base `Error` class bypasses dev-mode diagnostics in `ErrorDisplay` and is inconsistent with the rest of the codebase.

Additionally, the raw cookie value should not be embedded in the error message — it is user-controlled content that could poison server logs.

## Findings

**Plan's proposed code:**
```typescript
if (!Number.isInteger(organizationId) || organizationId <= 0) {
  throw new Error(`Invalid organization_id cookie: "${raw}"`);
}
```

**Issues:**
1. `Error` instead of `FrontendError` — bypasses dev error display system
2. Raw cookie value (`"${raw}"`) in the message — log injection risk (CRLF, excessively long strings)

**Note:** This todo is conditional on whether the integer guard is kept. Todo #060 proposes removing the guard entirely by moving cookie reading out of `createChat`. If #060 is resolved by removing the guard, this todo is moot.

## Proposed Solutions

### Option 1 (Recommended): Fix the error class and message

```typescript
import { FrontendError } from '@/shared/lib/errors';

if (!Number.isInteger(organizationId) || organizationId <= 0) {
  throw new FrontendError('Invalid organization_id cookie: value is not a positive integer');
}
```

**Effort:** Trivial | **Risk:** None

### Option 2: Remove the guard entirely (resolves via todo #060)

If todo #060 is resolved by keeping `organization_id` as an explicit parameter, the cookie read and guard disappear entirely — this todo becomes moot.

## Recommended Action

Resolve #060 first. If the guard is kept, apply Option 1.

## Technical Details

**Affected files:**
- `features/chat/api/chats.ts` — error class and message in the guard

## Acceptance Criteria

- [ ] No bare `new Error(...)` for cookie validation in server actions
- [ ] If guard is kept: uses `FrontendError` with a fixed (non-raw-value) message
- [ ] Raw cookie value not embedded in any thrown error message

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (kieran-typescript-reviewer, security-sentinel)

Both reviewers flagged the wrong error class and log-injection risk independently.
