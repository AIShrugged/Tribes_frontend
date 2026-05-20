---
status: pending
priority: p2
issue_id: '028'
tags: [code-review, telegram, error-handling, typescript]
dependencies: []
---

# P2: `ServerError` constructed with `status: 200` in error paths — semantically incorrect

## Problem Statement

In the planned `features/user-profile/api/identities.ts`, the `unlinkIdentity` action constructs a `ServerError` with `status: 200` to represent backend errors (403, 404). This is semantically wrong: a `ServerError` with status 200 implies the request succeeded, which contradicts the error condition being reported. Downstream error handling that uses `error.status` to determine response type or log severity would misclassify these failures as successes.

## Findings

From `kieran-typescript-reviewer`:

```typescript
// Planned code
export async function unlinkIdentity(profileId: number): Promise<ActionResult<void>> {
  try {
    await httpClient<void>(`${API_URL}/users/me/identities/${profileId}`, {
      method: 'DELETE',
    });
    revalidatePath(ROUTES.DASHBOARD.PROFILE_INTEGRATIONS);
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        return { data: null, error: 'You can only unlink your own identities.' };
      }
      if (error.status === 404) {
        return { data: null, error: 'Identity not found.' };
      }
      return { data: null, error: parseApiError(error.responseBody ?? '', 'Failed to unlink Telegram').message };
    }
    // This branch was planned to create a new ServerError with status: 200 ← WRONG
    return { data: null, error: new ServerError('Unexpected error', 200, '', '').message };
  }
}
```

The `ServerError` constructor used in non-`ServerError` catch branches creates an error object claiming HTTP 200, which is misleading. The `message` property pulled from it would be generic anyway.

## Proposed Solutions

### Option A — Use a plain string message for non-ServerError cases (Recommended)

```typescript
} catch (error) {
  if (error instanceof ServerError) {
    if (error.status === 403) return { data: null, error: 'You can only unlink your own identities.' };
    if (error.status === 404) return { data: null, error: 'Identity not found.' };
    return { data: null, error: parseApiError(error.responseBody ?? '', 'Failed to unlink Telegram').message };
  }
  // Re-throw truly unexpected errors (network failures, NEXT_REDIRECT, etc.)
  throw error;
}
```

**Pros:** Correct semantics — `ServerError` is only used when the server actually returned an HTTP error. Unexpected errors (JS runtime errors, redirect throws) are re-thrown rather than silently converted.
**Cons:** None.
**Effort:** Trivial.
**Risk:** None.

### Option B — Add a guard for NEXT_REDIRECT, then re-throw everything else

```typescript
} catch (error) {
  if (error instanceof ServerError) { /* ... */ }
  if (isNextRedirect(error)) throw error; // see todo 024
  throw error; // always re-throw unknown errors
}
```

**Pros:** Explicit about what re-throwing covers.
**Cons:** Redundant — `throw error` handles both cases.
**Effort:** Trivial.
**Risk:** None.

## Recommended Action

**Option A.** Remove the `new ServerError(..., 200, ...)` construction entirely. Re-throw non-`ServerError` exceptions from `unlinkIdentity`. Only `ServerError` instances (thrown by `httpClient`) should be caught and converted to `ActionResult` errors.

## Technical Details

- **Affected file (planned):** `features/user-profile/api/identities.ts`
- **Function:** `unlinkIdentity`
- **`ServerError` constructor signature:** `new ServerError(message, status, url, responseBody)`
- **Rule:** `ServerError` status must reflect the actual HTTP status code from the backend response

## Acceptance Criteria

- [ ] No `new ServerError(..., 200, ...)` appears in `api/` files
- [ ] Non-`ServerError` exceptions in `unlinkIdentity` are re-thrown (not swallowed)
- [ ] `unlinkIdentity` still returns `ActionResult` for 403 and 404 `ServerError` cases
- [ ] Test: mock `httpClient` to throw a generic `Error` → verify it propagates (not swallowed)

## Work Log

- 2026-05-20: Found by kieran-typescript-reviewer during review of Telegram account linking plan.