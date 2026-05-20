---
status: pending
priority: p2
issue_id: '033'
tags: [code-review, telegram, imports, lint]
dependencies: []
---

# P2: `parseApiError` imported but unused in parts of `identities.ts` — lint error

## Problem Statement

The planned `features/user-profile/api/identities.ts` imports `parseApiError` from `@/shared/lib/apiError` but the function is inconsistently used: some error branches use it, others return plain strings. In some plan code excerpts, `parseApiError` is imported but not called at all (the error message is hardcoded inline). This will cause an ESLint `no-unused-vars` / `@typescript-eslint/no-unused-vars` lint error and a pre-commit hook failure.

## Findings

From `architecture-strategist`:

```typescript
// Planned code — inconsistency
'use server';
import { parseApiError } from '@/shared/lib/apiError'; // ← imported

export async function unlinkIdentity(profileId: number): Promise<ActionResult<void>> {
  try {
    // ...
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        return { data: null, error: 'You can only unlink your own identities.' }; // ← plain string
      }
      if (error.status === 404) {
        return { data: null, error: 'Identity not found.' }; // ← plain string
      }
      return { data: null, error: parseApiError(error.responseBody ?? '', '...').message }; // ← used here
    }
    throw error;
  }
}
```

In some plan excerpts only the hardcoded strings are used, making `parseApiError` unused entirely.

## Proposed Solutions

### Option A — Use `parseApiError` consistently or remove the import (Recommended)

**If keeping `parseApiError` for the fallback case:**

```typescript
import { parseApiError } from '@/shared/lib/apiError';

// Used for the generic ServerError fallback:
return { data: null, error: parseApiError(error.responseBody ?? '', 'Failed to unlink Telegram').message };
```

Ensure this branch is present and `parseApiError` is called at least once.

**If all error messages are known (403 and 404 are the only cases):**

```typescript
// Remove import entirely, use plain strings for all cases:
// import { parseApiError } from '@/shared/lib/apiError'; ← DELETE

export async function unlinkIdentity(...) {
  // ...
  if (error instanceof ServerError) {
    if (error.status === 403) return { data: null, error: 'You can only unlink your own identities.' };
    if (error.status === 404) return { data: null, error: 'Identity not found.' };
    return { data: null, error: error.message || 'Failed to unlink Telegram.' };
  }
}
```

**Pros:** No unused import. ESLint clean.
**Cons:** Slightly less structured error message for unexpected status codes.
**Effort:** Trivial.
**Risk:** None.

## Recommended Action

Use `parseApiError` for the generic ServerError fallback and ensure the import is needed. If the fallback uses `error.message` directly, remove the import. Either way is fine — the key is consistency so lint passes.

## Technical Details

- **Affected file (planned):** `features/user-profile/api/identities.ts`
- **Import:** `import { parseApiError } from '@/shared/lib/apiError'`
- **ESLint rule:** `@typescript-eslint/no-unused-vars` — blocks pre-commit

## Acceptance Criteria

- [ ] No unused imports in `features/user-profile/api/identities.ts`
- [ ] If `parseApiError` is imported, it is called at least once
- [ ] If `parseApiError` is not needed, the import is removed
- [ ] `npm run lint` passes with no warnings on this file

## Work Log

- 2026-05-20: Found by architecture-strategist during review of Telegram account linking plan.