---
status: pending
priority: p2
issue_id: '029'
tags: [code-review, telegram, polling, security, resource-leak]
dependencies: [021]
---

# P2: No maximum poll attempts guard in hook — poll runs until tab close or token expiry only

## Problem Statement

The plan's security checklist mentions "limit poll to 120 attempts" but the planned `use-telegram-link-poll.ts` implementation does not include `attemptsRef`. The poll will run as long as `enabled === true`, which is until the countdown expires (10 minutes = ~120 polls at 5s interval) or the user navigates away. However if the countdown timer has a bug (see todo 023) or the `expires_at` timestamp is unparseable, the poll could theoretically run indefinitely without a hard stop.

Additionally, there is no explicit resource cleanup if the device goes offline — the poll silently continues making failed fetch calls every 5 seconds.

## Findings

From `security-sentinel`, `architecture-strategist`, `julik-frontend-races-reviewer`, `pattern-recognition-specialist`:

The plan's security checklist states:
> "Limit poll to 120 attempts (10 minutes at 5s interval)"

But the planned hook:
```typescript
export function useTelegramLinkPoll({ enabled, ... }) {
  useEffect(() => {
    // No attemptsRef — no hard stop
    let timerId: ReturnType<typeof setTimeout>;
    async function poll() {
      // ...
      timerId = setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => { clearTimeout(timerId); };
  }, [enabled]);
}
```

## Proposed Solutions

### Option A — Add `attemptsRef` with `MAX_POLL_ATTEMPTS` constant (Recommended)

```typescript
const MAX_POLL_ATTEMPTS = 120; // 10 minutes at 5s interval

export function useTelegramLinkPoll({ enabled, onExpired, ... }) {
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    attemptsRef.current = 0; // reset on each enable
    stoppedRef.current = false;

    async function poll() {
      if (stoppedRef.current) return;
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        onExpired(); // hard stop — treat as expired
        return;
      }
      attemptsRef.current += 1;

      isFetchingRef.current = true;
      try {
        const identities = await fetchIdentitiesAction();
        // ...
      } catch (error) {
        if (isNextRedirect(error)) throw error;
      } finally {
        isFetchingRef.current = false;
        if (!stoppedRef.current) timerId = setTimeout(poll, POLL_INTERVAL_MS);
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

**Pros:** Implements the documented security requirement. Provides a hard stop independent of the countdown timer (defense in depth). Simple to test.
**Cons:** None.
**Effort:** Small (add `attemptsRef`, `MAX_POLL_ATTEMPTS`, increment in poll).
**Risk:** None.

### Option B — Rely on countdown timer alone

Trust that the countdown stops `enabled` before 120 attempts.

**Pros:** Simpler.
**Cons:** Doesn't implement the documented security requirement. Relies on countdown correctness (which has its own bug — see todo 023). No independent safeguard.
**Effort:** None (do nothing).
**Risk:** Medium — if countdown has a bug, poll runs indefinitely.

## Recommended Action

**Option A.** Implement `attemptsRef` as specified in the plan's own security checklist. This is a 5-line addition that closes the gap between the documented spec and the actual implementation.

## Technical Details

- **Affected file (planned):** `features/user-profile/hooks/use-telegram-link-poll.ts`
- **Constant:** `MAX_POLL_ATTEMPTS = 120` (export it so tests can override)
- **On max attempts reached:** call `onExpired()` callback — same as countdown expiry
- **Reset:** `attemptsRef.current = 0` on each `enabled → true` transition (in `useEffect` body before first poll)

## Acceptance Criteria

- [ ] `MAX_POLL_ATTEMPTS = 120` constant defined and exported
- [ ] `attemptsRef = useRef(0)` initialized in hook
- [ ] `attemptsRef.current` incremented before each fetch
- [ ] Poll stops and calls `onExpired()` when attempts >= `MAX_POLL_ATTEMPTS`
- [ ] `attemptsRef.current` resets to 0 on each `enabled` flip
- [ ] Test: fast-forward past 120 ticks → verify `onExpired` called and poll stops

## Work Log

- 2026-05-20: Found by security-sentinel, architecture-strategist, julik-frontend-races-reviewer, pattern-recognition-specialist during review of Telegram account linking plan. The security checklist in the plan itself documents this requirement, but the implementation steps don't include it.