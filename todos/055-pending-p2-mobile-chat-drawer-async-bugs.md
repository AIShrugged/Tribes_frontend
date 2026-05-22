---
status: pending
priority: p2
issue_id: "055"
tags: [mobile-chat, race-conditions, async, typescript, type-safety]
dependencies: []
---

# Fix Three Async/Type-Safety Bugs in MobileChatDrawer and Layout

## Problem Statement

Three related async correctness issues in the plan: type-unsafe `.catch` fallback in layout fetch, stacked Escape key handlers across overlapping modals, and focus restoration timing that fires before the exit animation completes.

## Findings

**Bug 1: `.catch(() => ({ data: [] }))` is not type-safe** (Kieran TS HIGH #7; Performance Oracle; Julik races reviewer)

`getChats` returns `Promise<{ data: Chat[]; totalCount: number; hasMore: boolean }>`. The `.catch` returns `{ data: never[] }` — an incomplete shape. Under TypeScript strict mode this is a type error since the catch handler's return type must be assignable to the full result type. Additionally the missing `totalCount: 0, hasMore: false` means any code destructuring `totalCount` from the settled value gets `undefined`.

**Fix:** Follow the existing `DashboardChatLoader` pattern — use `try/catch` at block level:
```ts
let chatList: Chat[] = [];
let totalCount = 0;
try {
  const result = await getChats(0, INITIAL_LIMIT);
  chatList = result.data;
  totalCount = result.totalCount;
} catch { /* silently fail — chat sidebar is non-critical */ }
```

**Bug 2: Stacked Escape key handlers** (Julik races reviewer, HIGH priority)

`MobileChatDrawer` will add its own `keydown` listener for Escape. Other overlays (ModalRoot, MobileSidebar) also listen for Escape via `document.addEventListener('keydown', ...)`. When multiple overlays are open, pressing Escape fires all handlers simultaneously — the topmost overlay AND any underneath it close at the same time.

The plan has no mention of an escape-stack or handler priority mechanism. `ModalRoot` already has this problem and it will compound once the mobile drawer is added.

**Fix:** Extract an `escape-stack.ts` singleton to `shared/lib/`:
```ts
// shared/lib/escape-stack.ts
const stack: Array<() => void> = [];
export function pushEscapeHandler(handler: () => void): () => void {
  stack.push(handler);
  return () => { const i = stack.indexOf(handler); if (i !== -1) stack.splice(i, 1); };
}
// One global listener:
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length > 0) stack[stack.length - 1]();
  });
}
```
`MobileChatDrawer` and `ModalRoot` both call `pushEscapeHandler(handleClose)` on mount and use the returned cleanup to unregister on unmount.

**Bug 3: Focus restoration timing — fires mid-exit-animation** (Julik races reviewer)

`handleClose` calls `fabRef.current?.focus()` immediately on close. But the exit animation runs for ~200ms after `isOpen` is set to `false`. Focus jumps to the FAB while the sheet is still visible/animating — creating a visual disconnect where the focused element is outside the visible overlay.

**Fix:** Move focus restoration to `onAnimationComplete` on the sheet's `motion.div`:
```tsx
<motion.div
  // ...exit animation props
  onAnimationComplete={(definition) => {
    // 'definition' is the variant name or the target passed to animate
    // Only restore focus when the exit animation completes
    if (!isOpen) fabRef.current?.focus();
  }}
>
```

Alternatively, use `AnimatePresence`'s `onExitComplete` callback which fires after all exiting children finish.

**Source:** Kieran TS HIGH #7 (catch type), Julik races reviewer (HIGH: Escape stack, MEDIUM: focus timing), Performance Oracle (catch shape).

## Proposed Solutions

### Option 1: Fix all three independently

- `.catch` → try/catch block (15 min)
- Escape stack → new `shared/lib/escape-stack.ts` + wire into `MobileChatDrawer` and `ModalRoot` (1–2 hours)
- Focus timing → move to `onAnimationComplete` (15 min)

**Effort:** 2–3 hours total  
**Risk:** Low for catch and focus; Medium for escape-stack (touches `ModalRoot`)

---

### Option 2: Fix catch + focus timing now, defer escape-stack to follow-up

The escape-stack touches `ModalRoot` (existing working code) and adds a new shared module. Scope it separately to reduce risk.

**Effort:** 30 min  
**Risk:** Low

## Recommended Action

Fix the `.catch` type issue and focus timing in the same commit as `MobileChatDrawer`. Scope the `escape-stack.ts` as a separate follow-up that touches `ModalRoot` after the mobile chat feature ships.

## Technical Details

**Affected files:**
- `app/dashboard/layout.tsx` (or `MobileChatDrawerLoader.tsx`) — fix `.catch` shape
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — focus on `onAnimationComplete`, escape handler
- `shared/lib/escape-stack.ts` — NEW (if escape-stack is in scope)
- `shared/ui/modal/modal-root.tsx` — update to use `pushEscapeHandler` (if escape-stack is in scope)

## Acceptance Criteria

- [ ] `.catch` fallback returns `{ data: [], totalCount: 0, hasMore: false }` or uses try/catch
- [ ] TypeScript compiles the layout/loader file without error in strict mode
- [ ] Focus returns to FAB only AFTER the drawer exit animation completes (not mid-animation)
- [ ] (If escape-stack in scope) Pressing Escape with both drawer and modal open closes only the topmost overlay

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Julik races reviewer flagged stacked Escape handlers (HIGH) and focus timing
- Kieran TS and Performance Oracle flagged `.catch` type issue independently
- Grouped as one todo since they are all async-correctness issues in related code
