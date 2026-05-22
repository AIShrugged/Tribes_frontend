---
status: pending
priority: p2
issue_id: "057"
tags: [mobile-chat, scope-creep, modal, scroll-lock, simplicity]
dependencies: []
---

# Remove Phase 4 from Plan — ModalRoot Scroll-Lock Refactor Is Scope Creep

## Problem Statement

The plan includes Phase 4: refactor `ModalRoot` to use the new `scroll-lock.ts` instead of its current `document.body.style.overflow = 'hidden'`. This is scope creep that risks breaking existing working modals and their tests, and is not required to ship the mobile chat drawer.

## Findings

- Phase 4 changes `ModalRoot` from `overflow: hidden` to the position-fixed technique — a behavioral difference with no direct tests guarding it
- `shared/ui/modal/__tests__/modal-root.test.tsx` has zero assertions on `document.body.style` — the refactor passes all tests regardless of whether scroll lock behavior changes
- The position-fixed technique changes `document.body.style.position` to `fixed`, which affects any code reading `document.body.getBoundingClientRect()` or depending on body position while a modal is open
- `cssText +=` in the plan's lockScroll further risks side effects (see todo 051)
- Code Simplicity reviewer: "Phase 4 should be removed from this plan entirely"
- Architecture Strategist: notes behavioral difference and absent test coverage

**The mobile chat drawer works correctly without touching `ModalRoot` at all.** `scroll-lock.ts` can be introduced solely for `MobileChatDrawer` first, and `ModalRoot` migration can be a separate ticket with proper before/after testing.

## Proposed Solutions

### Option 1: Remove Phase 4 from plan and defer (Recommended)

**Approach:** Delete Phase 4 from `docs/plans/2026-05-22-feat-chat-mobile-access-plan.md`. Create a separate ticket for `ModalRoot` scroll-lock migration if desired.

**Pros:** Reduces blast radius; doesn't risk breaking existing modals; ships mobile chat faster
**Cons:** `ModalRoot` continues to use `overflow: hidden` (current behavior, working today)

**Effort:** 5 min  
**Risk:** None

---

### Option 2: Keep Phase 4 but add test coverage first

**Approach:** Before migrating, add `document.body.style.position` assertions to `modal-root.test.tsx`. Then migrate `ModalRoot` to `scroll-lock.ts` with confidence.

**Pros:** Achieves consistent scroll-lock implementation across all overlays
**Cons:** Extends scope; needs test additions before the migration can land safely

**Effort:** 2–3 hours  
**Risk:** Medium

## Recommended Action

Remove Phase 4 from the current plan. The mobile chat feature is complete without it. If `ModalRoot` scroll-lock unification is desired, create a separate todo with explicit test coverage requirements.

## Technical Details

**Affected files:**
- `docs/plans/2026-05-22-feat-chat-mobile-access-plan.md` — delete Phase 4 section
- `shared/ui/modal/modal-root.tsx` — NO changes (stays as-is)
- `shared/ui/modal/__tests__/modal-root.test.tsx` — NO changes (or add scroll-lock test if Phase 4 is pursued separately)

**If Phase 4 IS pursued separately, Architecture Strategist recommends:**
- Add assertion: `expect(document.body.style.position).toBe('fixed')` when modal open
- Add assertion: `expect(document.body.style.position).toBe('')` after close
- Use individual property assignments in lockScroll (see todo 051)

## Acceptance Criteria

- [ ] Phase 4 section removed from plan (or scoped to a separate ticket)
- [ ] `ModalRoot` behavior is unchanged from current
- [ ] No changes to `shared/ui/modal/` in the mobile chat PR

## Work Log

### 2026-05-22 - Identified during plan review

**By:** Claude Code

**Actions:**
- Code Simplicity reviewer recommended removing Phase 4 as scope creep
- Architecture Strategist confirmed behavioral difference and test gap
