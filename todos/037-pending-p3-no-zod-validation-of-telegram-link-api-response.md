---
status: pending
priority: p3
issue_id: '037'
tags: [code-review, telegram, validation, zod, api]
dependencies: []
---

# P3: No Zod validation of `POST /telegram/link` API response — `link_url` and `expires_at` trusted as-is

## Problem Statement

The planned `generateTelegramLink()` Server Action returns the `data` object
from `httpClient` and casts it as `TelegramLinkData` without Zod parsing. If the
backend returns a response with missing or wrongly-typed fields (e.g.,
`link_url: null`, `expires_at: 0`), the TypeScript type assertion provides no
runtime safety — the component would receive invalid data and potentially
display garbage or crash.

This is a P3 since the backend is trusted, but Zod parsing is the project's
defense-in-depth strategy for API responses (per `ts-strict.md` skill).

## Findings

From `unit-test-booster` (test case analysis), `kieran-typescript-reviewer`
(implicit):

```typescript
// Planned code — no runtime validation
export async function generateTelegramLink(): Promise<
  ActionResult<TelegramLinkData>
> {
  try {
    const { data } = await httpClient<TelegramLinkData>(
      `${API_URL}/telegram/link`,
      {
        method: 'POST',
      },
    );
    if (!data) return { data: null, error: 'No link data returned.' };
    return { data, error: null }; // ← data is cast, not parsed
  } catch (error) {
    // ...
  }
}
```

The `data` object is typed as `TelegramLinkData` by the generic
`httpClient<TelegramLinkData>` — but this is just a TypeScript cast. At runtime,
`data.link_url` could be `undefined` if the backend changes its response shape.

## Proposed Solution

Add a Zod schema in `features/user-profile/model/schemas.ts`:

```typescript
// features/user-profile/model/schemas.ts
import { z } from 'zod';

export const TelegramLinkDataSchema = z.object({
  link_url: z.string().min(1),
  expires_at: z.string().min(1), // ISO 8601 string
});
```

```typescript
// features/user-profile/api/telegram-link.ts
import { TelegramLinkDataSchema } from '@/features/user-profile/model/schemas';

export async function generateTelegramLink(): Promise<
  ActionResult<TelegramLinkData>
> {
  try {
    const { data } = await httpClient<unknown>(`${API_URL}/telegram/link`, {
      method: 'POST',
    });
    const parsed = TelegramLinkDataSchema.safeParse(data);
    if (!parsed.success)
      return { data: null, error: 'Invalid link data from server.' };
    return { data: parsed.data, error: null };
  } catch (error) {
    // ...
  }
}
```

**Note:** Zod v4 syntax (project uses v4): `z.string().min(1)` is unchanged from
v3 for `min()`.

**Effort:** Small (add schema file, update server action).

## Acceptance Criteria

- [ ] `TelegramLinkDataSchema` defined in
      `features/user-profile/model/schemas.ts`
- [ ] `generateTelegramLink()` uses `TelegramLinkDataSchema.safeParse(data)`
- [ ] Missing `link_url` or `expires_at` → returns
      `{ data: null, error: '...' }`
- [ ] Valid response → returns parsed and typed data
- [ ] Unit test: mock `httpClient` to return `{ data: { link_url: null } }` →
      verify error returned

## Work Log

- 2026-05-20: Found during test case analysis in review of Telegram account
  linking plan.
