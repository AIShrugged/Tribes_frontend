---
status: pending
priority: p1
issue_id: '021'
tags: [code-review, telegram, polling, react, stale-closure, race-condition]
dependencies: []
---

# P1: `isPending` stale closure makes overlap guard in poll hook non-functional

## Problem Statement

`features/user-profile/hooks/use-telegram-link-poll.ts` (planned) uses
`isPending` from `useTransition` inside a recursive `setTimeout` callback as an
overlap guard. Because `isPending` is captured at the time the `useEffect` runs,
it is always `false` inside `poll()` — the closure never reads the updated
value. This means concurrent polls can run simultaneously, causing duplicate
`fetchIdentitiesAction()` calls and potential race conditions where two polls
overlap and the state machine receives interleaved results.

This is a **P1 blocker**: the guard that prevents overlapping polls never fires.
Under slow network conditions (poll interval < round-trip time), multiple
concurrent polls will run simultaneously.

## Findings

From `julik-frontend-races-reviewer`, `kieran-typescript-reviewer`,
`security-sentinel`, `performance-oracle`:

```typescript
// Planned code — BROKEN
const [isPending, startTransition] = useTransition();

useEffect(() => {
  function poll() {
    if (isPending) {
      // ← ALWAYS false — stale closure
      timerId = setTimeout(poll, POLL_INTERVAL_MS);
      return;
    }
    startTransition(async () => {
      /* fetch */
    });
    timerId = setTimeout(poll, POLL_INTERVAL_MS);
  }
  poll();
  return () => {
    stoppedRef.current = true;
    clearTimeout(timerId);
  };
}, [enabled]);
```

`isPending` is read from the closure formed at `useEffect` call time. React's
`useTransition` state updates trigger re-renders, but the `poll` closure inside
`useEffect([enabled])` only re-forms when `enabled` changes — not on every
re-render. So `isPending` is frozen at `false` for the lifetime of the effect.

Additionally, `useTransition` marks the transition as low-priority work, which
means the `'connected'` state update is deferred unnecessarily — adding latency
to the moment the user sees their Telegram is linked.

## Proposed Solutions

### Option A — Replace with `isFetchingRef` (Recommended)

```typescript
'use client';
import { useCallback, useEffect, useRef } from 'react';

export function useTelegramLinkPoll(/* ... */) {
  const isFetchingRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;

    let timerId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stoppedRef.current) return;
      if (isFetchingRef.current) {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      isFetchingRef.current = true;
      try {
        const identities = await fetchIdentitiesAction();
        if (stoppedRef.current) return;
        const linked = identities.find((i) => i.channel === 'telegram');
        if (linked) {
          onConnected(linked);
          return; // stop polling
        }
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (isNextRedirect(error)) throw error; // re-throw 401 redirect
        if (!stoppedRef.current) timerId = setTimeout(poll, POLL_INTERVAL_MS);
      } finally {
        isFetchingRef.current = false;
      }
    }

    poll();
    return () => {
      stoppedRef.current = true;
      clearTimeout(timerId);
    };
  }, [enabled]);
}
```

**Pros:** Correct — synchronous ref update is always current inside closure. No
React re-render coordination needed. Simple. **Cons:** None meaningful — refs
are the canonical solution for mutable values in closures. **Effort:** Small
(replace `useTransition` with `useRef`, update poll function). **Risk:** Low.

### Option B — Keep `useTransition`, read state via callback

Use `flushSync` + stable callback to access current pending state. More complex
with no benefit over Option A.

**Pros:** Keeps `useTransition` API. **Cons:** Much more complex, `flushSync` in
polling is an anti-pattern. **Effort:** Large. **Risk:** High.

## Recommended Action

**Option A.** Remove `useTransition` from the polling hook entirely. Use
`isFetchingRef = useRef(false)` as the overlap guard, reset it in `finally`.
State transitions (`onConnected`, `onExpired`) are called directly — the caller
(`TelegramLinkSection`) updates its own state synchronously.

## Technical Details

- **Affected file (planned):**
  `features/user-profile/hooks/use-telegram-link-poll.ts`
- **Root cause:** `useEffect` dependency array `[enabled]` means the closure
  reforms only when `enabled` changes, not on re-renders. `isPending` is a
  snapshot from the render when the effect last ran.
- **Helper needed:** `isNextRedirect(error)` — check
  `(error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')` before
  re-throwing (see todo 024).

## Acceptance Criteria

- [ ] `useTransition` is removed from `use-telegram-link-poll.ts`
- [ ] `isFetchingRef = useRef(false)` guards concurrent poll invocations
- [ ] `isFetchingRef.current` is reset to `false` in a `finally` block
- [ ] `stoppedRef.current = true` is set in cleanup (before `clearTimeout`)
- [ ] Two concurrent polls never run simultaneously (verifiable via test:
      advance timer before fetch resolves)
- [ ] `npm run lint` passes, no TypeScript errors

## Work Log

- 2026-05-20: Found by julik-frontend-races-reviewer,
  kieran-typescript-reviewer, security-sentinel, performance-oracle during
  review of Telegram account linking plan.
