---
status: pending
priority: p3
issue_id: '035'
tags: [code-review, telegram, edge-case, date-parsing]
dependencies: [034]
---

# P3: Countdown does not handle unparseable `expires_at` string from backend

## Problem Statement

The planned countdown calculates
`remaining = new Date(linkData.expires_at).getTime() - Date.now()`. If
`expires_at` is an invalid ISO 8601 string or null/undefined (e.g., backend
sends wrong format), `new Date(...)` returns `Invalid Date` whose `.getTime()`
is `NaN`. The countdown then feeds `NaN` into `formatMmSs` (see todo 034) and
comparison `if (remaining <= 0)` also evaluates to `false` (since `NaN <= 0` is
false), causing the countdown to never expire.

## Findings

From `julik-frontend-races-reviewer` (edge case scenario analysis):

```typescript
// Planned code — no parse validation
useEffect(() => {
  if (state !== 'awaiting' || !linkData) return;
  const id = setInterval(() => {
    const remaining = new Date(linkData.expires_at).getTime() - Date.now();
    // If expires_at is invalid: remaining = NaN
    // NaN <= 0 === false → never expires, never shows "00:00"
    if (remaining <= 0) transition('expired');
    setCountdownMs(remaining);
  }, 1000);
  return () => clearInterval(id);
}, [state, linkData]);
```

## Proposed Solution

```typescript
useEffect(() => {
  if (state !== 'awaiting' || !linkData) return;
  const expiresAt = new Date(linkData.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) {
    // Backend returned invalid date — treat as already expired
    transition('expired');
    return;
  }
  const id = setInterval(() => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      transition('expired');
      setCountdownMs(0);
      return;
    }
    setCountdownMs(remaining);
  }, 1000);
  return () => clearInterval(id);
}, [state, linkData, transition]);
```

**Effort:** Small (parse once outside the interval, add `isFinite` check).

## Acceptance Criteria

- [ ] Invalid `expires_at` (e.g., `"not-a-date"`, `""`, `null`) transitions to
      `'expired'` immediately
- [ ] Valid `expires_at` countdown works as before
- [ ] `setCountdownMs(0)` is called before transitioning to expired (shows
      "00:00" before hiding timer)
- [ ] Unit test: set `expires_at` to `"invalid"` → verify `'expired'` state
      transition

## Work Log

- 2026-05-20: Found during edge case analysis of Telegram account linking plan
  review.
