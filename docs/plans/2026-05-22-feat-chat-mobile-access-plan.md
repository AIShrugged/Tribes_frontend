---
title: "feat: Mobile access to Dashboard Chat panel"
type: feat
status: active
date: 2026-05-22
---

# feat: Mobile Access to Dashboard Chat Panel

## Enhancement Summary

**Deepened on:** 2026-05-22
**Research agents used:** best-practices-researcher, framework-docs-researcher, kieran-typescript-reviewer, performance-oracle, architecture-strategist, security-sentinel, julik-frontend-races-reviewer, code-simplicity-reviewer, pattern-recognition-specialist, feasibility-reviewer, scope-guardian-reviewer, product-lens-reviewer

### Key Improvements Over Original Plan

1. **Critical: Fetch data once, not twice** — `httpClient` uses `cache: 'no-store'`, so two `DashboardChatLoader` instances would fire 4–6 redundant API requests on every page load. The plan now fetches chat data in the layout once and passes it as props to both desktop column and mobile drawer.
2. **Critical: Do not persist `isMobileOpen` in Zustand** — persisted `true` would reopen the drawer on every page reload. Use `useState` local to the component instead (zero Zustand store changes needed).
3. **Critical: `AnimatePresence` must be inside `createPortal`** — not wrapping it — so the portal stays mounted and exit animations run correctly.
4. **High: iOS Safari scroll lock** — `overflow: hidden` on body doesn't prevent momentum scroll on iOS. A refcounted, position-fixed approach is required.
5. **High: Focus restoration on close** — after closing the drawer, focus must return to the FAB (WCAG 2.4.3).
6. **High: `inert` attribute on background content** — `aria-modal` alone is insufficient for most screen readers; `inert` on sibling elements provides correct keyboard isolation.
7. **Medium: Centralize `HIDDEN_ON_PATHS` constant** — extracted to the widget's model folder to prevent drift between the two consumers.
8. **Medium: Extract `useIsMounted` hook** — third copy of the `useSyncExternalStore` mount-detection pattern; should live in `shared/lib/`.
9. **Medium: `AnimatePresence mode="wait"` + explicit `key`** — prevents two stacked drawer instances during rapid open/close.
10. **Medium: FAB needs iOS safe-area bottom inset** — `bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` for notched phones.
11. **Architecture: `HIDDEN_ON_PATHS` path guard fix** — `startsWith('/dashboard/chat')` has a false-positive risk; use `=== path || startsWith(path + '/')`.

### New Considerations Discovered

- `xl:hidden` in Tailwind v4 may not win over `flex`/`inline-flex` — verify cascade ordering works correctly
- Z-index collision risk: proposed drawer at `z-50` collides with `ModalRoot` and `MobileSidebar` — use `z-[60]`
- `AnimatePresence` exit animations do **not** work if the portal element itself is conditionally rendered; the portal must always be mounted
- `dvh` units change as iOS toolbar animates, causing sheet resize mid-interaction — use `max-height: calc(100dvh - ...)` rather than `height`
- Virtual keyboard (`visualViewport`) reduces visible area but does not update `dvh` — chat input needs `visualViewport` listener
- Breakpoint gap: `MobileSidebar` hides at `lg` (1024px), chat column appears at `xl` (1280px) — FAB is the only affordance between 1024–1280px
- Scroll lock race condition already exists in `ModalRoot` — this plan is the right time to fix it with a shared refcounted utility

---

## Overview

`DashboardChatColumn` is the persistent right-side chat panel in `app/dashboard/layout.tsx`. It is **only rendered on `xl` screens** (`hidden xl:flex`). On screens smaller than 1280 px — phones, tablets, and most laptops — the chat is completely inaccessible from every dashboard page except `/dashboard/chat` itself.

This plan defines an approach that gives mobile/tablet users a way to open the chat without duplicating the existing `/dashboard/chat` route and without violating FSD boundaries or existing layout conventions.

---

## Problem Statement

```
widgets/dashboard-chat/ui/DashboardChatColumn.tsx:32
  className={`hidden xl:flex ...`}
```

Users below the `xl` (1280 px) breakpoint have no affordance to reach the chat panel. The full `/dashboard/chat` page exists, but:

1. It requires a full navigation away from the current page — breaking context.
2. The mobile sidebar already hides below `lg` (1024 px), so mobile UX is already fragmented.
3. The chat is a core feature used during browsing (e.g., while reading analytics or meeting details).

**Note on breakpoint gap (1024–1280px):** Between `lg` and `xl`, the mobile sidebar trigger disappears but the desktop chat column is not yet visible. The FAB from this feature is the only chat affordance in that range.

---

## Proposed Solution

### Approach: Bottom-Sheet Drawer triggered by a FAB

A **Floating Action Button (FAB)** fixed to the bottom-right corner of the viewport triggers a **bottom-sheet drawer** that slides up from the bottom edge. This is the industry-standard mobile chat access pattern (Intercom, Slack, Linear).

**Why this is the best approach vs. alternatives:**

| Option | Pros | Cons |
|---|---|---|
| **FAB + Bottom Sheet (chosen)** | Minimal layout change; matches MobileSidebar portal pattern; no route change; full chat access; accessible; one-finger reach zone | Needs a new `MobileChatDrawer` component |
| Redirect link to `/dashboard/chat` | Zero dev cost | Breaks context, full page reload; sub-par UX |
| Header icon that expands panel on mobile | Compact trigger | Pushes layout down on small screens; chat below fold |
| Tab in mobile bottom nav | Coherent if app had a bottom nav | Major architecture change; out of scope |
| Inline collapsible in `main` content area | No overlay | Compresses content; not expected UX pattern |

The FAB + drawer approach:
- **Reuses `DashboardChatPanel`** — no logic duplication; data fetched once in layout and passed as props.
- **Follows the MobileSidebar portal pattern** already in `widgets/layout/ui/mobile-sidebar.tsx` (`createPortal` to `document.body` + `useSyncExternalStore` for SSR safety).
- **Follows the ModalRoot animation pattern** (framer-motion `AnimatePresence` inside the portal).
- **No routing change needed** — chat content is loaded in-place.
- **Hides on `/dashboard/chat`** — same `HIDDEN_ON_PATHS` guard, now centralized.

### Product Decisions (Record for Future Reference)

- **Drawer landing state**: opens showing the last active chat (same as `DashboardChatPanel` default behavior — first chat from `getChats()`).
- **Hide on `/dashboard/chat`**: FAB and drawer hidden on `/dashboard/chat/**` because the full-page chat experience is already available there. Future scope: could the FAB serve as a "new chat" shortcut even on that page — deferred.
- **No unread badge on FAB**: deferred to a follow-up feature.
- **FAB icon**: `MessageSquare` from lucide-react — same as the empty-state icon in `DashboardChatPanel`.

---

## Technical Approach

### Architecture

```
widgets/dashboard-chat/
  model/
    dashboard-chat-column-store.ts   ← NO CHANGES (isMobileOpen not added)
    chat-column-config.ts            ← NEW: shared HIDDEN_ON_PATHS + path guard helper
  ui/
    DashboardChatColumn.tsx          ← minor: import HIDDEN_ON_PATHS from model
    DashboardChatLoader.tsx          ← NO CHANGES (not used by mobile drawer)
    DashboardChatPanel.tsx           ← NO CHANGES
    MobileChatDrawer.tsx             ← NEW: FAB + bottom sheet, xl:hidden
  index.ts                           ← add MobileChatDrawer export

shared/lib/
  use-is-mounted.ts                  ← NEW: extracted useSyncExternalStore pattern
  scroll-lock.ts                     ← NEW: refcounted scroll lock (also fixes ModalRoot)
```

`app/dashboard/layout.tsx` — fetch chat data once, pass as props to both `DashboardChatPanel` (desktop) and `MobileChatDrawer`.

### Critical Architecture Change: Single Data Fetch

`httpClient` uses `cache: 'no-store'` on every request. Two `DashboardChatLoader` instances in the same layout render would fire 4–6 redundant API calls on every page load, regardless of screen size or whether the drawer is ever opened.

**The fix:** hoist data fetching out of `DashboardChatLoader` into the layout Server Component. Pass fetched data as props to `DashboardChatPanel` directly.

```tsx
// app/dashboard/layout.tsx (Server Component)
// Fetch once — shared between desktop column and mobile drawer
const { data: chats } = await getChats(0, 20);
const firstChat = chats[0] ?? null;
let initialMessages: Message[] = [];
let totalMessagesCount = 0;
let startOffset = 0;

if (firstChat) {
  // ... same message fetching logic as DashboardChatLoader ...
}

// Desktop column receives pre-fetched data
<DashboardChatColumn>
  <DashboardChatPanel
    initialChat={firstChat}
    initialMessages={initialMessages}
    totalMessagesCount={totalMessagesCount}
    startOffset={startOffset}
  />
</DashboardChatColumn>

// Mobile drawer also receives pre-fetched data — no second fetch
<MobileChatDrawer
  initialChat={firstChat}
  initialMessages={initialMessages}
  totalMessagesCount={totalMessagesCount}
  startOffset={startOffset}
/>
```

> **Implication:** `DashboardChatLoader` effectively becomes unused by the layout directly — it is now superseded by the layout-level fetch. It may still be useful for direct usage in the `/dashboard/chat` page — do not delete it.

### Implementation Phases

#### Phase 0: Shared Utilities (Prerequisites)

**`shared/lib/use-is-mounted.ts`** — extract the `useSyncExternalStore` mount-detection pattern (currently duplicated in `MobileSidebar` and `ModalRoot`, will be a third copy without this extraction):

```ts
// shared/lib/use-is-mounted.ts
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

export function useIsMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
```

**`shared/lib/scroll-lock.ts`** — refcounted scroll lock with iOS position-fixed technique. Also fixes the existing race condition in `ModalRoot` (two overlapping modals unlocking scroll on first close):

```ts
// shared/lib/scroll-lock.ts
let lockCount = 0;
let savedScrollY = 0;

export function lockScroll(): void {
  if (lockCount++ > 0) return;
  savedScrollY = window.scrollY;
  document.body.style.cssText += `
    position: fixed;
    top: -${savedScrollY}px;
    width: 100%;
    overflow-y: scroll;
  `;
}

export function unlockScroll(): void {
  if (--lockCount > 0) return;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflowY = '';
  window.scrollTo(0, savedScrollY);
}
```

**`widgets/dashboard-chat/model/chat-column-config.ts`** — centralized path guard:

```ts
// widgets/dashboard-chat/model/chat-column-config.ts
export const CHAT_COLUMN_HIDDEN_PATHS = ['/dashboard/chat'] as const;

export function isChatColumnHidden(pathname: string): boolean {
  return CHAT_COLUMN_HIDDEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
```

Update `DashboardChatColumn.tsx` to import from this file instead of its inline constant.

#### Phase 1: MobileChatDrawer Component

New file: `widgets/dashboard-chat/ui/MobileChatDrawer.tsx`

**Full structure:**

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DashboardChatPanel } from '@/widgets/dashboard-chat/ui/DashboardChatPanel';
import { isChatColumnHidden } from '@/widgets/dashboard-chat/model/chat-column-config';
import { useIsMounted } from '@/shared/lib/use-is-mounted';
import { lockScroll, unlockScroll } from '@/shared/lib/scroll-lock';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import type { Chat, Message } from '@/features/chat/model/types';

interface MobileChatDrawerProps {
  initialChat: Chat | null;
  initialMessages: Message[];
  totalMessagesCount: number;
  startOffset: number;
}

export function MobileChatDrawer({
  initialChat,
  initialMessages,
  totalMessagesCount,
  startOffset,
}: MobileChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isMounted = useIsMounted();
  const fabRef = useRef<HTMLButtonElement>(null);

  const isHidden = isChatColumnHidden(pathname);

  // Close on route change (prevents scroll lock surviving navigation)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Scroll lock + Escape key
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    // inert: isolate background content from keyboard/screen reader
    const siblings = [...document.body.children].filter(
      (el) => el !== portalContainerRef.current
    );
    siblings.forEach((el) => el.setAttribute('inert', ''));

    return () => {
      unlockScroll();
      document.removeEventListener('keydown', handleKeyDown);
      siblings.forEach((el) => el.removeAttribute('inert'));
    };
  }, [isOpen]);

  // Restore focus to FAB on close
  const handleClose = () => {
    setIsOpen(false);
    fabRef.current?.focus();
  };

  if (isHidden) return null;

  // FAB renders inline (not in portal — it's not inside the header's backdrop-filter)
  return (
    <>
      {/* FAB — inline, fixed, xl:hidden */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`
          fixed z-[30] xl:hidden
          bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6
          w-14 h-14 rounded-full
          bg-primary text-primary-foreground shadow-lg
          flex items-center justify-center
          hover:opacity-90 active:scale-95 transition-transform
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        `}
      >
        <MessageSquare className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Portal — always mounted for AnimatePresence exit animations */}
      {isMounted && createPortal(
        <AnimatePresence mode="wait">
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-chat-backdrop"
                className="fixed inset-0 z-[50] bg-black/50 xl:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleClose}
                aria-hidden="true"
              />

              {/* Sheet */}
              <motion.div
                key="mobile-chat-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Chat"
                tabIndex={-1}
                className={`
                  fixed bottom-0 inset-x-0 z-[60] xl:hidden
                  max-h-[calc(100dvh-env(safe-area-inset-top)-44px)]
                  h-[85dvh]
                  rounded-t-[var(--radius-card)]
                  bg-card border-t border-border
                  flex flex-col overflow-hidden
                `}
                initial={{ y: '100%' }}
                animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 40, mass: 0.8 } }}
                exit={{ y: '100%', transition: { type: 'tween', ease: 'easeIn', duration: 0.2 } }}
              >
                {/* Drag handle + header */}
                <div className="h-10 flex items-center justify-between px-4 border-b border-border flex-shrink-0 relative">
                  <div className="absolute left-1/2 top-2 -translate-x-1/2 w-8 h-1 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  <span className="text-sm font-medium">Chat</span>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close chat"
                    className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Chat panel — data already fetched, no Suspense needed */}
                <DashboardChatPanel
                  initialChat={initialChat}
                  initialMessages={initialMessages}
                  totalMessagesCount={totalMessagesCount}
                  startOffset={startOffset}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
```

**Note on `portalContainerRef`:** The `inert` implementation above references `portalContainerRef` — since `createPortal` renders directly into `document.body`, find the portal child by data attribute instead:

```tsx
// Add data attribute to the sheet wrapper div:
data-mobile-chat-portal=""

// In the inert effect:
const siblings = [...document.body.children].filter(
  (el) => !el.hasAttribute('data-mobile-chat-portal')
);
```

#### Phase 2: Layout Integration

In `app/dashboard/layout.tsx` (Server Component), hoist the chat data fetch and pass props to both components:

```tsx
// Add imports
import { getChats } from '@/features/chat/api/chats';
import { getMessages } from '@/features/chat/api/messages';
import { MobileChatDrawer } from '@/widgets/dashboard-chat';
import type { Message } from '@/features/chat/model/types';

// In the async Layout function, add data fetching:
const INITIAL_MESSAGES_LIMIT = 20;
const { data: chatList } = await getChats(0, 20).catch(() => ({ data: [] }));
const firstChat = chatList[0] ?? null;
let chatInitialMessages: Message[] = [];
let chatTotalCount = 0;
let chatStartOffset = 0;

if (firstChat) {
  try {
    const { data: oldest, totalCount: msgTotal } = await getMessages(firstChat.id, 0, INITIAL_MESSAGES_LIMIT);
    chatTotalCount = msgTotal;
    if (msgTotal > INITIAL_MESSAGES_LIMIT) {
      chatStartOffset = msgTotal - INITIAL_MESSAGES_LIMIT;
      const { data: newest } = await getMessages(firstChat.id, chatStartOffset, INITIAL_MESSAGES_LIMIT);
      chatInitialMessages = newest;
    } else {
      chatInitialMessages = oldest;
    }
  } catch { /* silently fail — both panels show empty state */ }
}

// In JSX — replace DashboardChatLoader with DashboardChatPanel:
<DashboardChatColumn>
  <DashboardChatPanel
    initialChat={firstChat}
    initialMessages={chatInitialMessages}
    totalMessagesCount={chatTotalCount}
    startOffset={chatStartOffset}
  />
</DashboardChatColumn>

<MobileChatDrawer
  initialChat={firstChat}
  initialMessages={chatInitialMessages}
  totalMessagesCount={chatTotalCount}
  startOffset={chatStartOffset}
/>
```

> **Note on `DashboardChatLoader`:** This file can remain for use by the `/dashboard/chat` page or other future consumers. Do not delete it.

#### Phase 3: Update Exports & Index

`widgets/dashboard-chat/index.ts`:
```ts
export { DashboardChatLoader } from '@/widgets/dashboard-chat/ui/DashboardChatLoader';
export { DashboardChatColumn } from '@/widgets/dashboard-chat/ui/DashboardChatColumn';
export { DashboardChatPanel } from '@/widgets/dashboard-chat/ui/DashboardChatPanel';
export { MobileChatDrawer } from '@/widgets/dashboard-chat/ui/MobileChatDrawer';
export { useDashboardChatColumnStore } from '@/widgets/dashboard-chat/model/dashboard-chat-column-store';
```

#### Phase 4: Update `ModalRoot` to Use `scroll-lock.ts`

Replace the inline scroll lock in `shared/ui/modal/modal-root.tsx` with the shared utility:

```tsx
// Replace lines 60-62 and the cleanup with:
useEffect(() => {
  if (!open) return;
  lockScroll();
  return () => unlockScroll();
}, [open]);
```

This is a risk-free refactor that also fixes the race condition where two overlapping modals could unlock scroll prematurely.

---

## Acceptance Criteria

### Functional Requirements

- [ ] A FAB (MessageSquare icon, 56×56 px, bottom-right with safe-area offset) is visible on all dashboard pages below `xl` breakpoint (< 1280 px), except `/dashboard/chat` and `/dashboard/chat/*`
- [ ] Tapping the FAB opens a bottom-sheet drawer showing the full chat panel
- [ ] The drawer occupies `h-[85dvh]` with `max-height` cap for very tall screens
- [ ] The drawer slides up from the bottom on open (spring, stiffness 400); slides down on close (tween, 200ms)
- [ ] A close button (X icon) and a backdrop click both close the drawer and return focus to the FAB
- [ ] Escape key closes the drawer
- [ ] Body scroll is locked while drawer is open (iOS-compatible position-fixed technique)
- [ ] Background content has `inert` applied while drawer is open
- [ ] The FAB is invisible on `xl`+ screens (where desktop panel is shown)
- [ ] No regression on desktop — `DashboardChatColumn` unchanged in behavior
- [ ] No FAB or drawer visible on `/dashboard/chat` routes
- [ ] Drawer closes automatically on route navigation (no scroll-lock leak)

### Non-Functional Requirements

- [ ] Single data fetch — chat data fetched once in layout, shared by both desktop and mobile
- [ ] No Zustand store changes — `isMobileOpen` is local `useState` inside `MobileChatDrawer`
- [ ] `useIsMounted()` hook used for SSR-safe portal rendering (no hydration mismatch)
- [ ] `createPortal` to `document.body` — portal always mounted; `AnimatePresence` inside portal
- [ ] Accessible: `role="dialog"`, `aria-modal="true"`, `aria-haspopup="dialog"` on FAB, `aria-label` on both FAB and close button, `tabIndex={-1}` on sheet for programmatic focus
- [ ] `AnimatePresence mode="wait"` + explicit `key` props on both portal children
- [ ] No FSD violations — widget imports only from `features/chat` and `shared/`
- [ ] `HIDDEN_ON_PATHS` centralized in `chat-column-config.ts` — not duplicated
- [ ] Path guard uses `=== p || startsWith(p + '/')` to avoid false positives

### Quality Gates

- [ ] `npm run lint` passes (TypeScript strict, no `any`)
- [ ] `npm run build` passes
- [ ] Unit tests for `MobileChatDrawer` (open/close, hidden on chat route, focus restored to FAB on close, route-change closes drawer)
- [ ] Unit tests for `chat-column-config.ts` (`isChatColumnHidden` with exact match and sub-path match)
- [ ] Unit tests for `scroll-lock.ts` (refcount logic, nested lock/unlock)
- [ ] `ModalRoot` regression: existing modal tests still pass after scroll-lock refactor

---

## Alternative Approaches Considered

### 1. Redirect FAB to `/dashboard/chat`

**Rejected:** Full page navigation interrupts context. Users on the issues or meetings page lose their place.

### 2. Header icon expanding chat inline on mobile

**Rejected:** Header is already crowded. Pushes layout vertically.

### 3. Bottom navigation bar (persistent)

**Rejected:** Major architecture change, out of scope.

### 4. Full-screen overlay instead of 85dvh sheet

**Acceptable alternative.** 85dvh chosen because it shows the backdrop (signals "panel, not page") and allows easy dismissal. Full-screen can be used if 85dvh feels cramped.

### 5. Swipe-to-dismiss gesture

**Deferred.** Framer Motion's `drag="y"` with `dragConstraints={{ top: 0 }}` makes this ~30 lines with the physics already set up. Specifically: use `dragListener={false}` on the sheet + `useDragControls` on the handle to avoid scroll conflict inside the panel. Not in scope for V1 but the animation setup is fully compatible.

---

## Files to Create / Modify

| Action | File |
|---|---|
| Create | `shared/lib/use-is-mounted.ts` |
| Create | `shared/lib/scroll-lock.ts` |
| Create | `widgets/dashboard-chat/model/chat-column-config.ts` |
| Create | `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` |
| Create | `widgets/dashboard-chat/ui/__tests__/MobileChatDrawer.test.tsx` |
| Modify | `widgets/dashboard-chat/ui/DashboardChatColumn.tsx` (import from config) |
| Modify | `widgets/dashboard-chat/index.ts` (add exports) |
| Modify | `app/dashboard/layout.tsx` (hoist fetch + add `<MobileChatDrawer>`) |
| Modify | `shared/ui/modal/modal-root.tsx` (use `scroll-lock.ts`) |

---

## Dependencies & Risks

| Item | Status | Notes |
|---|---|---|
| `framer-motion` | ✅ Already installed (v12) | Use `framer-motion` import (not `motion/react`) to match `ModalRoot` |
| `createPortal` | ✅ Pattern exists in `MobileSidebar` | Portal always mounted; `AnimatePresence` inside |
| `inert` attribute | ✅ Baseline available | Safari 15.5+, Chrome 102+, Firefox 112+ |
| `dvh` unit | ✅ Supported | Use `max-height` not `height` to avoid resize during toolbar animation |
| `env(safe-area-inset-bottom)` | ✅ All modern iOS/Android | Required for notched phones |
| `httpClient` `cache: 'no-store'` | ⚠️ Confirmed (line 37) | **No deduplication** — single fetch in layout is mandatory |
| Tailwind v4 `xl:hidden` + `flex` | ⚠️ Ordering caveat | In v4, `xl:hidden` may not override `flex`; use `xl:![display:none]` if needed |
| Virtual keyboard + `dvh` | ⚠️ Not addressed in V1 | `visualViewport.resize` listener needed if chat input is primary use case |
| Z-index: drawer `z-[60]` | ✅ Above existing overlays | `ModalRoot` and `MobileSidebar` both at `z-50` |

---

## Research Insights by Section

### Bottom Sheet UX

**Best Practices:**
- FAB standard size is 56×56px (not 48), per Material Design 3 and iOS HIG — `w-14 h-14`
- Leave `env(safe-area-inset-top)` + 44px gap at top — use `max-height: calc(100dvh - env(safe-area-inset-top) - 44px)`
- Drag handle: 32–36px wide × 4px tall (`w-8 h-1`), centered, `bg-muted-foreground/30`
- Backdrop tap, Escape key, and close button are all required dismiss signals
- `overscroll-behavior: contain` on the inner scrollable div prevents scroll propagation through the sheet

**Swipe-to-dismiss (deferred V1):**
- Use `drag="y"` + `dragConstraints={{ top: 0 }}` + `dragListener={false}` (handle-only drag)
- Dismiss threshold: `offset.y > height * 0.25` OR `velocity.y > 400px/s`
- Must use `useDragControls` to avoid conflict with chat scroll

### AnimatePresence + Portal

**Critical pattern (confirmed via framer-motion GitHub issues #1373, #2692):**
```tsx
// ❌ WRONG — portal conditionally rendered, AnimatePresence loses its child before exit
{isOpen && createPortal(<motion.div exit={{...}}>...</motion.div>, document.body)}

// ✅ CORRECT — portal always mounted, AnimatePresence controls the inner element
{isMounted && createPortal(
  <AnimatePresence mode="wait">
    {isOpen && <motion.div key="sheet" exit={{...}}>...</motion.div>}
  </AnimatePresence>,
  document.body
)}
```

**Spring vs Tween:**
- **Enter**: spring (`stiffness: 400, damping: 40, mass: 0.8`) — physical, responds to velocity
- **Exit**: tween (`ease: 'easeIn', duration: 0.2`) — fast, crisp, never bouncy on exit

### iOS Safari Scroll Lock

**`overflow: hidden` on `body` is broken on iOS Safari (momentum scroll continues).**

The correct pattern (position-fixed technique):
```ts
// Lock
savedScrollY = window.scrollY;
document.body.style.position = 'fixed';
document.body.style.top = `-${savedScrollY}px`;
document.body.style.width = '100%';
document.body.style.overflowY = 'scroll'; // prevent layout shift

// Unlock
document.body.style.position = '';
document.body.style.top = '';
document.body.style.width = '';
document.body.style.overflowY = '';
window.scrollTo(0, savedScrollY);
```

With the refcounted wrapper in `shared/lib/scroll-lock.ts`, nested overlays (modal inside drawer) unlock correctly — only the last close actually restores the body.

### Focus Management (WCAG 2.1 AA)

- `tabIndex={-1}` on dialog container → programmatically focusable
- Move focus to container on open: `sheetRef.current?.focus()`
- Return focus to FAB on close: `fabRef.current?.focus()`
- Apply `inert` to background: all body children except the portal element
- `inert` replaces need for manual Tab-cycling focus trap and is screen-reader-correct

### Zustand + Persistence

**Do not persist transient overlay state.** The existing store persists `isCollapsed` (a panel-layout preference). The mobile drawer's open/closed state is session-transient — `useState` is the right tool. Adding `isMobileOpen` to the persisted store would reopen the drawer on every page reload for users who had it open when they left.

### References

- [AnimatePresence — Motion React docs](https://motion.dev/docs/react-animate-presence)
- [framer-motion portal + AnimatePresence bug #2692](https://github.com/framer/motion/issues/2692)
- [iOS Safari scroll lock (position-fixed technique)](https://stripearmy.medium.com/i-fixed-a-decade-long-ios-safari-problem-0d85f76caec0)
- [useSyncExternalStore — avoiding hydration mismatches](https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store)
- [FAB accessibility — Material Design 3](https://m3.material.io/components/floating-action-button/accessibility)
- [The large, small, and dynamic viewport units — web.dev](https://web.dev/blog/viewport-units)
- [Building a FAB component — web.dev](https://web.dev/articles/building/a-fab-component)
- [Teleportation in React: Portals — Developer Way](https://www.developerway.com/posts/positioning-and-portals-in-react)
- [Zustand persist middleware — official docs](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)
- [Bottom Sheets: UX Guidelines — NN/g](https://www.nngroup.com/articles/bottom-sheet/)
