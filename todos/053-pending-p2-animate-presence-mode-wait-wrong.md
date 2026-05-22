---
status: pending
priority: p2
issue_id: "053"
tags: [mobile-chat, animation, framer-motion, bug]
dependencies: []
---

# Remove `mode="wait"` from AnimatePresence in MobileChatDrawer

## Problem Statement

The plan's `MobileChatDrawer` uses `<AnimatePresence mode="wait">` for the backdrop + sheet siblings. `mode="wait"` means the second child waits for the first to finish exiting before it starts entering — the opposite of the intended behavior where backdrop and sheet animate in/out simultaneously.

## Findings

- Plan line 326: `<AnimatePresence mode="wait">`
- `mode="wait"` is designed for single-child page transitions (one page exits, then the other enters)
- With two siblings (backdrop + sheet) and `mode="wait"`: when `isOpen` → `true`, the sheet would not start entering until the backdrop finishes "exiting" (it's not exiting, so behavior is undefined/wrong)
- On close, backdrop would disappear, THEN sheet would animate out — visually broken
- The plan's own research section (line 605) shows the correct pattern: no `mode` prop at all (defaults to `"sync"`)
- Flagged by: Kieran TS reviewer (HIGH #5), Code Simplicity reviewer, Performance Oracle

**Correct behavior:** backdrop and sheet animate simultaneously both entering and exiting.

## Proposed Solutions

### Option 1: Remove `mode="wait"` (Recommended)

**Approach:** Delete `mode="wait"` from the `<AnimatePresence>` element. The default `mode` is `"sync"` which animates all children concurrently — exactly what we want.

```tsx
// Before (wrong):
<AnimatePresence mode="wait">

// After (correct):
<AnimatePresence>
```

**Pros:** Zero effort, correct behavior, consistent with plan's own research section
**Cons:** None

**Effort:** 1 minute  
**Risk:** None

## Recommended Action

Delete `mode="wait"` from `<AnimatePresence>` in `MobileChatDrawer`. No other changes needed.

## Technical Details

**Affected files:**
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — one line change

## Acceptance Criteria

- [ ] `<AnimatePresence>` has no `mode` prop (or `mode="sync"` explicitly)
- [ ] Opening the drawer shows backdrop and sheet animating in simultaneously
- [ ] Closing the drawer shows backdrop and sheet animating out simultaneously

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Flagged independently by Kieran TS (HIGH), Simplicity reviewer, Performance Oracle
- Fix is trivial one-word deletion
