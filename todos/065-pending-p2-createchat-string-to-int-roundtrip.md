---
status: pending
priority: p2
issue_id: '065'
tags: [code-review, typescript, chat, security, validation]
dependencies: ['060', '063']
---

# createChat: String-to-Integer Conversion Missing Round-Trip Validation

## Problem Statement

The plan proposes `Number(raw)` to convert the `organization_id` cookie string
to an integer. `Number()` silently truncates non-numeric trailing characters:
`Number('42abc')` → `42`. This means a cookie value like `'42abc'` passes the
`Number.isInteger` check with value `42` — the guard does not catch it.

**Note:** This is conditional on the integer guard being retained. If todo #060
is resolved by moving the cookie read out of `createChat`, this todo is moot.

## Findings

`getOrganizationId()` returns `Promise<string>`. The plan's guard:

```typescript
const organizationId = Number(raw);
if (!Number.isInteger(organizationId) || organizationId <= 0) {
  throw new Error(...); // doesn't catch '42abc' → 42
}
```

`Number('42abc')` → `42` → `Number.isInteger(42)` is `true` → guard passes →
`42` sent to backend.

The safe pattern uses a round-trip equality check:

```typescript
const organizationId = Number(raw);
if (
  !Number.isInteger(organizationId) ||
  organizationId <= 0 ||
  String(organizationId) !== raw.trim()
) {
  throw new FrontendError(
    'Invalid organization_id cookie: value is not a positive integer',
  );
}
```

`String(42) !== '42abc'.trim()` → `'42' !== '42abc'` → true → guard fires
correctly.

## Proposed Solutions

### Option 1 (Recommended): Add round-trip check

```typescript
const organizationId = Number(raw);
if (
  !Number.isInteger(organizationId) ||
  organizationId <= 0 ||
  String(organizationId) !== raw.trim()
) {
  throw new FrontendError(
    'Invalid organization_id cookie: value is not a positive integer',
  );
}
```

**Effort:** Trivial | **Risk:** None

### Option 2: Use `parseInt` with radix 10 + round-trip

```typescript
const organizationId = parseInt(raw.trim(), 10);
if (
  isNaN(organizationId) ||
  organizationId <= 0 ||
  String(organizationId) !== raw.trim()
) {
  throw new FrontendError('...');
}
```

Equivalent safety.

### Option 3: Resolve via todo #060

If cookie reading moves out of `createChat`, this todo is moot.

## Recommended Action

If the guard is kept (todo #060 not resolving by removing the cookie read),
apply Option 1. Otherwise, close as moot.

## Technical Details

**Affected files:**

- `features/chat/api/chats.ts` — integer conversion guard

## Acceptance Criteria

- [ ] `'42abc'` as cookie value is rejected by the guard
- [ ] `'42'` as cookie value passes correctly
- [ ] `'0'`, `'-1'`, `''`, `'abc'` are all rejected

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (security-sentinel)

Flagged `parseInt` / `Number()` footguns in the conversion. Round-trip check is
the established safe pattern.
