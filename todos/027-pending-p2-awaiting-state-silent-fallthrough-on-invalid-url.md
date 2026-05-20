---
status: pending
priority: p2
issue_id: '027'
tags: [code-review, telegram, ux, error-handling, state-machine]
dependencies: [022]
---

# P2: `awaiting` state falls through to `idle` when URL validation fails — no error shown

## Problem Statement

In the planned `TelegramLinkSection.tsx`, the awaiting state renders the Telegram button only when both `linkData` exists AND `validateTelegramUrl(linkData.link_url)` is true. When the URL fails validation, neither branch renders — the component silently shows the `idle` state ("Connect Telegram" button) with no indication to the user that anything went wrong. The user clicks "Connect Telegram", a request is made, and the result is silently discarded.

This is a UX bug: the user has no feedback that the backend returned an invalid link.

## Findings

From `kieran-typescript-reviewer`:

```typescript
// Planned render logic — gap in coverage
function renderAwaiting() {
  if (!linkData) return <Spinner />;
  if (!validateTelegramUrl(linkData.link_url)) {
    // ← FALLS THROUGH — no return, falls to next state check
    // User sees 'idle' UI (Connect button) with no error message
  }
  return (
    <div>
      <a href={linkData.link_url}>Open in Telegram</a>
      {/* countdown */}
    </div>
  );
}
```

The overall render switches on `state`:
```typescript
// if state === 'awaiting' but URL invalid → shows nothing or idle fallback
```

## Proposed Solutions

### Option A — Add explicit error render for invalid URL (Recommended)

```typescript
function renderAwaiting() {
  if (!linkData) return <Spinner />;
  if (!validateTelegramUrl(linkData.link_url)) {
    return (
      <div role="alert" className="text-red-400 text-sm">
        Invalid link received. Please try again.
        <button onClick={handleGenerate} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div>
      <a href={linkData.link_url} target="_blank" rel="noopener noreferrer">
        Open in Telegram
      </a>
      {/* countdown timer */}
    </div>
  );
}
```

**Pros:** User always gets feedback. Retry button lets them try again without page refresh.
**Cons:** None.
**Effort:** Small (3–5 lines).
**Risk:** None.

### Option B — Transition to a new `'error'` state

Add `'error'` to the state machine and transition to it when URL validation fails in `handleGenerate`.

**Pros:** Clean state machine — all error cases represented.
**Cons:** Adds a 5th state; the original plan explicitly avoided more than 4 states. For this edge case, Option A is sufficient.
**Effort:** Medium.
**Risk:** Low.

## Recommended Action

**Option A.** The validation failure case is a backend error scenario — add an inline error message within the `awaiting` render branch. No new state needed.

## Technical Details

- **Affected file (planned):** `features/user-profile/ui/TelegramLinkSection.tsx`
- **Location:** Inside `renderAwaiting()` or equivalent JSX branch for `state === 'awaiting'`
- **Related:** todo 022 (validateTelegramUrl fix — must fix that first so valid URLs are accepted)

## Acceptance Criteria

- [ ] When `validateTelegramUrl` returns `false`, an error message is rendered
- [ ] The error message includes a retry button or clear instruction
- [ ] Error uses `role="alert"` for accessibility
- [ ] User does not see the idle "Connect Telegram" button when in awaiting state with invalid URL
- [ ] Test: mock `generateTelegramLink` to return an invalid URL → verify error message renders

## Work Log

- 2026-05-20: Found by kieran-typescript-reviewer during review of Telegram account linking plan.