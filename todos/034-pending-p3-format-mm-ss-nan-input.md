---
status: pending
priority: p3
issue_id: '034'
tags: [code-review, telegram, edge-case, formatting]
dependencies: []
---

# P3: `formatMmSs(NaN)` returns "NaN:NaN" — needs `Number.isFinite` guard

## Problem Statement

The planned `formatMmSs` helper in `TelegramLinkSection.tsx` uses `Math.max(0, ms)` to clamp negative values, but `Math.max(0, NaN)` returns `NaN`, not `0`. If `expires_at` cannot be parsed as a date (see todo 035 for unparseable `expires_at`), the remaining time calculation would produce `NaN`, and `formatMmSs(NaN)` would render "NaN:NaN" in the countdown — visible to the user.

## Findings

From `kieran-typescript-reviewer`:

```typescript
// Planned code — no NaN guard
function formatMmSs(ms: number): string {
  const clamped = Math.max(0, ms); // Math.max(0, NaN) === NaN
  const m = Math.floor(clamped / 60_000); // NaN
  const s = Math.floor((clamped % 60_000) / 1000); // NaN
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; // "NaN:NaN"
}
```

## Proposed Solution

```typescript
function formatMmSs(ms: number): string {
  if (!Number.isFinite(ms)) return '00:00';
  const clamped = Math.max(0, ms);
  const m = Math.floor(clamped / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

**Effort:** Trivial (1 line).

## Acceptance Criteria

- [ ] `formatMmSs(NaN)` returns `'00:00'`
- [ ] `formatMmSs(Infinity)` returns `'00:00'`
- [ ] `formatMmSs(-1000)` returns `'00:00'`
- [ ] `formatMmSs(65000)` returns `'01:05'`
- [ ] Unit test covers NaN and negative cases

## Work Log

- 2026-05-20: Found by kieran-typescript-reviewer during review of Telegram account linking plan.