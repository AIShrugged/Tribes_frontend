---
status: pending
priority: p1
issue_id: '024'
tags: [code-review, telegram, polling, next.js, error-handling, authentication]
dependencies: [021]
---

# P1: `NEXT_REDIRECT` thrown by `httpClient` on 401 is swallowed in poll catch block

## Problem Statement

The planned polling hook catches errors from `fetchIdentitiesAction()` and schedules the next poll tick regardless of the error type. When the user's Sanctum token expires, `httpClient` calls `redirect('/login')` internally, which throws a special `NEXT_REDIRECT` error (an object with `digest: 'NEXT_REDIRECT;...'`). If this error is caught by a bare `catch` and swallowed, the redirect never happens — the poll continues silently, the user remains on the profile page in a broken authenticated state, and every subsequent poll throws the same redirect error indefinitely.

This is a P1 because it prevents proper session expiry handling and causes the poll to loop forever on 401.

## Findings

From `julik-frontend-races-reviewer`, `architecture-strategist`:

```typescript
// Planned code — BROKEN
async function poll() {
  // ...
  try {
    const identities = await fetchIdentitiesAction();
    // ...
  } catch {
    // ← swallows EVERYTHING including NEXT_REDIRECT
    if (!stoppedRef.current) timerId = setTimeout(poll, POLL_INTERVAL_MS);
  }
}
```

`httpClient` in `shared/lib/httpClient.ts` handles 401 responses by calling Next.js `redirect()`. In Server Actions (which `fetchIdentitiesAction` is), `redirect()` throws an object recognized by the Next.js runtime via its `digest` property. This error must be allowed to propagate to the Next.js runtime to trigger the actual redirect.

## Proposed Solutions

### Option A — Check digest before re-scheduling (Recommended)

```typescript
function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

// In poll():
} catch (error) {
  if (isNextRedirect(error)) throw error; // let Next.js handle the redirect
  if (!stoppedRef.current) timerId = setTimeout(poll, POLL_INTERVAL_MS);
}
```

**Pros:** Correct semantics — only non-redirect errors are retried. Next.js redirect works as designed.
**Cons:** Relies on internal Next.js `digest` string format. If Next.js changes the format, the check silently fails (but fails safe — `isNextRedirect` returns false, error is swallowed rather than crash). A version bump check in `package.json` can alert to this.
**Effort:** Small.
**Risk:** Low.

### Option B — Import `isRedirectError` from `next/dist/client/components/redirect`

```typescript
import { isRedirectError } from 'next/dist/client/components/redirect';

} catch (error) {
  if (isRedirectError(error)) throw error;
  // ...
}
```

**Pros:** Uses Next.js internal utility — doesn't depend on string format.
**Cons:** Imports from `next/dist/...` (internal path — may break on Next.js upgrades).
**Effort:** Trivial.
**Risk:** Medium (internal import).

### Option C — Wrap with typed error class in `httpClient`

Modify `httpClient` to throw a typed `AuthExpiredError` instead of calling `redirect()` directly, and catch `AuthExpiredError` specifically in the poll hook.

**Pros:** Clean typed error hierarchy.
**Cons:** Requires modifying `shared/lib/httpClient.ts` which affects all features.
**Effort:** Medium.
**Risk:** Medium (cross-cutting change).

## Recommended Action

**Option A** with `isNextRedirect` extracted to `shared/lib/errors.ts` so all polling hooks can import and use it. The digest format has been stable across Next.js 13–16.

## Technical Details

- **Affected file (planned):** `features/user-profile/hooks/use-telegram-link-poll.ts`
- **Source of NEXT_REDIRECT:** `next/navigation`'s `redirect()` function, called inside `httpClient` on 401 response
- **Confirmed by:** `shared/lib/httpClient.ts` — check the 401 handling branch
- **Related:** `docs/solutions/integration-issues/server-action-html-response-json-parse.md` — same category of "Server Action error semantics"

## Acceptance Criteria

- [ ] `isNextRedirect(error)` helper exists in `shared/lib/errors.ts`
- [ ] Poll catch block re-throws if `isNextRedirect(error)` is true
- [ ] Poll does NOT schedule next tick when a redirect is thrown
- [ ] Test: mock `fetchIdentitiesAction` to throw a `NEXT_REDIRECT` error → verify poll stops and error propagates
- [ ] Test: mock `fetchIdentitiesAction` to throw a generic `Error` → verify poll continues

## Work Log

- 2026-05-20: Found by julik-frontend-races-reviewer and architecture-strategist during review of Telegram account linking plan.