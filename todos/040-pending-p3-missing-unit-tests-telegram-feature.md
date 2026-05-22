---
status: pending
priority: p3
issue_id: '040'
tags: [code-review, telegram, testing, jest, rtl]
dependencies: [021, 022, 023, 024, 029]
---

# P3: 20+ missing unit tests identified for Telegram account linking feature

## Problem Statement

The unit-test-booster review agent identified 20+ unit tests that should be
written for the planned Telegram account linking feature. These cover state
machine transitions, server action error handling, polling hook correctness, SSR
page rendering, and edge cases including the P1 bugs (todos 021–026). Writing
tests should happen after P1 bugs are fixed.

## Findings

From `unit-test-booster`:

### State machine tests — `TelegramLinkSection.tsx`

1. `idle` state renders "Connect Telegram" button
2. Clicking "Connect Telegram" transitions to `awaiting` and shows spinner
3. `awaiting` state renders Telegram deep link button and countdown when link
   data is valid
4. `awaiting` + invalid URL shows error message and retry button (after todo 027
   fix)
5. Countdown reaches 0 → transitions to `expired` state
6. `expired` state renders "Link expired" message and "Get New Link" button
7. `connected` state renders green checkmark and "Connected" label
8. "Disconnect" button in `connected` state calls `unlinkIdentity` and
   transitions to `idle`
9. `handleGenerate` error → shows `toast.error` and stays in `idle`
10. `handleUnlink` error → shows `toast.error` and stays in `connected`
11. Double-clicking "Connect Telegram" calls `generateTelegramLink` only once
    (after todo 030 fix)

### Poll hook tests — `use-telegram-link-poll.ts`

12. Poll calls `getIdentities` on interval when `enabled = true`
13. Poll stops when `stoppedRef.current = true` (effect cleanup)
14. Poll stops when identity with `channel === 'telegram'` is found → calls
    `onConnected`
15. Poll does not run concurrent fetches (`isFetchingRef` guard — after todo 021
    fix)
16. NEXT_REDIRECT error propagates (not swallowed — after todo 024 fix)
17. Generic fetch error → poll continues (next timeout scheduled)
18. `enabled` toggles `false` → poll stops; `true` again → poll resumes (after
    todo 038 fix)
19. `attemptsRef` reaches `MAX_POLL_ATTEMPTS` → calls `onExpired` (after todo
    029 fix)

### Server action tests — `features/user-profile/api/`

20. `generateTelegramLink()` — success → returns
    `{ data: TelegramLinkData, error: null }`
21. `generateTelegramLink()` — 409 conflict → returns
    `{ data: null, error: 'already linked' }`
22. `generateTelegramLink()` — invalid response shape (after todo 037 fix) →
    returns error
23. `unlinkIdentity(id)` — success → returns `{ data: undefined, error: null }`
    and revalidates path
24. `unlinkIdentity(id)` — 403 → returns
    `{ data: null, error: 'You can only unlink...' }`
25. `unlinkIdentity(id)` — 404 → returns
    `{ data: null, error: 'Identity not found.' }`
26. `unlinkIdentity(id)` — invalid `profileId` (0, negative, NaN) → returns
    validation error

### SSR page tests — `app/dashboard/profile/integrations/page.tsx`

27. Renders with `telegramIdentity = null` → passes `null` to
    `TelegramLinkSection`
28. Renders with `telegramIdentity` present → passes identity to
    `TelegramLinkSection`

### Edge case tests

29. `validateTelegramUrl('https://evil.me/bot')` returns false (after todo 022
    fix)
30. `validateTelegramUrl('https://t.me/bot?start=abc')` returns true
31. `formatMmSs(NaN)` returns `'00:00'` (after todo 034 fix)
32. `formatMmSs(65000)` returns `'01:05'`
33. Countdown with invalid `expires_at` string → transitions to `expired` (after
    todo 035 fix)

## Test Infrastructure Notes

- **Mock pattern for Server Actions in hooks:**
  `jest.mock('@/features/user-profile/api/identities')` then
  `(getIdentities as jest.Mock).mockResolvedValue([...])`
- **Timer control:** `jest.useFakeTimers()` + `jest.advanceTimersByTime(5000)`
  for poll interval tests
- **Common mocks:** `framer-motion`, `sonner`, `next/navigation` — see project
  jest setup
- **Async hook testing:** Use `@testing-library/react`'s `act` + `waitFor` for
  async state updates
- **SSR page:** `render(await IntegrationsPage())` — awaiting async Server
  Component

## Recommended Approach

Implement tests in dependency order:

1. Fix P1 bugs (todos 021–026) first
2. Fix P2 bugs (todos 027–033)
3. Write utility tests (validate, formatMmSs) — no dependencies
4. Write server action tests — mock `httpClient`
5. Write hook tests — mock server actions, use fake timers
6. Write component tests — mock hook + server actions
7. Write SSR page test — mock `getIdentities`

## Acceptance Criteria

- [ ] At minimum, tests 12–19 (poll hook) and 20–26 (server actions) are
      implemented
- [ ] Tests 1–11 (state machine) implemented after P1/P2 bug fixes
- [ ] `npm test` passes with new test files
- [ ] Coverage threshold maintained (currently: branches 20%, functions 24%,
      lines 23%, statements 22%)

## Work Log

- 2026-05-20: 20+ test cases identified by unit-test-booster during review of
  Telegram account linking plan. Tests should be written after P1 fixes are
  complete.
