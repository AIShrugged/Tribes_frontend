---
status: pending
priority: p1
issue_id: '011'
tags: [code-review, regression, ux, calendar]
dependencies: []
---

# Preserve "Redirecting to Google..." pending text in OnboardingTrigger

## Problem Statement

`OnboardingTrigger` currently shows "Redirecting to Google..." text while the
OAuth redirect is in progress. The plan delegates all pending/error state to
`AttachCalendarButton`, but `AttachCalendarButton` shows "Connecting..." as the
button label — not a separate paragraph below the button.

If the plan is implemented as written, the "Redirecting to Google..." message
will disappear, which is a UX regression. This text is important because the
button shows a Google logo image (not text), so users need the status message to
know something is happening.

## Findings

Current `onboarding-trigger.tsx:44-47`:

```tsx
{
  isPending && (
    <p className='text-sm mt-4 text-muted-foreground'>
      Redirecting to Google...
    </p>
  );
}
```

Proposed `AttachCalendarButton` renders:
`{isPending ? 'Connecting...' : (children ?? 'Connect Calendar')}` inside the
button element — replacing the children (OnboardingImage) with text. This means:

- When pending: button shows "Connecting..." text (✅ functional but different
  UX)
- The separate "Redirecting to Google..." paragraph below: **disappears** (❌
  regression)

Plan acknowledges this at Step 4: "Note: OnboardingTrigger showed 'Redirecting
to Google...' text while pending. This should be preserved. Pass it as a named
slot or add showPendingText prop..." — but leaves it as an unresolved note, not
a concrete step.

## Proposed Solutions

### Option 1: Add `pendingText` prop to AttachCalendarButton (Recommended)

```tsx
interface Props {
  onAttach: () => Promise<string>;
  pendingText?: string; // shown as paragraph below button when pending
  className?: string;
}

export function AttachCalendarButton({
  onAttach,
  pendingText,
  className,
  children,
}: PropsWithChildren<Props>) {
  return (
    <>
      <button
        type='button'
        onClick={handleAttach}
        disabled={isPending}
        className={className}
      >
        {isPending ? 'Connecting...' : children}
      </button>
      {isPending && pendingText && (
        <p className='text-sm mt-4 text-muted-foreground'>{pendingText}</p>
      )}
      {error !== null && (
        <p className='text-sm text-destructive mt-1'>{error}</p>
      )}
    </>
  );
}
```

Usage in OnboardingTrigger:

```tsx
<AttachCalendarButton
  onAttach={() => attachCalendar(organizationId)}
  pendingText='Redirecting to Google...'
  className='cursor-pointer focus:outline-none'
>
  <OnboardingImage />
</AttachCalendarButton>
```

**Pros:** Fully backward-compatible. Flexible for other surfaces.  
**Effort:** Small  
**Risk:** Low

---

### Option 2: Keep minimal wrapper state in OnboardingTrigger

OnboardingTrigger keeps its own `isPending` state just for the text, and uses
`AttachCalendarButton` for the button itself.

**Cons:** Duplicates pending state. More complex. Don't do this.

---

### Option 3: Use React children slot for pending content

Pass pending content as a render prop. Overly complex for this use case.

## Recommended Action

Option 1 — add `pendingText?: string` prop. Simple, explicit, zero regression
risk.

Update the plan step 3 (AttachCalendarButton) and step 4 (OnboardingTrigger
usage) with this prop.

## Technical Details

**Affected files:**

- `features/calendar/ui/attach-calendar-button.tsx` (new) — add `pendingText`
  prop
- `features/calendar/ui/onboarding-trigger.tsx` — pass
  `pendingText='Redirecting to Google...'`

**Test to add in attach-calendar-button.test.tsx:**

```ts
it('shows pendingText below button while pending', async () => {
  mockOnAttach.mockReturnValue(new Promise(() => {}));
  render(
    <AttachCalendarButton onAttach={mockOnAttach} pendingText='Redirecting to Google...'>
      <img alt='Google' />
    </AttachCalendarButton>
  );
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Redirecting to Google...')).toBeInTheDocument();
});
```

## Acceptance Criteria

- [ ] `OnboardingTrigger` still shows "Redirecting to Google..." below the
      Google logo button while pending
- [ ] `EmptyState` can optionally show a pending message (or use button label)
- [ ] `AttachCalendarButton` test covers `pendingText` prop behavior

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Read current OnboardingTrigger implementation. Found pending text
at line 44-47. Noted plan's unresolved "Note:" about preserving it. Proposed
pendingText prop.
