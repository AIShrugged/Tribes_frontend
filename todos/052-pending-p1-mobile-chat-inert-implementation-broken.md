---
status: pending
priority: p1
issue_id: "052"
tags: [mobile-chat, accessibility, typescript, inert, portal]
dependencies: []
---

# Fix or Remove `inert` Block in MobileChatDrawer — Three Independent Bugs

## Problem Statement

The plan's `MobileChatDrawer` component contains an `inert` implementation with three independent bugs that would cause TypeScript compilation failures and broken accessibility behavior at runtime. The simplest V1 resolution is to remove the `inert` block entirely and defer to a follow-up; if kept, all three bugs must be fixed.

## Findings

**Bug 1: `portalContainerRef` is never declared** (Kieran TS, CRITICAL #2)

The component's `inert` effect uses `portalContainerRef.current` to exclude the portal from the `inert` sweep:
```ts
const siblings = [...document.body.children].filter(
  (el) => el !== portalContainerRef.current  // ← portalContainerRef doesn't exist
);
```
But there is no `const portalContainerRef = useRef<HTMLElement>(null)` in the shown component. The plan acknowledges this at line 392 and proposes using `data-mobile-chat-portal` as the fix, but presents it as a separate correction note rather than replacing the main code block. An implementer following the plan would get a TypeScript compile error.

**Bug 2: `data-mobile-chat-portal` filter finds nothing** (Kieran TS, CRITICAL #3; Architecture Strategist)

The corrected version filters `document.body.children` for elements that have `data-mobile-chat-portal`. But `createPortal(content, document.body)` renders `content` as **direct children of body** — there is no wrapper element. `document.body.children` will have the portal's backdrop and sheet divs as direct children, neither of which has `data-mobile-chat-portal`. The filter finds nothing to exclude, meaning `inert` would be applied to the portal content itself, breaking the dialog entirely.

Fix requires a stable container element:
```ts
const portalRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
  const el = document.createElement('div');
  el.setAttribute('data-mobile-chat-portal', '');
  document.body.appendChild(el);
  portalRef.current = el;
  return () => { document.body.removeChild(el); };
}, []);
// Then: createPortal(content, portalRef.current ?? document.body)
```

**Bug 3: `Element` type lacks `inert` property — needs `instanceof HTMLElement` guard** (Kieran TS, CRITICAL #4)

`document.body.children` returns `HTMLCollection<Element>`. `Element` does not have `.inert`; only `HTMLElement` does. The plan calls `.setAttribute('inert', '')` / `.removeAttribute('inert')` on `Element` values which works at runtime but bypasses the typed `inert: boolean` DOM property. Under the project's strict TypeScript bar, the typed approach is required:

```ts
const siblings = [...document.body.children]
  .filter((el): el is HTMLElement => el instanceof HTMLElement)
  .filter(/* exclusion logic */);
siblings.forEach((el) => { el.inert = true; });
// cleanup:
siblings.forEach((el) => { el.inert = false; });
```

**Additionally:** There is a single-frame race where `inert` is applied via `useEffect` (runs after paint), so there is one render cycle where the portal is rendered but `inert` is not yet applied. Screen readers could briefly see background content. The plan does not document this.

**Source:** Kieran TypeScript reviewer (CRITICAL #2, #3, #4), Architecture Strategist (additional finding), Code Simplicity reviewer (recommends remove for V1), Julik races reviewer (inert snapshot fragility).

## Proposed Solutions

### Option 1: Remove `inert` block for V1 — defer to a11y follow-up (Recommended for V1)

**Approach:** Remove the entire `inert` `useEffect` from `MobileChatDrawer`. The dialog already has `role="dialog"`, `aria-modal="true"`, and `aria-label`. The `aria-modal` attribute instructs screen readers to treat the modal as the only interactive content. Most modern screen readers (NVDA 2022+, JAWS 2023+, VoiceOver iOS 15+) respect `aria-modal` without requiring `inert`. The `inert` approach provides belt-and-suspenders but is not required for WCAG 2.1 AA compliance.

Defer `inert` to a dedicated a11y follow-up ticket with proper testing on NVDA/JAWS.

**Pros:** Ships clean code without compile errors; `aria-modal` handles core a11y requirement; avoids all three bugs
**Cons:** Screen readers that pre-date `aria-modal` support may not fully restrict background focus (edge case, <5% of users)

**Effort:** 30 min (just delete the `inert` effect block)  
**Risk:** Low

---

### Option 2: Fix all three bugs and keep `inert`

**Approach:** 
1. Create a stable `portalRef` container element in a `useEffect` and portal to it
2. Filter `document.body.children` excluding `portalRef.current` using `contains()`
3. Cast to `HTMLElement` via `instanceof` filter and use typed `.inert` property

**Pros:** Full `inert` isolation — best a11y for all screen reader versions
**Cons:** More complex, three bugs to fix simultaneously, single-frame race still exists

**Effort:** 2–3 hours  
**Risk:** Medium (easy to introduce new bugs during fix)

## Recommended Action

For V1: remove the `inert` block entirely (Option 1). Create a follow-up ticket to add proper `inert` implementation with NVDA/JAWS testing after the core mobile chat feature ships.

## Technical Details

**Affected files:**
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — remove `inert` `useEffect` and any `useRef` declarations created solely for it

**The dialog will still have:**
- `role="dialog"`
- `aria-modal="true"`
- `aria-label="Chat"`
- `tabIndex={-1}` with focus management (see todo 054 for focus-on-open)
- Escape key close handler

## Acceptance Criteria

**Option 1 (V1):**
- [ ] No `inert` `useEffect` in `MobileChatDrawer`
- [ ] No `portalContainerRef` or related refs declared
- [ ] Component compiles without TypeScript errors
- [ ] `role="dialog"` and `aria-modal="true"` are present on the sheet element

**Option 2 (full fix):**
- [ ] A stable `<div>` container is created via `useEffect` and used as portal target
- [ ] `inert` filter uses `instanceof HTMLElement` guard
- [ ] `inert` filter excludes portal container using `.contains()` check
- [ ] Component compiles without TypeScript errors
- [ ] NVDA + JAWS manual test confirms background content is inaccessible while drawer is open

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Kieran TS flagged 3 independent bugs (CRITICAL)
- Architecture Strategist confirmed `data-mobile-chat-portal` filter issue
- Code Simplicity reviewer and Julik races reviewer both recommend removing for V1
- Documented both resolution paths
