---
status: done
priority: p2
issue_id: '085'
tags: [code-review, testing, sidebar, telegram]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P2: Test plan incomplete — `'send'` key missing from ICONS_MAP key assertion

## Problem Statement

The plan's Step 9 (test assertion) only adds a named item test:

```ts
it('includes a Telegram item', () => { ... })
```

But `features/menu/lib/__tests__/options.test.ts` also has an ICONS_MAP key
enumeration test (lines ~68-75) that explicitly lists all expected keys. When
`send: Send` is added to `ICONS_MAP`, the key `'send'` must also be added to
that test's key array — otherwise:

1. Future removal of `send` from `ICONS_MAP` won't be caught by the test
2. The test's enumeration becomes stale (documents an incomplete set of icon
   keys)

Architecture agent: "the existing test at `options.test.ts:89-92` — 'all menu
icon keys exist in ICONS_MAP' — will catch any mismatch at test time. The plan's
test step adds only a named assertion for the Telegram item; it should also
explicitly list `'send'` in the `ICONS_MAP` key assertion block at line 68–75."

## Findings

- Architecture agent flagged the ICONS_MAP key test gap.
- Pattern recognition agent: "The plan also needs to add `'send'` (or whatever
  icon key is chosen) to the `keys` array in the `ICONS_MAP` 'has an entry for
  each icon key' test."

## Proposed Solutions

### Option A: Add 'send' to ICONS_MAP key array in existing test (Recommended)

In `features/menu/lib/__tests__/options.test.ts`, find the array/set of expected
ICONS_MAP keys and add `'send'`:

```ts
// Existing test (approximate):
const expectedKeys = ['bot', 'calendar', ...otherKeys, 'send']; // add 'send'
```

**Pros:** Complete test coverage. Future removal of the icon will fail the test.
**Effort:** Small | **Risk:** None

### Option B: Only add the named item test (current plan)

**Pros:** Simpler. **Cons:** ICONS_MAP key coverage remains incomplete.
**Effort:** None | **Risk:** Low

## Recommended Action

Option A. The test at line ~68-75 should be updated alongside the new item test.

## Acceptance Criteria

- [ ] `'send'` key appears in the ICONS_MAP key enumeration test in
      `options.test.ts`
- [ ] The named Telegram item test is also added (per plan Step 9)
- [ ] Both tests pass after implementation

## Work Log

- 2026-05-26: Identified during /technical_review. Architecture and pattern
  recognition agents flagged the gap.
