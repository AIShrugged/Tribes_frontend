---
status: pending
priority: p3
issue_id: '059'
tags: [mobile-chat, code-quality, typescript, z-index, constants]
dependencies: []
---

# Mobile Chat Drawer — Code Quality Nits (P3)

## Problem Statement

Several minor code quality issues in the plan's implementation blocks that don't
affect correctness but violate project conventions or create maintenance
hazards.

## Findings

**1. `INITIAL_MESSAGES_LIMIT` re-declared instead of imported** (Kieran TS
MEDIUM #12)

`DashboardChatLoader.tsx` already defines `const INITIAL_MESSAGES_LIMIT = 20`.
The plan re-declares it in `layout.tsx`/`MobileChatDrawerLoader.tsx`. When the
limit changes, two files need updating.

**Fix:** Export `INITIAL_MESSAGES_LIMIT` from `chat-column-config.ts` (or from
`DashboardChatLoader`) and import it in both files.

---

**2. FAB `z-[30]` is below MobileSidebar backdrop `z-40` — undocumented**
(Kieran TS MEDIUM #13)

`MobileSidebar`'s backdrop is at `z-40` (`mobile-sidebar.tsx:80`). The FAB is at
`z-[30]`. When the sidebar is open, it covers the FAB — meaning the FAB is not
tappable. This may be intentional (sidebar takes priority) but is completely
undocumented in the plan.

**Fix:** Add a comment to the FAB `className` or to the z-index decision in the
plan. If it's intentional, document it; if unintentional, raise FAB to `z-[45]`
(above sidebar backdrop `z-40`, below drawer `z-[60]`).

---

**3. Redundant `: boolean` return type on `isChatColumnHidden`** (Kieran TS
MEDIUM #11)

```ts
export function isChatColumnHidden(pathname: string): boolean { ... }
```

TypeScript infers `boolean` from `Array.prototype.some`. Per project convention,
explicit annotations are redundant when inference is clear.

**Fix:** Remove `: boolean`.

---

**4. Phase 2/3 implementation ordering dependency not documented** (Kieran TS
LOW #16)

`layout.tsx` in Phase 2 imports `DashboardChatPanel` by name, but
`DashboardChatPanel` is not exported from `widgets/dashboard-chat/index.ts`
until Phase 3. The plan must either:

- Note that Phase 3 must land before Phase 2, OR
- Implement both phases atomically in one commit

**Fix:** Add a dependency note to Phase 2 in the plan.

---

**5. `aria-haspopup="dialog"` has inconsistent screen reader support** (Kieran
TS LOW #17)

`aria-haspopup="dialog"` is in ARIA 1.1 spec but NVDA/JAWS support varies. More
universally supported: add `aria-controls="mobile-chat-sheet-id"` and an `id` on
the sheet element.

**Fix:** Add `id="mobile-chat-sheet"` to the sheet element and
`aria-controls="mobile-chat-sheet"` to the FAB button.

---

**6. `MobileSidebar` lacks scroll lock** (Architecture Strategist, additional
finding)

Once `scroll-lock.ts` is available as a shared utility, `MobileSidebar` is the
obvious next candidate to use it. Currently the sidebar has a backdrop but no
scroll lock. Out of scope for this plan but noted as a follow-up.

## Proposed Solutions

### Option 1: Fix items 1–5 as part of MobileChatDrawer implementation

All are small changes. Group them into the same PR as the feature.

**Effort:** 30 minutes total  
**Risk:** None

## Recommended Action

Fix items 1, 2 (with comment), 3, 4, and 5 in the MobileChatDrawer
implementation PR. Item 6 (MobileSidebar scroll lock) is a separate follow-up.

## Technical Details

**Affected files:**

- `widgets/dashboard-chat/model/chat-column-config.ts` — export
  `INITIAL_MESSAGES_LIMIT`
- `widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx` — import
  `INITIAL_MESSAGES_LIMIT`
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — FAB z-index comment,
  `aria-controls`, sheet `id`
- `widgets/dashboard-chat/model/dashboard-chat-column-store.ts` or
  `chat-column-config.ts` — remove `: boolean`
- `docs/plans/2026-05-22-feat-chat-mobile-access-plan.md` — add phase ordering
  note

## Acceptance Criteria

- [ ] `INITIAL_MESSAGES_LIMIT` is defined once and imported everywhere it's used
- [ ] FAB `z-[30]` has a comment explaining it's intentionally below sidebar
      backdrop (or is raised to `z-[45]`)
- [ ] `isChatColumnHidden` has no explicit `: boolean` return annotation
- [ ] Plan has a note that Phase 3 (`index.ts` export) must land before Phase 2
      (layout import)
- [ ] FAB has `aria-controls="mobile-chat-sheet"` and sheet has
      `id="mobile-chat-sheet"`

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**

- Grouped 6 low-severity items from Kieran TS and Architecture Strategist
  reviews
- Item 6 (MobileSidebar) is out of scope — noted for follow-up only
