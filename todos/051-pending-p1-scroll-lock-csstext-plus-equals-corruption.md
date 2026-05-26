---
status: pending
priority: p1
issue_id: '051'
tags: [mobile-chat, scroll-lock, ios, typescript, bug]
dependencies: []
---

# Fix `cssText +=` in scroll-lock.ts — Corrupts Existing Body Inline Styles

## Problem Statement

The plan's `lockScroll()` implementation uses
`document.body.style.cssText += '...'` to apply the position-fixed scroll lock.
This is dangerous: `cssText` is a serialized string of ALL inline styles;
appending to it can produce duplicate declarations, and on cleanup the
individual property resets silently destroy any pre-existing inline styles that
were on `<body>` before the lock was applied (e.g., theme transitions, animation
framework `will-change`, etc.).

## Findings

- Plan line 188 (in `shared/lib/scroll-lock.ts`):
  `document.body.style.cssText += \`position: fixed; top: -${savedScrollY}px;
  width: 100%; overflow-y: scroll;\``
- The `unlockScroll` clears four individual properties (`position`, `top`,
  `width`, `overflowY`). If body had ANY other inline style before lock, those
  are silently nuked on unlock.
- The plan's own research section (lines 624–635) shows the correct
  individual-property approach — the implementation block contradicts the
  research block.
- Architecture Strategist (finding #6, MEDIUM→fix-before-impl) and Kieran
  TypeScript reviewer (CRITICAL #1) both flag this independently.

**Corrupted state scenario:**

```
// Before lockScroll: body has will-change: transform (set by framer-motion)
document.body.style.cssText  // "will-change: transform;"
// After cssText +=:
document.body.style.cssText  // "will-change: transform; position: fixed; top: -100px; ..."
// After unlockScroll (clears individual props only):
document.body.style.cssText  // "will-change: transform;" ← framer property survives ✓
// BUT if browser re-serialized differently, individual props may not clear correctly
```

Additionally: `Architecture Strategist` flags `cssText +=` can produce
**duplicate declarations** if `overflow-y` was already set.

## Proposed Solutions

### Option 1: Replace `cssText +=` with four individual property assignments (Recommended)

**Approach:** Match the implementation block to the research block already in
the plan.

```ts
export function lockScroll(): void {
  if (lockCount++ > 0) return;
  savedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflowY = 'scroll';
}
```

This is symmetric with `unlockScroll` which already clears individual
properties.

**Pros:** Safe, symmetric, no side effects on other body styles **Cons:** None

**Effort:** 5 minutes  
**Risk:** None

## Recommended Action

Replace the `cssText +=` line in the `lockScroll` implementation with four
individual `document.body.style.X =` assignments. The research section of the
plan already has this correct — the implementation block just needs to match it.

## Technical Details

**Affected files:**

- `shared/lib/scroll-lock.ts` (NEW file, line ~8 in the lockScroll function)

**Also add floor guard per Architecture Strategist finding (can be in same
commit):**

```ts
export function unlockScroll(): void {
  if (lockCount <= 0) return; // prevent counter drift from unmatched calls
  if (--lockCount > 0) return;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflowY = '';
  window.scrollTo(0, savedScrollY);
}
```

## Acceptance Criteria

- [ ] `lockScroll` uses four individual `document.body.style.X =` assignments,
      not `cssText +=`
- [ ] `unlockScroll` has `if (lockCount <= 0) return;` guard at the top
- [ ] `unlockScroll` is symmetric with `lockScroll` (same four properties)
- [ ] Any pre-existing `document.body.style` properties are unaffected by a
      lock/unlock cycle

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**

- Kieran TypeScript reviewer flagged as CRITICAL
- Architecture Strategist flagged as must-fix
- Fix is trivial: swap `cssText +=` for four individual assignments
