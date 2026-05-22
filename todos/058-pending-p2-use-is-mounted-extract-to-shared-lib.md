---
status: pending
priority: p2
issue_id: "058"
tags: [mobile-chat, shared, use-is-mounted, refactor, ssr]
dependencies: []
---

# Extract `useIsMounted` to `shared/lib/use-is-mounted.ts` — Fix Naming and Include All 4 Usages

## Problem Statement

The plan proposes extracting `useIsMounted` from `MobileSidebar` and `ModalRoot` into `shared/lib/use-is-mounted.ts`. But the plan misses one additional usage site (`shared/ui/popup/Popup.tsx`) and uses a non-standard variable name (`noop`) inconsistent with the naming convention established in the two existing implementations.

## Findings

- Architecture Strategist (finding #5): `shared/ui/popup/Popup.tsx:65` and `features/organization/ui/organization-dropdown.tsx:109` both have the same inline `useSyncExternalStore` pattern — these are the 4th and 5th copies, not 3 as the plan states
- Kieran TS (MEDIUM #10): The plan's hook uses `const noop = () => () => {}` but existing implementations in the codebase use `const noopUnsubscribe = () => {}; const noopSubscribe = () => noopUnsubscribe;` — follow the established naming
- The hook itself is correct; only naming and extraction scope need updating

**Current copies of the pattern (5 total, plan only mentions 3):**
1. `widgets/layout/ui/mobile-sidebar.tsx` — inline
2. `shared/ui/modal/modal-root.tsx` — inline  
3. `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — NEW (to be written)
4. `shared/ui/popup/Popup.tsx:65` — inline (plan misses this)
5. `features/organization/ui/organization-dropdown.tsx:109` — inline (plan misses this)

**Correct implementation for `shared/lib/use-is-mounted.ts`:**
```ts
import { useSyncExternalStore } from 'react';

const noopUnsubscribe = () => {};
const noopSubscribe = () => noopUnsubscribe;

export function useIsMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
```

## Proposed Solutions

### Option 1: Extract to shared/lib and migrate all 5 usages (Recommended)

**Approach:** Create `shared/lib/use-is-mounted.ts` with correct naming convention. Migrate all 5 existing/new usages in one commit.

**Pros:** Complete cleanup; no inline duplicates remain; consistent naming
**Cons:** Touches 4 existing files (low risk since it's a pure refactor)

**Effort:** 30 minutes  
**Risk:** None (pure refactor, behavior unchanged)

---

### Option 2: Create hook, migrate only new usages for now

**Approach:** Create hook, use it in `MobileChatDrawer`. Leave existing inline copies for a follow-up.

**Pros:** Smaller scope; still creates the shared hook
**Cons:** Leaves 4 inline copies in place; defeats the purpose of extraction

**Effort:** 10 minutes  
**Risk:** None

## Recommended Action

Option 1 — extract and migrate all 5 at once. It's a pure refactor and 30 minutes is worth eliminating 4 inline copies.

## Technical Details

**Affected files:**
- `shared/lib/use-is-mounted.ts` — NEW
- `widgets/layout/ui/mobile-sidebar.tsx` — replace inline with `useIsMounted()`
- `shared/ui/modal/modal-root.tsx` — replace inline with `useIsMounted()`
- `shared/ui/popup/Popup.tsx:65` — replace inline with `useIsMounted()`
- `features/organization/ui/organization-dropdown.tsx:109` — replace inline with `useIsMounted()`
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — import from shared, not inline

## Acceptance Criteria

- [ ] `shared/lib/use-is-mounted.ts` exists and exports `useIsMounted(): boolean`
- [ ] Hook uses `noopSubscribe`/`noopUnsubscribe` naming (not `noop`)
- [ ] All 5 usages (`mobile-sidebar`, `modal-root`, `MobileChatDrawer`, `Popup`, `organization-dropdown`) import from `@/shared/lib/use-is-mounted`
- [ ] No inline `useSyncExternalStore` for portal mounting remains in any file
- [ ] All existing tests pass (pure refactor)

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Architecture Strategist found 2 additional usage sites (Popup.tsx, organization-dropdown.tsx) not in plan
- Kieran TS flagged naming inconsistency
- Identified 5 total usages (plan claimed 3)
