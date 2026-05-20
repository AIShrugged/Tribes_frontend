---
status: pending
priority: p1
issue_id: '010'
tags: [code-review, architecture, fsd, calendar, user-profile]
dependencies: []
---

# Resolve FSD violation: AttachCalendarButton placement

## Problem Statement

The plan proposes placing `AttachCalendarButton` in `features/calendar/ui/` and
having `features/user-profile` import it via `@/features/calendar`. This is an
explicit FSD violation. CLAUDE.md states:

> `features/A` must NOT import from `features/B` — put shared logic in
> `entities/` or `shared/`

Importing via the public `index.ts` does not fix the violation — it is still a
cross-feature import. `fsd-boundary-guard` will flag this.

The plan acknowledges the contradiction internally but resolves it incorrectly —
it describes shared/ui/ as the "correct FSD layer" but then places the component
in features/calendar/ anyway, calling it "pragmatic."

## Findings

- `features/user-profile/ui/CalendarSection.tsx` would contain
  `import { AttachCalendarButton } from '@/features/calendar'`
- CLAUDE.md FSD Layer Rules: `features/A` must NOT import from `features/B`
- `shared/` must NOT import from `entities/` or `features/` — so shared/ui/
  can't import attachCalendar Server Action
- The codebase has one pre-existing violation: `features/organization` imports
  from `features/agents` (organization-issue-types-settings.tsx:22) — but this
  should not be treated as precedent
- `app/` can import from any feature's index.ts — this is valid

## Proposed Solutions

### Option 1: Dependency Injection — `onAttach` callback prop (Recommended)

Place `AttachCalendarButton` in `shared/ui/` with an injected action:

```tsx
// shared/ui/calendar/attach-calendar-button.tsx
'use client';
interface Props {
  onAttach: () => Promise<string>;
  className?: string;
}
export function AttachCalendarButton({
  onAttach,
  className,
  children,
}: PropsWithChildren<Props>) {
  const handleAttach = async () => {
    globalThis.location.href = await onAttach();
  };
  // ...
}
```

Callers inject the bound action:

```tsx
// features/calendar/ui/onboarding-trigger.tsx
import { AttachCalendarButton } from '@/shared/ui/calendar/attach-calendar-button';
import { attachCalendar } from '@/features/calendar/api/calendar';

<AttachCalendarButton onAttach={() => attachCalendar(organizationId)}>
  <OnboardingImage />
</AttachCalendarButton>;
```

```tsx
// features/user-profile/ui/CalendarSection.tsx
import { AttachCalendarButton } from '@/shared/ui/calendar/attach-calendar-button';
import { attachCalendar } from '@/features/calendar/api/calendar';

// app/dashboard/profile/calendar/page.tsx passes: onAttach={() => attachCalendar(orgId)}
// or CalendarSection imports the Server Action directly (app/ can import from features/api/)
```

Wait — `features/user-profile` still can't import `attachCalendar` from
`features/calendar`. But per the FSD exception: **`app/` can import directly
from `features/*/api/` since Server Actions are not bundled client-side**. The
page can pass the bound action as prop:

```tsx
// app/dashboard/profile/calendar/page.tsx (Server Component — app/ layer)
import { attachCalendar } from '@/features/calendar/api/calendar';
// Bind the org ID and pass as prop
const boundAttach = attachCalendar.bind(null, +orgId);
return <CalendarSection source={...} onAttach={boundAttach} organizationId={+orgId} />;
```

**Pros:** Zero FSD violations. AttachCalendarButton is truly generic. Decoupled
from calendar feature.  
**Cons:** More verbose callers. `CalendarSection` needs `onAttach` prop added.
The page must import `attachCalendar`.  
**Effort:** Small  
**Risk:** Low

---

### Option 2: Keep in features/calendar/, accept violation with eslint-disable

Keep `AttachCalendarButton` in `features/calendar/ui/` and add a documented
exception in the fsd-boundary-guard config.

**Pros:** Simpler, fewer files changed.  
**Cons:** Real FSD violation. Makes the codebase inconsistent. May confuse
future developers.  
**Effort:** Tiny  
**Risk:** Medium (sets bad precedent)

---

### Option 3: Move attachCalendar to entities/source/api/

If `attachCalendar` lives in `entities/source/`, then `AttachCalendarButton` can
live in `entities/source/ui/` — both features can import from `entities/`.

**Pros:** Fully FSD-compliant.  
**Cons:** Clutters the source entity with calendar-specific logic. Source entity
currently has no API layer.  
**Effort:** Medium  
**Risk:** Low

## Recommended Action

Use **Option 1** (dependency injection). The page (`app/` layer) can freely
import from `features/calendar/api/` and pass the bound action as a prop to
`CalendarSection`. This is the idiomatic FSD pattern for sharing behavior across
features.

Update the plan to:

1. Place `AttachCalendarButton` in
   `shared/ui/calendar/attach-calendar-button.tsx`
2. Give it `onAttach: () => Promise<string>` prop instead of `organizationId`
3. `app/dashboard/profile/calendar/page.tsx` binds `attachCalendar(+orgId)` and
   passes as prop to CalendarSection
4. `features/user-profile/ui/CalendarSection.tsx` receives `onAttach` prop — no
   calendar feature import

## Technical Details

**Affected files:**

- Plan: `docs/plans/2026-05-18-fix-calendar-attach-organization-id-plan.md` —
  update solution #4 and step 3
- New component location: `shared/ui/calendar/attach-calendar-button.tsx` (not
  features/)
- `features/user-profile/ui/CalendarSection.tsx` — receives `onAttach` prop
- `app/dashboard/profile/calendar/page.tsx` — binds action and passes as prop

## Acceptance Criteria

- [ ] `fsd-boundary-guard` passes with no cross-feature violations
- [ ] `AttachCalendarButton` lives in `shared/ui/` (not features/)
- [ ] `features/user-profile` has zero imports from `features/calendar`
- [ ] All three surfaces still work identically

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Identified FSD violation in plan's "verdict" section. Confirmed
CLAUDE.md FSD rules. Found pre-existing violation in organization→agents as
non-precedent. Proposed DI pattern.

## Notes

- The plan's "Enhancement Summary" incorrectly describes this as resolved ("use
  public API"). It is NOT resolved — cross-feature imports via public API are
  still violations.
- The DI pattern (onAttach callback) is the idiomatic React/FSD solution for
  this exact scenario.
