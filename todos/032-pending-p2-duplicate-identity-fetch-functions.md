---
status: pending
priority: p2
issue_id: '032'
tags: [code-review, telegram, dry, api, server-actions]
dependencies: [026]
---

# P2: `getIdentities` and `fetchIdentitiesAction` are functionally duplicated — same endpoint, confusing asymmetry

## Problem Statement

The plan defines two Server Actions for the same endpoint (`GET /api/v1/users/me/identities`):

- `getIdentities()` — returns the full `httpClient` envelope `{ data, status, message, ... }` — intended for SSR in the page Server Component
- `fetchIdentitiesAction()` — returns flat `ProfileIdentity[]` — intended for client-side polling

The asymmetry between their return types is not documented in the function signatures and creates confusion about which to call when. A future developer would not know which to use without reading both implementations. They also diverge in error behavior: `getIdentities()` throws on error (correct for SSR), while `fetchIdentitiesAction()` silently returns `[]` on null data (incorrect — null data means an API error, not an empty list).

## Findings

From `code-simplicity-reviewer`, `architecture-strategist`:

```typescript
// Planned code — two functions, same endpoint
'use server';

// For SSR (Server Component):
export async function getIdentities() {
  return httpClient<ProfileIdentity[]>(`${API_URL}/users/me/identities`);
  // Returns: { data: ProfileIdentity[] | null, status, message, ... }
}

// For polling (Client Component via startTransition):
export async function fetchIdentitiesAction(): Promise<ProfileIdentity[]> {
  const { data } = await httpClient<ProfileIdentity[]>(`${API_URL}/users/me/identities`);
  return data ?? []; // ← null-coalesces to [] — hides API errors
}
```

The second function's `?? []` is also incorrect: if `data` is `null`, the backend returned success with no data — which shouldn't happen for an identity list endpoint. Returning `[]` in this case masks the API contract violation.

## Proposed Solutions

### Option A — Unify into one function, two call patterns (Recommended)

```typescript
'use server';

// Single canonical function — SSR and polling both use this
export async function getIdentities(): Promise<ProfileIdentity[]> {
  const { data } = await httpClient<ProfileIdentity[]>(`${API_URL}/users/me/identities`);
  return data ?? [];
}
```

Usage:
- **SSR page:** `const identities = await getIdentities();` → pass as `initialIdentities` prop
- **Poll hook:** `const identities = await getIdentities();` → same call

The page no longer needs the envelope — it only uses `data`. Both callers get `ProfileIdentity[]` directly.

**Pros:** Single function, single behavior, no asymmetry. Easier to test. Callers are identical.
**Cons:** SSR no longer gets the full envelope (status, message) — but the page only uses `data` anyway.
**Effort:** Small (delete one function, update imports).
**Risk:** Low.

### Option B — Keep both, document the asymmetry with JSDoc

```typescript
/**
 * For SSR: returns full envelope for page Server Components.
 * Use `fetchIdentitiesAction` for client-side polling instead.
 */
export async function getIdentities() { ... }

/**
 * For polling: returns flat array. Throws on network error (re-throw NEXT_REDIRECT).
 */
export async function fetchIdentitiesAction(): Promise<ProfileIdentity[]> { ... }
```

**Pros:** Explicit separation of concerns.
**Cons:** Duplication, diverging behavior, maintenance burden.
**Effort:** None (keep status quo + docs).
**Risk:** Medium (future developer picks wrong function).

## Recommended Action

**Option A.** Unify into `getIdentities(): Promise<ProfileIdentity[]>`. The SSR page reads `initialIdentities = await getIdentities()` and passes it to `TelegramLinkSection`. The poll hook calls `getIdentities()` on each tick. One function, one mental model.

## Technical Details

- **Affected file (planned):** `features/user-profile/api/identities.ts`
- **Functions to merge:** `getIdentities()` + `fetchIdentitiesAction()` → single `getIdentities()`
- **Page change:** `app/dashboard/profile/integrations/page.tsx` — change `const { data: identities } = await getIdentities()` to `const identities = await getIdentities()`
- **Hook change:** `use-telegram-link-poll.ts` — call `getIdentities()` instead of `fetchIdentitiesAction()`

## Acceptance Criteria

- [ ] Only one function exported from `features/user-profile/api/identities.ts` for the identities endpoint
- [ ] Function returns `ProfileIdentity[]` directly (not the envelope)
- [ ] SSR page and poll hook both call the same function
- [ ] No `fetchIdentitiesAction` export exists
- [ ] `npm run lint` passes

## Work Log

- 2026-05-20: Found by code-simplicity-reviewer and architecture-strategist during review of Telegram account linking plan.