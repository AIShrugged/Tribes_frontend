---
status: pending
priority: p1
issue_id: '091'
tags: [code-review, architecture, today-briefing, suspense, error-handling]
dependencies: ['090']
---

# No Error Boundary Around BriefingSection — Briefing Failure Crashes Entire Page

## Problem Statement

The plan wraps `BriefingSection` in `<Suspense>` but does not wrap it in an
`<ErrorBoundary>`. Suspense handles loading states; it does not catch errors. If
`getTodayBriefing` throws (5xx from backend, network timeout, invalid response),
the error propagates past the Suspense boundary to the nearest Error Boundary —
which is `app/dashboard/error.tsx`, the page-level error boundary. This means a
failed briefing fetch **takes down the entire Progress/Tasks page**, including
the KPI chart that loaded successfully.

The plan explicitly claims: "KPI chart is visible immediately (~300ms); AI
blocks stream in independently." This is false if briefing can crash the whole
page.

## Findings

- React Suspense boundaries handle loading states only — they do NOT catch
  thrown errors
- Errors thrown inside a Suspense-wrapped async component bubble up to the
  nearest Error Boundary
- `app/dashboard/error.tsx` is the closest Error Boundary for
  `app/dashboard/today/progress/page.tsx`
- A crash in BriefingSection would replace the entire page with the error UI
- The performance and UX argument for Suspense streaming fails if errors are not
  independently bounded
- `getTodayBriefing` calls an AI-backed endpoint — higher error probability than
  pure DB queries

## Proposed Solutions

### Option 1: ErrorBoundary + Suspense wrapper — Recommended

Use React's `ErrorBoundary` (requires a class component or library) around the
Suspense boundary:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={null}>
  <Suspense fallback={<BriefingSectionSkeleton />}>
    <BriefingSection date={date} />
  </Suspense>
</ErrorBoundary>;
```

This silently hides the briefing section on error (acceptable — the KPI content
remains), while the Suspense handles the loading state.

**Pros:** Full independent failure isolation. KPI chart always visible. Minimal
user impact. **Cons:** `react-error-boundary` must be a dependency (check if
already in package.json). **Effort:** Small (30 min) **Risk:** Low

---

### Option 2: Internal try/catch in BriefingSection, return null on error

```tsx
export async function BriefingSection({ date }: { date?: string }) {
  try {
    const briefing = await getTodayBriefing(date);
    if (briefing.events.length === 0) return null;
    // ... render
  } catch {
    return null; // silently degrade
  }
}
```

**Pros:** No additional library. Fully contained. **Cons:** Hides errors
completely — no logging, no monitoring signal. Prefer with an explicit log.
**Effort:** Trivial **Risk:** Low (but silent failures are hard to debug)

---

### Option 3: Return empty state on error (user-visible)

```tsx
} catch {
  return (
    <p className='text-sm text-muted-foreground'>
      AI briefing unavailable — try refreshing.
    </p>
  );
}
```

**Pros:** User-visible graceful degradation. Not silent. **Cons:** More UI to
maintain. May feel noisy on transient errors. **Effort:** Small **Risk:** Low

## Recommended Action

Option 2 with error logging via `logApiError` from `shared/lib/logger.ts`. The
KPI chart is the primary content; briefing is supplementary. Silent degradation
is acceptable if paired with server-side logging for observability.

## Technical Details

**Affected files:**

- `features/today-briefing/ui/briefing-section.tsx` (or `ai-nudge-section.tsx` /
  `ai-prep-section.tsx` per todo #090)

**Related components:**

- `app/dashboard/error.tsx` — current page-level error boundary (what catches
  the error now)
- `shared/lib/logger.ts` — `logApiError` for server-side logging

## Acceptance Criteria

- [ ] A briefing fetch error (5xx, timeout) does NOT crash the Progress/Tasks
      page
- [ ] KPI chart remains visible when briefing fails
- [ ] Error is logged server-side for observability

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (adversarial review agent)

**Actions:**

- Identified missing error isolation for the Suspense-wrapped BriefingSection
- Confirmed that Suspense does not catch errors (only React Error Boundaries do)
- Three options documented with effort/risk
