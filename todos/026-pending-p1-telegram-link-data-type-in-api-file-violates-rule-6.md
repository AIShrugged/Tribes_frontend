---
status: pending
priority: p1
issue_id: '026'
tags: [code-review, telegram, fsd, architecture, types, claude-md-rule]
dependencies: []
---

# P1: `TelegramLinkData` interface defined in `api/` file — violates CLAUDE.md Rule 6

## Problem Statement

The plan defines `TelegramLinkData` interface inside `features/user-profile/api/telegram-link.ts`. CLAUDE.md Rule 6 is explicit: "Never define types inside `api/` files. All interfaces and types go in `features/<name>/model/types.ts`." The custom ESLint rule `use-server-in-api` enforces `'use server'` in api/ files; any type defined there is technically a server-only type, which prevents it from being imported by client components that need the shape for props or rendering.

This also creates a concrete bug: `TelegramLinkSection.tsx` (a Client Component) would need to import `TelegramLinkData` from the api/ file. Server Action files cannot be imported by Client Components for type-only imports in all Next.js configurations — the `'use server'` directive prevents tree-shaking from isolating the type.

## Findings

From `architecture-strategist`, `kieran-typescript-reviewer`, `code-simplicity-reviewer`, `pattern-recognition-specialist`:

```typescript
// Planned code — WRONG location
// features/user-profile/api/telegram-link.ts
'use server';

interface TelegramLinkData {  // ← defined in api/ file
  link_url: string;
  expires_at: string;
}

export async function generateTelegramLink(): Promise<ActionResult<TelegramLinkData>> {
  // ...
}
```

```typescript
// TelegramLinkSection.tsx (Client Component) then needs:
import type { TelegramLinkData } from '../api/telegram-link'; // ← importing from 'use server' file
```

## Proposed Solutions

### Option A — Move to `features/user-profile/model/types.ts` (Recommended)

```typescript
// features/user-profile/model/types.ts
export interface TelegramLinkData {
  link_url: string;
  expires_at: string;
}
```

```typescript
// features/user-profile/api/telegram-link.ts
'use server';
import type { TelegramLinkData } from '../model/types';

export async function generateTelegramLink(): Promise<ActionResult<TelegramLinkData>> {
  // ...
}
```

```typescript
// TelegramLinkSection.tsx
import type { TelegramLinkData } from '../model/types'; // ← clean import from model/
```

**Pros:** Follows CLAUDE.md Rule 6 exactly. Type is accessible to both Client and Server Components. Consistent with all other feature types in the project.
**Cons:** None.
**Effort:** Trivial (move definition, update imports).
**Risk:** None.

### Option B — Inline the type in the component

Don't export `TelegramLinkData` at all — define it locally in `TelegramLinkSection.tsx` and use a generic `ActionResult<{ link_url: string; expires_at: string }>` in the server action.

**Pros:** One fewer exported type.
**Cons:** Type duplication between api/ and component. Loss of single source of truth for the API response shape.
**Effort:** Trivial.
**Risk:** Low but creates maintenance burden.

## Recommended Action

**Option A.** Move `TelegramLinkData` to `features/user-profile/model/types.ts`. Update the plan to reflect this. The `features/user-profile/model/types.ts` file also needs to gain `TelegramLinkData` while losing the old `Identity` interface (which migrates to `entities/user/`).

Final state of `features/user-profile/model/types.ts`:
```typescript
// Remove: Identity (migrated to entities/user/)
// Add: TelegramLinkData
export interface TelegramLinkData {
  link_url: string;
  expires_at: string;
}
```

## Technical Details

- **Wrong location (planned):** `features/user-profile/api/telegram-link.ts`
- **Correct location:** `features/user-profile/model/types.ts`
- **CLAUDE.md Rule 6:** "Never define types inside `api/` files."
- **Files that will import `TelegramLinkData`:**
  - `features/user-profile/api/telegram-link.ts` (as return type)
  - `features/user-profile/ui/TelegramLinkSection.tsx` (for state and props)
  - `features/user-profile/hooks/use-telegram-link-poll.ts` (for callback typing)

## Acceptance Criteria

- [ ] `TelegramLinkData` is NOT defined in any `api/` file
- [ ] `TelegramLinkData` is exported from `features/user-profile/model/types.ts`
- [ ] `features/user-profile/api/telegram-link.ts` imports `TelegramLinkData` from `../model/types`
- [ ] `TelegramLinkSection.tsx` imports `TelegramLinkData` from `../model/types`
- [ ] `npm run lint` passes (custom `use-server-in-api` rule clean)
- [ ] `npm run build` passes

## Work Log

- 2026-05-20: Found by architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist during review of Telegram account linking plan.