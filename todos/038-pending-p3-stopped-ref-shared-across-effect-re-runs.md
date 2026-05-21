---
status: pending
priority: p3
issue_id: '038'
tags: [code-review, telegram, race-condition, react, hooks]
dependencies: [021]
---

# P3: `stoppedRef` shared across effect re-runs — enable/disable toggle race condition

## Problem Statement

The planned `use-telegram-link-poll.ts` uses a single
`stoppedRef = useRef(false)` that is never reset between effect re-runs. If
`enabled` toggles from `true → false → true`, the cleanup sets
`stoppedRef.current = true`, but when the next effect run starts,
`stoppedRef.current` is still `true` from the previous cleanup. The new poll
immediately exits on the first `if (stoppedRef.current) return;` check, making
it a no-op.

In practice this scenario may not occur in the Telegram linking UX (the
component is mounted once per session), but the bug is latent if the component
is reused or if `enabled` is derived from reactive state.

## Findings

From `julik-frontend-races-reviewer`:

```typescript
// Planned code
const stoppedRef = useRef(false); // persists across effect re-runs

useEffect(() => {
  if (!enabled) return;
  // stoppedRef.current might be true from previous effect cleanup!
  // ← MISSING: stoppedRef.current = false;

  async function poll() {
    if (stoppedRef.current) return; // exits immediately on second enable
    // ...
  }
  poll();
  return () => {
    stoppedRef.current = true; // set on cleanup
    clearTimeout(timerId);
  };
}, [enabled]);
```

## Proposed Solution

Reset `stoppedRef.current = false` at the top of the effect body (after the
`!enabled` guard):

```typescript
useEffect(() => {
  if (!enabled) return;
  stoppedRef.current = false; // ← reset for this run
  attemptsRef.current = 0; // also reset attempts (see todo 029)

  let timerId: ReturnType<typeof setTimeout>;

  async function poll() {
    if (stoppedRef.current) return;
    // ...
  }

  poll();
  return () => {
    stoppedRef.current = true;
    clearTimeout(timerId);
  };
}, [enabled]);
```

**Effort:** 1 line.

## Acceptance Criteria

- [ ] `stoppedRef.current = false` is set at the top of the effect body (after
      `if (!enabled) return`)
- [ ] Test: toggle `enabled` `true → false → true` → verify poll runs on second
      enable

## Work Log

- 2026-05-20: Found by julik-frontend-races-reviewer during review of Telegram
  account linking plan.
