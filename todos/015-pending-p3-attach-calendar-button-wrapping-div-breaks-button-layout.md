---
status: pending
priority: p3
issue_id: '015'
tags: [code-review, ui, accessibility, calendar]
dependencies: []
---

# AttachCalendarButton outer div breaks OnboardingTrigger button layout

## Problem Statement

The proposed `AttachCalendarButton` wraps the button and error paragraph in a
`<div>`. When used inside `OnboardingTrigger`, the current button is a bare
clickable element with `className='cursor-pointer focus:outline-none'`. Wrapping
in a `<div>` will break the existing layout (centering, spacing) and the
`className` prop will apply to the button element but not the wrapper div.

## Findings

Proposed `AttachCalendarButton`:

```tsx
return (
  <div>
    {' '}
    {/* ← outer wrapper */}
    <button
      type='button'
      onClick={handleAttach}
      disabled={isPending}
      className={className}
    >
      {isPending ? 'Connecting...' : children}
    </button>
    {error !== null && <p className='text-sm text-destructive mt-1'>{error}</p>}
  </div>
);
```

Current `OnboardingTrigger`:

```tsx
<div className='flex flex-col gap-7.5 justify-center items-center h-full w-full'>
  <H1>Continue with Google</H1>
  <button                                     {/* currently: bare button, flex item */}
    type='button'
    onClick={handleAttach}
    disabled={isPending}
    className='cursor-pointer focus:outline-none'
  >
    <OnboardingImage />
  </button>
  {isPending && <p className='...'>Redirecting to Google...</p>}
  {error && <p className='...text-destructive'>{error}</p>}
</div>
```

After wrapping: `<AttachCalendarButton>` introduces a div between the flex
container and the button. This:

1. Changes the layout (div is block, not inline-flex by default)
2. `className` applies to button inside div, but div has no styling
3. Centering from parent flex container now applies to the div wrapper, not the
   button directly

For `EmptyState` and `CalendarSection`, the impact is different but similar
structural concerns exist.

## Proposed Solutions

### Option 1: Use React.Fragment instead of div wrapper (Recommended)

```tsx
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
    {pendingText && isPending && (
      <p className='text-sm mt-4 text-muted-foreground'>{pendingText}</p>
    )}
    {error !== null && <p className='text-sm text-destructive mt-1'>{error}</p>}
  </>
);
```

**Pros:** Zero layout impact. Callers control their own layout as before.  
**Cons:** Error/pending text is not co-located in a container — may need parent
to handle spacing.  
**Effort:** Trivial  
**Risk:** None

---

### Option 2: Add className to the wrapper div

```tsx
return <div className={cn('flex flex-col', wrapperClassName)}>...</div>;
```

Adds a `wrapperClassName` prop. More flexible but more surface area.

---

### Option 3: Use button as the root element

Rethink: make the entire component a single `<button>` with error/pending
rendered via a `data-` attribute or portal. Too complex.

## Recommended Action

Option 1 — use `<>` Fragment. Simplest, no layout regression.

## Technical Details

**Affected:** `features/calendar/ui/attach-calendar-button.tsx` (new file,
change before creation)

## Acceptance Criteria

- [ ] `AttachCalendarButton` uses Fragment (`<>`) not `<div>` as root
- [ ] OnboardingTrigger visual layout is pixel-identical before and after

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Compared proposed AttachCalendarButton JSX with OnboardingTrigger's
current structure. Identified div wrapper layout impact.
