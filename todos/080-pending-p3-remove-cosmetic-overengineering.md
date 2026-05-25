---
status: pending
priority: p3
issue_id: "080"
tags: [code-review, simplicity, llm-prompts]
dependencies: []
---

# Remove cosmetic over-engineering: token count badge, isDirty indicator, getComputedStyle sync

## Problem Statement

Three "UX upgrades" from the deepening pass are cosmetic additions that add implementation complexity without proportional value for an admin-only page:

1. **Token count badge** (`Math.ceil(prompt.length / 4)`) — inaccurate approximation (15–30% off for Claude tokenizers), no actionable purpose (no token budget enforced), adds a live-updating UI element on every keystroke
2. **"Unsaved changes" amber indicator** — redundant with the Save button being enabled; adds a `role="status"` live region and `isDirty` check on every render
3. **`getComputedStyle` mirror sync on mount** — unnecessary when using explicit Tailwind classes (`font-mono text-sm leading-relaxed`); these resolve to deterministic pixel values, not inherited font drift

## Findings

- Token count: `Math.ceil(prompt.length / 4)` is a GPT-2 tokenizer approximation; Claude uses BPE with different ratios. The number is misleading for admins.
- `isDirty` indicator: react-hook-form's `formState.isDirty` is already used to disable Save when form is clean. A visual "Unsaved changes" badge is redundant.
- `getComputedStyle`: Tailwind `font-mono` resolves to `ui-monospace, SFMono-Regular, ...` with explicit `text-sm` = 14px, `leading-relaxed` = 22.75px. These are constant across all browsers when the design system is applied. Subpixel drift only occurs with inherited fonts — not applicable here.
- The `ResizeObserver` (to sync mirror height when textarea is resized by user) IS useful and should stay.

## Proposed Solutions

### Option 1: Remove all three (Recommended)

- Delete token count badge and its rendering logic
- Delete "Unsaved changes" indicator and `role="status"` live region
- Delete `getComputedStyle` mount effect; keep `ResizeObserver` for height sync only

**Effort:** 30 minutes total
**Risk:** Low (all cosmetic)

## Recommended Action

Remove all three from the plan. The `ResizeObserver` stays for height sync. The `getComputedStyle` approach can be re-added if a non-monospace font is ever introduced.

## Technical Details

**Affected files:**
- `features/llm-prompts/ui/llm-prompt-form.tsx` — remove token count, isDirty indicator, getComputedStyle effect
- Plan document — update Edit Page section

## Acceptance Criteria

- [ ] No token count badge in `llm-prompt-form.tsx`
- [ ] No "Unsaved changes" amber indicator
- [ ] No `getComputedStyle` mount effect (but `ResizeObserver` for height sync stays)
- [ ] Estimated LOC reduction: ~30 lines

## Work Log

### 2026-05-25 - Discovered during plan simplicity review
**By:** Claude Code

---
