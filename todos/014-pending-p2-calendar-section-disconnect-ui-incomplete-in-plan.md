---
status: pending
priority: p2
issue_id: '014'
tags: [code-review, completeness, user-profile, calendar]
dependencies: []
---

# Plan's CalendarSection snippet is incomplete — disconnect UI missing

## Problem Statement

The plan's proposed `CalendarSection` code snippet shows
`{/* existing disconnect button logic */}` as a placeholder. The actual
`CalendarSection` component has 40+ lines of confirm/cancel disconnect UI with
inline state management. The plan does not specify whether this logic is
preserved, refactored, or moved.

When a developer implements Step 9, they may inadvertently drop the disconnect
UI or break the confirming state.

## Findings

Current `features/user-profile/ui/CalendarSection.tsx` (when source !== null):

- Shows calendar identity + "Disconnect" button
- On click: switches to confirming state with "Are you sure? / Yes, disconnect /
  Cancel"
- Pending state management: `isPending`, `confirming`
- Calls `detachCalendarFromProfile()` server action
- On success: `toast.success('Google Calendar disconnected.')` +
  `router.refresh()`

Plan snippet only shows:

```tsx
<div className='flex items-center justify-between gap-4 ...'>
  <div className='flex flex-col gap-0.5'>
    <span>Google Calendar</span>
    <span>{source.identity}</span>
    {organizationName && <span>Organization: {organizationName}</span>}
  </div>
  {/* existing disconnect button logic */}
</div>
```

The `{/* existing disconnect button logic */}` placeholder suggests the
implementation is incomplete and leaves it to the developer to figure out.

## Proposed Solutions

### Option 1: Spell out the full CalendarSection in the plan (Recommended)

The plan should show the complete updated component, not just the new additions.
The org name display is a small addition to the existing connected view.

The actual change for `source !== null` case is minimal:

```tsx
<div className='flex flex-col gap-0.5'>
  <span className='text-sm font-medium text-foreground'>Google Calendar</span>
  <span className='text-xs text-muted-foreground'>{source.identity}</span>
  {/* ADD: org name when available */}
  {organizationName && (
    <span className='text-xs text-muted-foreground'>
      Organization: {organizationName}
    </span>
  )}
</div>
```

Everything else (confirming, isPending, handleDisconnect, buttons) stays exactly
as-is.

**Effort:** Documentation only — update plan text  
**Risk:** None

---

### Option 2: Keep placeholder, rely on developer judgment

Acceptable if developers are experienced and read the full current file.

**Risk:** Low-medium — easy to implement wrong

## Recommended Action

Update the plan to clarify: "Add the org name span only. All existing disconnect
UI (confirming state, isPending, handleDisconnect, toast) is preserved
unchanged."

## Technical Details

**Affected:** Plan documentation only  
**File:** `docs/plans/2026-05-18-fix-calendar-attach-organization-id-plan.md` —
Step 9 section

## Acceptance Criteria

- [ ] Plan step 9 clearly states that disconnect UI is preserved unchanged
- [ ] Only the org name span is added to the connected source view
- [ ] `confirming`, `isPending`, `handleDisconnect`, `router.refresh()` logic in
      CalendarSection is untouched

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Read full CalendarSection implementation. Found it has ~50 lines of
disconnect UI. Plan's snippet shows placeholder. Flagged as implementation gap.
