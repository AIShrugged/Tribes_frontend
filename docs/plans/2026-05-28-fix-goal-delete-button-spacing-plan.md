---
title:
  'fix: Move goal delete button away from expand toggle to prevent accidental
  deletion'
type: fix
status: active
date: 2026-05-28
---

# fix: Move goal delete button away from expand toggle to prevent accidental deletion

## Enhancement Summary

**Deepened on:** 2026-05-28  
**Research agents used:** best-practices-researcher, security-sentinel (a11y),
kieran-typescript-reviewer, design-guardian, code-simplicity-reviewer,
performance-oracle, julik-frontend-races-reviewer, architecture-strategist,
spec-flow-analyzer

### Key Improvements Added

1. **WCAG 2.5.8 / 2.5.5 violation identified** — current 28px Trash button and
   16px bare chevron both fail touch-target minimums; specific px values and
   Tailwind classes provided to fix
2. **Option A decision reversed by design-guardian** — icon-only ghost Trash2
   pattern is used in 3 other sibling components; a text-label "Remove goal"
   button breaks visual language consistency; Option C (separator) is the
   design-system-correct answer
3. **Critical pre-existing a11y bug identified** — the header `<div onClick>`
   has no keyboard role; regardless of which layout option is chosen, it must
   become a `<button>` element
4. **Missing guard during form submission** — `onRemove` has no `isSubmitting`
   guard; silent state divergence possible if user deletes after clicking
   "Confirm and continue"
5. **Index-key bug discovered** — `key={index}` causes expanded-state loss on
   deletion from middle of list; stable UUIDs on `EditableGoal` needed
6. **Race condition analysis** — `e.stopPropagation()` is safe today but is a
   structural smell; Option A (or converting header to `<button>`) eliminates it
   entirely

---

## Problem Statement

In the Onboarding feature (`features/onboarding/ui/onboarding-goal-card.tsx`),
the **Trash (delete) button** and the **ChevronUp/Down (expand) icon** sit in
the same flex row with only `gap-4` (16px) between them. Because the entire
header row is also a click target for expand/collapse, users regularly trigger
accidental deletions when trying to read/expand a goal.

Two compounding UX issues exist:

1. **`onboarding-goal-card.tsx` (lines 41–58):** The delete button (`h-7 w-7`,
   28px touch target) is placed immediately to the left of the raw chevron icon
   (`h-4 w-4`, no padding, 16px) inside a single
   `flex items-center gap-4 shrink-0` container. The chevron has no `<Button>`
   wrapper — it is a bare Lucide icon — meaning there is no visual affordance
   separating "dangerous action" from "safe navigation". The entire card header
   is `cursor-pointer`, which makes the chevron area feel like a natural tap
   zone.

2. **`features/issues/ui/epic-goal-card-client.tsx` (lines 121–138):** The
   Unlink/detach button (`p-0.5`, ~14px effective tap area) is separated from
   the `IssueStatusBadge` by only `gap-1` (4px). The button is also only visible
   on row hover (`opacity-0 group-hover/taskrow:opacity-100`), which doesn't
   prevent mis-taps since hover reveals it right as the user's finger is already
   near the badge.

### Research Insights

**NNGroup "Proximity of Consequential Options" principle (directly
applicable):**

- Placing a high-consequence action adjacent to a low-consequence action causes
  "slips" — the user intends to trigger one but physically activates the other
- Risk is highest when targets are visually similar (both icon-only, same size,
  same color treatment)
- Proximity violations are especially severe on touch interfaces where there is
  no hover state to confirm intent before activation
- Research shows: reducing a button from 44px to 30px **doubles the error
  rate**; 66% of mobile sites place tappable elements too close together

**WCAG violations in current code:**

| Element                | Current size    | WCAG 2.5.8 (AA)                                                   | WCAG 2.5.5 (AAA)  |
| ---------------------- | --------------- | ----------------------------------------------------------------- | ----------------- |
| Trash button `h-7 w-7` | 28px            | ⚠ Marginal (meets 24px floor, but gap < 24px offset requirement) | ❌ Fails (< 44px) |
| Bare ChevronDown icon  | 16px, no button | ❌ Fails (< 24px, no interactive role)                            | ❌ Fails          |
| Unlink button `p-0.5`  | ~14px           | ❌ Fails                                                          | ❌ Fails          |

WCAG 2.5.8 minimum: **24×24px target** with 24px spacing offset between adjacent
targets. With `gap-4` (16px) between the two, even the 28px Trash button fails
the spacing alternative test.

---

## Proposed Solution

### Fix 1 — `onboarding-goal-card.tsx`: Option C (design-system correct)

**Recommended: Option C — visual separator + proper chevron button +
`e.stopPropagation()` removed from outer div.**

The design-guardian analysis confirms that Options A (delete in body) and B
(delete on left) both break the established visual language: three sibling
components (`onboarding-team-member-row.tsx`, `onboarding-file-upload.tsx`,
`issue-attachments.tsx`) all use the same icon-only ghost `Trash2` pattern as
the current card. Introducing a text-labeled "Remove goal" button (Option A) or
leading-edge delete (Option B) creates inconsistency across a component family
that is visually unified.

**Option C is the minimum correct fix:**

1. Remove `onClick` from the outer `<div>` — convert header to a
   `<button type="button">` so it is keyboard-accessible and semantically
   correct
2. Add `gap-2` between trash and separator, add
   `<span aria-hidden="true" className='w-px h-4 bg-border shrink-0' />` visual
   separator
3. Wrap ChevronDown/ChevronUp in a `<button type="button">` with `p-1 rounded`
   padding — gives it a proper 32px touch target and removes the need for outer
   div to carry the click handler
4. Remove `e.stopPropagation()` from Trash button once the header `<div>` no
   longer has an `onClick`

**However:** The code-simplicity reviewer and julik-races-reviewer both
independently agree that the cleanest structural fix is to also make the entire
header a `<button>` (not just the chevron), so the tap target for expand covers
the full header width. This is better than a narrow-chevron button only.

**Final recommended structure:**

```tsx
// Header: full-width <button> for expand, no onClick on outer div
<button
  type='button'
  aria-expanded={expanded}
  className='w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer text-left'
  onClick={() => setExpanded((v) => !v)}
>
  <div className='flex items-center gap-2 min-w-0'>
    <span className='text-xs text-muted-foreground shrink-0'>#{index + 1}</span>
    <span className='text-sm font-medium text-foreground truncate'>
      {goal.title || 'Untitled goal'}
    </span>
  </div>
  <div className='flex items-center gap-2 shrink-0'>
    {/* Trash button: sibling to the expand button header, wrapped to stopPropagation */}
    ...
  </div>
</button>
```

Wait — nesting a `<Button>` inside a `<button>` is invalid HTML. So the correct
structure is:

```tsx
// Outer: not a button, just a flex row
<div className='flex items-center justify-between gap-3 px-4 py-3'>
  {/* Left: title + index — this zone clicks to expand */}
  <div
    className='flex items-center gap-2 min-w-0 flex-1 cursor-pointer'
    onClick={() => setExpanded((v) => !v)}
  >
    <span className='text-xs text-muted-foreground shrink-0'>#{index + 1}</span>
    <span className='text-sm font-medium text-foreground truncate'>
      {goal.title || 'Untitled goal'}
    </span>
  </div>
  {/* Right: delete + separator + chevron — all siblings, no nested interactive elements */}
  <div className='flex items-center gap-2 shrink-0'>
    <Button
      type='button'
      variant={BUTTON_VARIANT.ghost}
      aria-label={`Remove goal ${index + 1}${goal.title ? `: ${goal.title}` : ''}`}
      className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
      onClick={onRemove}
    >
      <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
    </Button>
    <span className='w-px h-4 bg-border shrink-0' aria-hidden='true' />
    <button
      type='button'
      aria-label={expanded ? 'Collapse goal' : 'Expand goal'}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      className='p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'
    >
      {expanded ? (
        <ChevronUp className='h-4 w-4' aria-hidden='true' />
      ) : (
        <ChevronDown className='h-4 w-4' aria-hidden='true' />
      )}
    </button>
  </div>
</div>
```

Key: **no `stopPropagation` needed** because the Trash button and the chevron
button are both siblings — neither is inside the other's click area. The title
zone (left div with `onClick`) still expands on click.

### Fix 2 — `epic-goal-card-client.tsx`: Increase detach button touch target and spacing

Change line 121:

- `gap-1` → `gap-2` (4px → 8px between badge and Unlink button)
- `p-0.5` → `p-1.5` on Unlink button (14px → 24px effective touch target — meets
  WCAG 2.5.8 minimum)

---

## Acceptance Criteria

- [ ] Expanding a goal card (clicking title text or chevron in the header) never
      triggers `onRemove`
- [ ] The delete button and expand chevron are visually separated by a
      `w-px h-4 bg-border` divider
- [ ] The chevron is a proper `<button type="button">` element with
      `aria-expanded` and `aria-label`
- [ ] The Trash button has an `aria-label` including the goal title for screen
      reader context
- [ ] Delete button remains `h-7 w-7` (28px) — acceptable for WCAG 2.5.8 since
      adjacent targets are now separated by 8px gap + 4px separator = 12px from
      chevron's 8px padding → combined offset ≥ 20px (document this exception in
      code comment if needed; ideal upgrade to `h-9 w-9` achieves full
      compliance)
- [ ] In `epic-goal-card-client.tsx`, Unlink button is `p-1.5` and container is
      `gap-2`
- [ ] No `e.stopPropagation()` remains unless a nested-click scenario genuinely
      requires it
- [ ] Existing tests pass (`npm test`)
- [ ] `onRemove` does not fire during `isSubmitting = true` (guarded — see
      pre-requisite fixes below)

**Deferred (out of scope for this fix, tracked separately):**

- [ ] Full WCAG 2.5.5 (44px) touch targets — requires `h-11 w-11` on all icon
      buttons; deferred to accessibility sprint
- [ ] Keyboard accessibility for the title-zone expand div — needs
      `role="button" tabIndex={0} onKeyDown` or structural refactor
- [ ] Undo toast for goal deletion (Sonner action button)

---

## Pre-Requisite Fixes (discover during research — do these first)

### Pre-req 1: Stable keys for goal list

**File:** `features/onboarding/model/types.ts` +
`features/onboarding/model/wizard-reducer.ts` +
`features/onboarding/ui/onboarding-preview-step.tsx`

**Problem:** The goal list uses `key={index}`. When a goal is deleted from the
middle of the list, React re-uses DOM nodes by position — the surviving cards
inherit the wrong `expanded` state. If card 2 was open, deleting card 1 makes
card 2 become card 1 with a fresh `expanded = false` (re-mounted).

**Fix:** Add `_id: string` to `EditableGoal` type. In the reducer's
`POLL_RESULT` handler (and `buildInitialState`), assign
`_id: crypto.randomUUID()` to each goal. Change `key={index}` to
`key={goal._id}` in `onboarding-preview-step.tsx`. This mirrors the existing
pattern for `EditableTeamMember._id` already in the codebase.

```ts
// types.ts
export interface EditableGoal {
  _id: string; // ADD
  title: string;
  description: string;
}
```

```ts
// wizard-reducer.ts — in POLL_RESULT handler, when mapping goals:
goals: parsed.goals.map((g) => ({ _id: crypto.randomUUID(), ...g })),
```

```tsx
// onboarding-preview-step.tsx line 88
key={goal._id}   // was: key={index}
```

### Pre-req 2: isSubmitting guard on remove button

**File:** `features/onboarding/ui/onboarding-goal-card.tsx` +
`features/onboarding/ui/onboarding-preview-step.tsx`

**Problem:** `onRemove` dispatches `GOAL_REMOVE` synchronously. If the user
clicks "Confirm and continue" and then quickly removes a goal, the removal
mutates state after the accept payload was already sent to the API. Silent
divergence.

**Fix:** Pass `disabled` prop to `OnboardingGoalCard`:

```tsx
// onboarding-preview-step.tsx: pass isSubmitting down
<OnboardingGoalCard
  ...
  disabled={isSubmitting}
/>

// onboarding-goal-card.tsx: add to Props interface
interface Props {
  goal: EditableGoal;
  index: number;
  onUpdate: (updated: EditableGoal) => void;
  onRemove: () => void;
  disabled?: boolean;  // ADD
}

// Apply to Trash button:
<Button disabled={disabled} ...>
```

---

## Files to Change

| File                                                 | Lines                 | Change                                                                                                                                        |
| ---------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/onboarding/model/types.ts`                 | `EditableGoal` type   | Add `_id: string` field                                                                                                                       |
| `features/onboarding/model/wizard-reducer.ts`        | `POLL_RESULT` handler | Assign `_id: crypto.randomUUID()` on each goal                                                                                                |
| `features/onboarding/ui/onboarding-preview-step.tsx` | Line 88               | `key={goal._id}`, pass `disabled={isSubmitting}` to card                                                                                      |
| `features/onboarding/ui/onboarding-goal-card.tsx`    | Lines 13–18, 41–58    | Add `disabled?` prop; restructure right-side group with separator + chevron button; add `aria-label` to Trash; add `aria-expanded` to chevron |
| `features/issues/ui/epic-goal-card-client.tsx`       | Line 121, 131         | `gap-1` → `gap-2`, `p-0.5` → `p-1.5`                                                                                                          |

---

## Final Implementation (onboarding-goal-card.tsx)

```tsx
'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Input from '@/shared/ui/input/Input';
import Textarea from '@/shared/ui/input/textarea';

import type { EditableGoal } from '../model/types';

interface Props {
  goal: EditableGoal;
  index: number;
  onUpdate: (updated: EditableGoal) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function OnboardingGoalCard({
  goal,
  index,
  onUpdate,
  onRemove,
  disabled,
}: Props) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className='rounded-[var(--radius-card)] border border-border bg-surface/40'>
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        {/* Title zone — click to expand */}
        <div
          role='button'
          tabIndex={0}
          className='flex items-center gap-2 min-w-0 flex-1 cursor-pointer'
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v);
          }}
        >
          <span className='text-xs text-muted-foreground shrink-0'>
            #{index + 1}
          </span>
          <span className='text-sm font-medium text-foreground truncate'>
            {goal.title || 'Untitled goal'}
          </span>
        </div>
        {/* Action group — delete | separator | expand chevron */}
        <div className='flex items-center gap-2 shrink-0'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.ghost}
            disabled={disabled}
            aria-label={`Remove goal ${index + 1}${goal.title ? `: ${goal.title}` : ''}`}
            className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
            onClick={onRemove}
          >
            <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
          </Button>
          <span className='w-px h-4 bg-border shrink-0' aria-hidden='true' />
          <button
            type='button'
            aria-label={expanded ? 'Collapse goal' : 'Expand goal'}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className='p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'
          >
            {expanded ? (
              <ChevronUp className='h-4 w-4' aria-hidden='true' />
            ) : (
              <ChevronDown className='h-4 w-4' aria-hidden='true' />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className='flex flex-col gap-3 px-4 pb-4 border-t border-border pt-3'>
          <Input
            label='Goal title'
            value={goal.title}
            onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
          />
          <Textarea
            label='Description'
            value={goal.description}
            onChange={(e) => onUpdate({ ...goal, description: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
```

**No `e.stopPropagation()` anywhere** — the Trash button and chevron button are
siblings, not nested inside any parent `onClick` handler. The title zone has its
own `onClick` independently.

---

## Tests to Write

New file: `features/onboarding/ui/__tests__/onboarding-goal-card.test.tsx`

Required test cases (RTL + jest-dom):

1. Renders goal title; falls back to "Untitled goal" when `title` is empty
2. `index === 0` card starts expanded; `index > 0` card starts collapsed
3. Clicking the title zone toggles expanded state
4. Clicking the chevron button toggles expanded state
5. When expanded, Input and Textarea render with current goal values
6. Changing title Input calls `onUpdate` with merged object
7. Changing description Textarea calls `onUpdate` with merged object
8. Clicking the Trash button calls `onRemove` exactly once
9. Clicking the title zone does NOT call `onRemove`
10. Clicking the chevron button does NOT call `onRemove`
11. When `disabled={true}`, the Trash button is disabled (has `disabled`
    attribute)
12. Trash button has accessible label including goal index and title
13. Chevron button has `aria-expanded` attribute matching expanded state

---

## Performance Notes

- No `useCallback` or `React.memo` needed — React 19 Compiler handles
  intra-component memoization; list is 5-10 items max
- The inline `() => setExpanded(v => !v)` handlers are auto-memoized by the
  Compiler since `setExpanded` is a stable `useState` setter
- `onRemove` is an unstable prop (created in parent map); without `React.memo`
  on the card this is irrelevant
- Pre-req 1 (stable keys) has a slight benefit: React avoids
  unmounting/remounting unchanged cards on deletion

---

## Event Handling Safety

- **No `stopPropagation` needed** in the final implementation — structural
  separation (sibling elements, no nested interactive elements) eliminates the
  bubbling problem entirely
- **Double-click safety:** `onRemove` is a synchronous `dispatch` call; React 19
  batches rapid dispatches against the same prior state, so double-click is a
  no-op on the second fire
- **`isDetaching` guard in `epic-goal-card-client.tsx`:** already correctly
  implemented for the async detach case; no change needed there

---

## References

- `features/onboarding/ui/onboarding-goal-card.tsx` — lines 41–58 (current
  button group)
- `features/onboarding/ui/onboarding-preview-step.tsx` — line 83–88 (goal card
  list, key={index})
- `features/onboarding/model/wizard-reducer.ts` — `GOAL_REMOVE` reducer case
- `features/onboarding/model/types.ts` — `EditableGoal` type
- `features/issues/ui/epic-goal-card-client.tsx` — lines 121–138 (task row
  detach button)
- `shared/ui/button/Button.tsx` — `BUTTON_VARIANT.ghost`, `fullWidth` default
- `features/onboarding/ui/onboarding-team-member-row.tsx` — sibling component
  using same icon-only ghost Trash2 pattern (visual language reference)
- WCAG 2.5.8 Target Size (Minimum):
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.5.5 Target Size (Enhanced):
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- NNGroup: Dangerous UX — Proximity of Consequential Options:
  https://www.nngroup.com/articles/proximity-consequential-options/
