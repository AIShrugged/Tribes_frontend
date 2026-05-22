---
status: pending
priority: p2
issue_id: "054"
tags: [mobile-chat, accessibility, wcag, focus-management]
dependencies: []
---

# Add Focus-On-Open to MobileChatDrawer — WCAG 2.4.3 Violation

## Problem Statement

The plan's `MobileChatDrawer` correctly restores focus to the FAB on close, but has no mechanism to move focus INTO the dialog on open. WCAG 2.4.3 (Focus Order) requires that when a dialog opens, focus moves to the dialog or its first focusable child. The component code block has no `sheetRef`, no focus-on-open `useEffect`, and no `tabIndex={-1}` wired to an actual ref — despite the acceptance criteria listing `tabIndex={-1}` on the sheet.

## Findings

- Plan component code block: `handleClose` calls `fabRef.current?.focus()` (close path correct)
- Plan component code block: no `sheetRef` declared, no `useEffect(() => { if (isOpen) sheetRef.current?.focus() }, [isOpen])`
- Plan line 508 (acceptance criteria): lists `tabIndex={-1}` on sheet for programmatic focus — but never wired up
- Plan research section line 643: "Move focus to container on open: `sheetRef.current?.focus()`" — correctly identified but not in the code block
- `ModalRoot` (`shared/ui/modal/modal-root.tsx` lines 97–103) implements this correctly and is the pattern to follow
- **Source:** Kieran TypeScript reviewer, HIGH #6

## Proposed Solutions

### Option 1: Add `sheetRef` and focus-on-open `useEffect` (Recommended)

**Approach:** Declare a `sheetRef` on the sheet `motion.div` and add a `useEffect` that focuses it when `isOpen` becomes `true`.

```tsx
const sheetRef = useRef<HTMLDivElement>(null);

// Focus the sheet when it opens (WCAG 2.4.3)
useEffect(() => {
  if (isOpen) sheetRef.current?.focus();
}, [isOpen]);

// In JSX, on the sheet motion.div:
<motion.div
  ref={sheetRef}
  tabIndex={-1}
  role="dialog"
  aria-modal="true"
  aria-label="Chat"
  // ... other props
>
```

Note: use `onAnimationComplete` callback as an alternative if the focus should land after the enter animation completes (see todo 055 for focus timing detail).

**Pros:** WCAG 2.4.3 compliance; mirrors existing `ModalRoot` pattern; screen reader announces dialog on open
**Cons:** None

**Effort:** 15 minutes  
**Risk:** None

## Recommended Action

Add `sheetRef` + focus-on-open `useEffect` to `MobileChatDrawer`. Wire `ref={sheetRef}` to the sheet `motion.div`. Confirm `tabIndex={-1}` is on the same element.

## Technical Details

**Affected files:**
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx`

**Reference:** `shared/ui/modal/modal-root.tsx:97-103` — existing correct implementation

## Acceptance Criteria

- [ ] Sheet `motion.div` has `tabIndex={-1}` and `ref={sheetRef}`
- [ ] `useEffect(() => { if (isOpen) sheetRef.current?.focus() }, [isOpen])` is present
- [ ] VoiceOver / screen reader announces the dialog when FAB is tapped
- [ ] Focus is on the sheet (or first child) immediately after drawer opens

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Kieran TS flagged as HIGH (WCAG 2.4.3)
- Existing `ModalRoot` has the correct pattern to follow
