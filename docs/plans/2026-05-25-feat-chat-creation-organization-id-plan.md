---
title: 'feat: Pass organization_id on chat creation'
type: feat
status: active
date: 2026-05-25
---

# feat: Pass organization_id on chat creation

## Enhancement Summary

**Deepened on:** 2026-05-25 **Agents used:** kieran-typescript-reviewer,
security-sentinel, architecture-strategist, code-simplicity-reviewer,
performance-oracle

### Key Improvements Discovered

1. **Silent caller override is a design bug** — cookie value always winning is
   wrong; instead, remove `organization_id` from the create payload type
   entirely, making the contract honest in the type system
2. **`Number()` cast needs an integer guard** — `Number("abc")` → `NaN` →
   serialized as `null` in JSON, silently creating an unbound chat with no error
3. **Test suite will break** — `getOrganizationId()` calls `cookies()` from
   `next/headers`, which throws in jsdom; tests must be updated before merging
4. **Significant dead code exists** — the proposed fix is a half-measure;
   `team_id` and `organization_id` conditional branches in `createChat` are
   never used by any caller
5. **Scope expands slightly** — `features/chat/model/types.ts` and
   `features/chat/api/__tests__/chats.test.ts` also need updates

---

## Overview

When a user creates a new chat from `app/dashboard/chat/page.tsx`, the backend
API call (`POST /api/v1/chats`) does not currently include `organization_id`. As
a result, new chats are created unbound (no organization context), which breaks
organization-scoped features (filtering, team scoping, methodology, etc.).

The fix reads the active organization from the `organization_id` cookie inside
the `createChat` server action via `getOrganizationId()`. Combined with the fix,
a cleanup of existing dead code in `createChat` produces a materially simpler
function.

---

## Problem Statement

### Current behavior

`ChatFormModal` calls `createChat({ title })` — no `organization_id` is passed.

`createChat` in `features/chat/api/chats.ts` conditionally includes payload
fields but never reads the organization cookie itself. The `organization_id`
field on `ChatUpsertDTO` is part of the interface but no caller ever supplies
it.

### Root cause

The form at `features/chat/ui/chat-form-modal.tsx:106-110` builds the submit
payload as:

```typescript
const values = { title: values.title.trim() || null };
await createChat(values); // organization_id absent
```

The only other call site, `DashboardChatPanel`, calls `createChat(null)`.
Neither caller ever passes `organization_id`.

### Supporting evidence

`features/chat/ui/chat-window.tsx:246` already handles
`result.fieldErrors?.organization_id` — indicating the backend expects org
context for chat messaging, and the frontend already anticipates org validation
errors.

---

## Backend Contract (verified)

**Route:** `POST /api/v1/chats`

**Accepted fields (all optional at HTTP level):**

| Field             | Type             | Validation                                       |
| ----------------- | ---------------- | ------------------------------------------------ |
| `title`           | `string \| null` | `nullable`, `string`, `max:255`                  |
| `organization_id` | `number \| null` | `nullable`, `integer`, `exists:organizations,id` |
| `team_id`         | `number \| null` | `nullable`, `integer`, `exists:teams,id`         |

**Business logic (`TenantScopeValidator::assertScopeIsValid()`):**

- Both null → allowed (unbound chat)
- `team_id` provided but `organization_id` null → validation error:
  "Organization is required when team_id is provided"
- `organization_id` provided → user must be member of org, or validation error
- Both provided → team must belong to org AND user must be team member

**Response (`ChatResource`):**
`{ id, title, organization_id, team_id, methodology_id, created_at, updated_at }`
— `organization_id` will be non-null after the fix.

---

## Proposed Solution

Read `organization_id` directly inside the `createChat` server action using
`getOrganizationId()`. Simultaneously, remove the dead conditional body-building
pattern and simplify the function signature, since `organization_id` and
`team_id` are never supplied by any real caller.

**Why Pattern B (internal read) vs Pattern A (prop threading):**

- `ChatFormModal` is `'use client'` — it cannot call `getOrganizationId()`
  directly
- Threading org_id from `ChatPage` → `ChatList` → `ChatFormModal` → server
  action adds 3-4 component hops for a value trivially available on the server
- `features/today-briefing/api/ai-action.ts` establishes this exact pattern
- FSD permits `features/ → shared/` imports; no boundary violation

---

## Implementation

### File 1: `features/chat/model/types.ts`

Introduce a narrower create payload type so the type signature honestly reflects
that `organization_id` is always resolved internally:

```typescript
// Add alongside existing ChatUpsertDTO
export interface ChatCreatePayload {
  title?: string | null;
  // organization_id intentionally absent — always resolved from session cookie
  // team_id intentionally absent — no caller currently uses it on create
}
```

`ChatUpsertDTO` remains unchanged (it is used by `updateChat`, where org_id can
legitimately be supplied).

### File 2: `features/chat/api/chats.ts`

**Current `createChat` (lines 32–67) — simplified view of what exists:**

```typescript
export async function createChat(
  payloadOrTitle: Partial<ChatUpsertDTO> | string | null = {},
): Promise<ActionResult<Chat>> {
  const payload: Partial<ChatUpsertDTO> =
    typeof payloadOrTitle === 'string' || payloadOrTitle === null
      ? { title: payloadOrTitle }
      : payloadOrTitle;

  const body: Record<string, unknown> = {};
  if ('title' in payload) body.title = payload.title;
  if ('organization_id' in payload)
    body.organization_id = payload.organization_id;
  if ('team_id' in payload) body.team_id = payload.team_id;

  // ... httpClient call
}
```

**After fix — complete replacement:**

```typescript
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export async function createChat(
  payload: ChatCreatePayload = {},
): Promise<ActionResult<Chat>> {
  const raw = await getOrganizationId(); // redirects to login if absent
  const organizationId = Number(raw);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error(`Invalid organization_id cookie: "${raw}"`);
  }

  try {
    const { data } = await httpClient<Chat>(`${API_URL}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title ?? null,
        organization_id: organizationId,
      }),
    });
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create chat',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}
```

**Key changes:**

- Signature simplified: `Partial<ChatUpsertDTO> | string | null` →
  `ChatCreatePayload`
- Dead branches removed: `typeof payloadOrTitle === 'string'` ternary,
  `if ('organization_id' in payload)`, `if ('team_id' in payload)`
- `Number.isInteger` guard on cookie value — prevents silent `NaN → null` in
  JSON serialization
- `getOrganizationId()` called before `try` block — fail-fast, redirect fires
  cleanly outside catch

**Call sites to update:**

- `DashboardChatPanel`: `createChat(null)` → `createChat()` (no args, default
  `{}`)
- `ChatFormModal`: `createChat({ title: values.title.trim() || null })` →
  `createChat({ title: values.title.trim() || null })` (already compatible with
  `ChatCreatePayload`)

### File 3: `features/chat/api/__tests__/chats.test.ts`

Add a mock for `getOrganizationId` before all `createChat` tests (required —
without this, every `createChat` test throws because `cookies()` from
`next/headers` is unavailable in jsdom):

```typescript
// At the top of the test file, with other mocks
jest.mock('@/shared/lib/getOrganizationId', () => ({
  getOrganizationId: jest.fn(() => Promise.resolve('42')),
}));
```

Add new test cases:

```typescript
describe('createChat', () => {
  it('includes organization_id from cookie in the POST body', async () => {
    // arrange: mock returns org_id '42'
    const mockFetch = jest
      .fn()
      .mockResolvedValue({ success: true, data: mockChat });
    // assert: httpClient called with body containing organization_id: 42
  });

  it('throws if cookie returns a non-integer string', async () => {
    (getOrganizationId as jest.Mock).mockResolvedValueOnce('abc');
    await expect(createChat()).rejects.toThrow(
      'Invalid organization_id cookie',
    );
  });

  it('works when called with no arguments', async () => {
    const result = await createChat();
    expect(result.error).toBeNull();
  });

  it('works when called with only a title', async () => {
    const result = await createChat({ title: 'My chat' });
    expect(result.error).toBeNull();
  });
});
```

---

## Acceptance Criteria

- [ ] `POST /api/v1/chats` request body includes `organization_id` equal to the
      active organization from the `organization_id` cookie
- [ ] New chats appear scoped to the correct organization when listed/filtered
      by org
- [ ] `Chat.organization_id` in the response is non-null after creation
- [ ] `createChat()` called with no args creates a valid org-scoped chat
      (DashboardChatPanel path)
- [ ] `createChat({ title: '...' })` creates a correctly titled, org-scoped chat
      (ChatFormModal path)
- [ ] Corrupt/non-numeric cookie value throws a programming error (not a silent
      null)
- [ ] Existing `updateChat`, `deleteChat`, `getChats` server actions are
      unaffected
- [ ] All existing `createChat` tests pass with the `getOrganizationId` mock in
      place
- [ ] New tests for cookie inclusion and integer guard pass
- [ ] `npm run lint` and `npm run build` pass without errors

---

## Files Changed

| File                                        | Change                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `features/chat/model/types.ts`              | Add `ChatCreatePayload` interface (without `organization_id` and `team_id`)                           |
| `features/chat/api/chats.ts`                | Simplify `createChat`: new signature, `getOrganizationId()` call, integer guard, remove dead branches |
| `features/chat/api/__tests__/chats.test.ts` | Add `getOrganizationId` mock; add 4 test cases                                                        |
| `features/chat/ui/dashboard-chat-panel.tsx` | `createChat(null)` → `createChat()`                                                                   |

`ChatFormModal` and `ChatList` require no changes.

---

## Out of Scope (Separate Issues)

- **`getChats()` does not filter by org** — chats list shows all user chats
  regardless of active org. This is a separate product decision.
- **`setActiveOrganization` / `selectOrganizationAction` write cookie without
  membership validation** — the backend catches unauthorized org_id, but the
  frontend should validate before writing. A separate security hardening task.
- **No Next.js middleware protecting `/dashboard` routes** — architectural gap
  unrelated to this change.

---

## Performance Notes

- `await getOrganizationId()` calls `await cookies()` from `next/headers` — this
  is an in-memory AsyncLocalStorage lookup with sub-microsecond overhead, not
  I/O
- `httpClient` already calls `getAuthToken()` which also awaits `cookies()` —
  the second lookup is deduplicated by Next.js; no measurable overhead
- `redirect()` in `getOrganizationId()` when called outside a `try` block
  propagates correctly as a `NEXT_REDIRECT` sentinel through the Server Action
  runtime — safe and officially supported

---

## References

### Internal

- Current `createChat`: `features/chat/api/chats.ts:32-67`
- `ChatUpsertDTO`: `features/chat/model/types.ts:11-15`
- `ChatFormModal` submit: `features/chat/ui/chat-form-modal.tsx:106-110`
- `DashboardChatPanel` call site: `features/chat/ui/dashboard-chat-panel.tsx`
- Pattern reference (action reads cookie):
  `features/today-briefing/api/ai-action.ts:16`
- `getOrganizationId()`: `shared/lib/getOrganizationId.ts`
- Org-error handling in chat window: `features/chat/ui/chat-window.tsx:246`

### Backend

- Route: `WandaAsk_backend/routes/api.php:304`
- Controller: `WandaAsk_backend/app/Http/Controllers/API/v1/ChatController.php`
- FormRequest: `WandaAsk_backend/app/Http/Requests/API/v1/ChatRequest.php`
- Resource: `WandaAsk_backend/app/Http/Resources/API/v1/ChatResource.php`
- Scope validator: `WandaAsk_backend/app/Services/TenantScopeValidator.php`
