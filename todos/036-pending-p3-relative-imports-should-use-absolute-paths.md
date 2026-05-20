---
status: pending
priority: p3
issue_id: '036'
tags: [code-review, telegram, imports, conventions]
dependencies: []
---

# P3: Planned files use relative imports — project convention is absolute `@/` paths

## Problem Statement

Several planned file imports in the Telegram linking feature use relative paths (`../model/types`, `../api/telegram-link`) rather than the absolute `@/` alias convention used throughout the project. The `@/*` alias maps to the project root (`./*`). Using relative imports is inconsistent with the project's established convention and makes files harder to move.

## Findings

From `pattern-recognition-specialist`:

Planned hook import:
```typescript
// features/user-profile/hooks/use-telegram-link-poll.ts
import { fetchIdentitiesAction } from '../api/identities'; // ← relative
import type { ProfileIdentity } from '../model/types';     // ← relative
```

Planned component import:
```typescript
// features/user-profile/ui/TelegramLinkSection.tsx
import { generateTelegramLink } from '../api/telegram-link'; // ← relative
import type { TelegramLinkData } from '../model/types';       // ← relative
```

Existing project convention (from every other file in `features/user-profile/`):
```typescript
import { httpClient } from '@/shared/lib/httpClient';
import type { ActionResult } from '@/shared/types/server-action';
// Even within the same feature:
import type { ProfileIdentity } from '@/features/user-profile/model/types';
```

## Proposed Solution

Use absolute `@/` paths for all imports in the new files:

```typescript
// features/user-profile/hooks/use-telegram-link-poll.ts
import { getIdentities } from '@/features/user-profile/api/identities';
import type { ProfileIdentity } from '@/features/user-profile/model/types';
```

```typescript
// features/user-profile/ui/TelegramLinkSection.tsx
import { generateTelegramLink } from '@/features/user-profile/api/telegram-link';
import type { TelegramLinkData } from '@/features/user-profile/model/types';
```

**Effort:** Trivial (find/replace during implementation — don't write relative imports in the first place).

## Acceptance Criteria

- [ ] All new files in `features/user-profile/` use `@/features/user-profile/...` for intra-feature imports
- [ ] No relative `../` imports in `hooks/`, `ui/`, or `api/` files
- [ ] `npm run lint` passes

## Work Log

- 2026-05-20: Found by pattern-recognition-specialist during review of Telegram account linking plan.