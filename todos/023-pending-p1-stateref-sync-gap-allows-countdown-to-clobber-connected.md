---
status: pending
priority: p1
issue_id: '023'
tags: [code-review, telegram, race-condition, react, state-machine, countdown]
dependencies: [021]
---

# P1: `stateRef` synced via `useEffect` — countdown timer can clobber `'connected'` state

## Problem Statement

The planned `TelegramLinkSection.tsx` uses a `stateRef` to let the countdown
`setInterval` callback read current state without re-subscribing to it on every
tick. However, the sync is done via
`useEffect(() => { stateRef.current = state; }, [state])`. React's `useEffect`
runs **after paint**, not synchronously with `setState`. This creates a window
where:

1. Poll callback fires → sets state to `'connected'`
2. React schedules a re-render (async)
3. Countdown `setInterval` fires in the same event loop tick
4. `stateRef.current` still reads `'awaiting'` (effect hasn't run yet)
5. Countdown calls `setState('expired')` — clobbering the `'connected'` result

The user sees a flash of "connected" immediately overwritten by "expired" — or
never sees "connected" at all.

## Findings

From `julik-frontend-races-reviewer`:

```typescript
// Planned code — BROKEN
const [state, setState] = useState<LinkState>('idle');
const stateRef = useRef<LinkState>('idle');

// useEffect fires AFTER paint — stateRef is stale between setState call and next paint
useEffect(() => {
  stateRef.current = state;
}, [state]);

// Countdown runs on setInterval — can fire between setState and useEffect
useEffect(() => {
  const id = setInterval(() => {
    const remaining = /* calculate */;
    if (remaining <= 0 && stateRef.current === 'awaiting') {
      setState('expired'); // ← fires when stateRef still reads 'awaiting'
                           //   even though state was just set to 'connected'
    }
  }, 1000);
  return () => clearInterval(id);
}, [linkData]);
```

This is a classic React timing issue: `useEffect` is not synchronous with state
changes.

## Proposed Solutions

### Option A — Synchronous `transition()` wrapper (Recommended)

Replace `setState` calls throughout the component with a `transition()` function
that updates both `stateRef.current` AND calls `setState` together:

```typescript
const [state, setStateInternal] = useState<LinkState>('idle');
const stateRef = useRef<LinkState>('idle');

// Synchronous wrapper — stateRef is always current before next tick
const transition = useCallback((next: LinkState) => {
  stateRef.current = next;
  setStateInternal(next);
}, []);

// Now countdown correctly reads stateRef.current === 'connected'
// even before the re-render triggered by transition('connected') paints
useEffect(() => {
  const id = setInterval(() => {
    const remaining = /* calculate */;
    if (remaining <= 0 && stateRef.current === 'awaiting') {
      transition('expired');
    }
  }, 1000);
  return () => clearInterval(id);
}, [linkData, transition]);
```

**Pros:** Eliminates the async gap entirely. `stateRef.current` is always
up-to-date before any timer callback runs in the same event loop turn. **Cons:**
Slightly more indirection (all setState calls go through `transition`).
**Effort:** Small. **Risk:** Low.

### Option B — Remove countdown's `setInterval`, drive from `useEffect([state])`

Use `useEffect` to watch `state` and clear the countdown when
`state !== 'awaiting'`:

```typescript
useEffect(() => {
  if (state !== 'awaiting') return;
  const id = setInterval(() => {
    const remaining = /* calculate */;
    if (remaining <= 0) setState('expired');
  }, 1000);
  return () => clearInterval(id);
}, [state, linkData]);
```

**Pros:** Countdown only runs when `state === 'awaiting'`; auto-clears when
state changes. **Cons:** Countdown resets on every re-render when
`state === 'awaiting'` if `linkData` changes. More subtle dependencies.
**Effort:** Small. **Risk:** Low but slightly more reasoning required.

## Recommended Action

**Option A.** The `transition()` wrapper pattern is explicit, easy to audit, and
eliminates the race condition with zero complexity cost. Remove the
`useEffect(() => { stateRef.current = state; }, [state])` sync and delete it
entirely.

## Technical Details

- **Affected file (planned):**
  `features/user-profile/ui/TelegramLinkSection.tsx`
- **Root cause:** React `useEffect` is a commit-phase hook that runs after the
  browser has painted. Synchronous callbacks (setInterval, setTimeout) can fire
  between `setState` and the corresponding `useEffect` flush.
- **All call sites that currently call `setState` must be replaced with
  `transition()`:** `handleGenerate`, poll `onConnected`, countdown expiry
  check, `handleUnlink`.

## Acceptance Criteria

- [ ] `useEffect(() => { stateRef.current = state; }, [state])` is removed
- [ ] `transition(next: LinkState)` sets `stateRef.current = next` AND calls
      `setStateInternal(next)` synchronously
- [ ] All `setState` calls replaced with `transition()`
- [ ] Countdown cannot set state to `'expired'` after `transition('connected')`
      has been called
- [ ] Test: spy on `setState` to confirm `'expired'` is never called after
      `'connected'`

## Work Log

- 2026-05-20: Found by julik-frontend-races-reviewer during review of Telegram
  account linking plan.
