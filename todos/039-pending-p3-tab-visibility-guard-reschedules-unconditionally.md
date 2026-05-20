---
status: pending
priority: p3
issue_id: '039'
tags: [code-review, telegram, performance, browser-api, polling]
dependencies: [021]
---

# P3: Tab-visibility optimization reschedules poll unconditionally — needs `visibilitychange` listener

## Problem Statement

The plan mentions "pause polling when tab is hidden" as a performance optimization. The planned implementation checks `document.visibilityState === 'hidden'` inside the `poll()` function and schedules the next poll (reschedules anyway) rather than pausing. This means the timer is still firing every 5 seconds even when the tab is hidden — it just doesn't fetch. The actual optimization (not scheduling at all when hidden) requires a `visibilitychange` listener to resume polling when the tab becomes visible again.

This is a P3 nice-to-have. The current plan's implementation partially solves the problem (skips the fetch) but doesn't eliminate the timer firing.

## Findings

From `julik-frontend-races-reviewer`:

```typescript
// Planned code — reschedules even when hidden
async function poll() {
  if (document.visibilityState === 'hidden') {
    timerId = setTimeout(poll, POLL_INTERVAL_MS); // ← still fires every 5s
    return;
  }
  // ...fetch...
  timerId = setTimeout(poll, POLL_INTERVAL_MS);
}
```

**Correct behavior:** When tab is hidden, cancel the timer entirely. When tab becomes visible again, immediately poll + restart the interval.

## Proposed Solution

```typescript
useEffect(() => {
  if (!enabled) return;
  stoppedRef.current = false;

  let timerId: ReturnType<typeof setTimeout>;

  function schedulePoll() {
    if (stoppedRef.current) return;
    if (document.visibilityState === 'hidden') return; // don't schedule when hidden
    timerId = setTimeout(poll, POLL_INTERVAL_MS);
  }

  async function poll() {
    if (stoppedRef.current) return;
    isFetchingRef.current = true;
    try {
      const identities = await fetchIdentitiesAction();
      // ...check connected...
    } catch (error) {
      if (isNextRedirect(error)) throw error;
    } finally {
      isFetchingRef.current = false;
      schedulePoll();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      poll(); // resume immediately when tab becomes visible
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  poll(); // start immediately

  return () => {
    stoppedRef.current = true;
    clearTimeout(timerId);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}, [enabled]);
```

**Effort:** Small (restructure scheduling, add event listener + cleanup).

## Acceptance Criteria

- [ ] No `setTimeout` calls are made while `document.visibilityState === 'hidden'`
- [ ] When tab becomes visible, poll fires immediately (no 5s wait)
- [ ] `visibilitychange` listener is removed in effect cleanup
- [ ] Test: hide tab (mock `visibilityState`) → verify no additional timers scheduled; show tab → verify immediate poll

## Work Log

- 2026-05-20: Found by julik-frontend-races-reviewer during review of Telegram account linking plan.