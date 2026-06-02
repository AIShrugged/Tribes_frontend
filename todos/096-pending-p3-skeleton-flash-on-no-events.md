---
status: pending
priority: p3
issue_id: '096'
tags: [code-review, ux, suspense, today-briefing]
dependencies: ['090', '091']
---

# Skeleton Flash When No Events — BriefingSectionSkeleton Appears Then Disappears

## Problem Statement

When `getTodayBriefing` returns `briefing.events.length === 0` (user has no
meetings today), `BriefingSection` returns `null`. But because it is wrapped in
`<Suspense fallback={<BriefingSectionSkeleton />}>`, the skeleton will appear
first, then disappear when the component resolves to null. The skeleton implies
content is loading — when nothing arrives, the user sees a loading indicator
that vanishes. On fast connections this is a brief flash; on slow connections it
is a prominent skeleton that resolves to empty space above the KPI chart.

## Findings

- React Suspense always shows the fallback while the async component resolves
- There is no React API to conditionally skip the fallback based on future
  resolved value
- If `briefing.events.length === 0`, BriefingSection returns null
- The skeleton appears regardless, even when no content will follow
- This is most visible in the "no meetings today" case — likely a common daily
  state

## Proposed Solutions

### Option 1: Accept the flash — low UX impact

On fast connections (server-rendered in <100ms), the flash is imperceptible.
Only on slow connections (>500ms for briefing fetch) will users notice. This is
acceptable for a supplementary feature.

**Pros:** Zero implementation effort. **Cons:** Flash exists on slow
connections. **Effort:** None **Risk:** Very low

---

### Option 2: Use a minimal / invisible skeleton fallback

```tsx
<Suspense fallback={<div className='h-0' />}>
  <BriefingSection date={date} />
</Suspense>
```

No visible skeleton means no flash visible to the user. If content arrives, it
appears. If not, nothing changes.

**Pros:** Eliminates visual flash. Zero extra code. **Cons:** No loading
indication for users on slow connections who do have events. **Effort:** Trivial
**Risk:** Very low

---

### Option 3: Use `useDeferredValue` or progressive enhancement

More complex approaches that tune Suspense behavior. Not warranted for this
feature.

## Recommended Action

Option 2 — replace `BriefingSectionSkeleton` with a zero-height invisible
fallback, or use `null` as fallback. The briefing section is supplementary
content; its loading state need not be visually prominent.

## Technical Details

**Affected files:**

- `app/dashboard/today/progress/page.tsx` — change Suspense fallback
- `features/today-briefing/ui/briefing-section-skeleton.tsx` — may not need to
  exist if invisible fallback is used

## Acceptance Criteria

- [ ] No visible skeleton flash on days with zero events
- [ ] Briefing content appears correctly on days with events

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (adversarial review agent)

**Actions:**

- Identified skeleton-flash on no-events case
- Confirmed React Suspense cannot conditionally suppress fallback pre-resolution
- Two practical solutions documented
