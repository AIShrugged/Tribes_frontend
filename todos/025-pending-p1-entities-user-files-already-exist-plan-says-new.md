---
status: pending
priority: p1
issue_id: '025'
tags: [code-review, telegram, entities, plan-error, breaking-change]
dependencies: []
---

# P1: Plan incorrectly labels `entities/user/` files as "new" — implementing as written will overwrite existing types

## Problem Statement

The Telegram account linking plan (Phase 1, Implementation Step 1) instructs the implementer to CREATE `entities/user/model/types.ts` and `entities/user/index.ts` as new files. Both files already exist and export 6 types used across 13+ files in the codebase. Executing the plan as written would overwrite `UserProps`, `UserBasicProps`, `Theme`, `UserPreferences`, `UserMenuPreferences`, and `MenuItemPreference` — breaking every file that imports from `@/entities/user`.

This is a P1 blocker for the plan itself: it documents incorrect implementation steps that would cause a codebase-wide breaking change.

## Findings

From `architecture-strategist`, `pattern-recognition-specialist`:

**What the plan says:**
```
Phase 1 — Foundation
Step 1: Create entities/user/model/types.ts  ← says "Create"
Step 2: Create entities/user/index.ts        ← says "Create"
```

**What actually exists:**
```typescript
// entities/user/model/types.ts — ALREADY EXISTS with:
export interface UserProps { ... }
export interface UserBasicProps { ... }
export type Theme = 'dark' | 'light';
export interface UserPreferences { ... }
export interface UserMenuPreferences { ... }
export interface MenuItemPreference { ... }

// entities/user/index.ts — ALREADY EXISTS with:
export type { UserProps, UserBasicProps, Theme, UserPreferences, UserMenuPreferences, MenuItemPreference };
```

Additionally, the plan incorrectly lists `ChannelType` as a new export in `entities/user/model/types.ts`, but the Enhancement Summary of the deepened plan explicitly says `ChannelType` was removed as YAGNI. This is a contradiction within the plan itself (see todo 031 for the ChannelType contradiction separately).

## Proposed Solutions

### Option A — Correct the plan (Recommended)

Update the plan's Implementation Phase 1 to say MODIFY, not CREATE:

```markdown
**Step 1: MODIFY `entities/user/model/types.ts`** (already exists — do NOT overwrite)

Append the following to the existing file:

\`\`\`typescript
// Add to bottom of existing file
export type ChannelType = 'telegram' | 'google_calendar';  // if keeping ChannelType
// OR (if removing ChannelType per Enhancement Summary):
export interface ProfileIdentity {
  id: number;
  channel: string;
  channel_identifier: string;
  user_id: number;
}
\`\`\`

**Step 2: MODIFY `entities/user/index.ts`** (already exists — do NOT overwrite)

Add to the existing re-exports:

\`\`\`typescript
export type { ProfileIdentity } from './model/types';
\`\`\`
```

**Pros:** Correct; preserves existing types; no breaking changes.
**Cons:** None.
**Effort:** Trivial (update plan doc, not code).
**Risk:** None.

### Option B — Add separate `entities/user/model/identity-types.ts`

Keep `ProfileIdentity` in its own file to avoid modifying the existing types file:

```
entities/user/model/types.ts        ← unchanged
entities/user/model/identity-types.ts ← new file with ProfileIdentity
entities/user/index.ts              ← add identity-types export
```

**Pros:** No modification of existing types.ts.
**Cons:** Splits user entity types across two files unnecessarily.
**Effort:** Small.
**Risk:** Low.

## Recommended Action

**Option A.** Correct the plan to say MODIFY. When implementing, append `ProfileIdentity` to the existing `entities/user/model/types.ts` (and optionally `ChannelType` — resolve todo 031 first to decide). Add the export to `entities/user/index.ts`.

Before implementing, verify the current state with:
```bash
cat entities/user/model/types.ts
cat entities/user/index.ts
```

## Technical Details

- **Files that already exist:**
  - `entities/user/model/types.ts` — 6 exported types
  - `entities/user/index.ts` — re-exports all 6 types
- **Files currently importing from `@/entities/user`:** check with `grep -r "@/entities/user" --include="*.ts" --include="*.tsx" -l`
- **Currently in `features/user-profile/model/types.ts`:** `Identity` interface (should be migrated to `entities/user/model/types.ts` as `ProfileIdentity` and removed from features)

## Acceptance Criteria

- [ ] Plan updated to say MODIFY (not CREATE) for both `entities/user/` files
- [ ] `entities/user/model/types.ts` retains all 6 existing type exports after modification
- [ ] `ProfileIdentity` is appended to (not overwriting) the existing types file
- [ ] `entities/user/index.ts` adds `ProfileIdentity` export without removing existing exports
- [ ] `grep -r "@/entities/user" --include="*.ts" --include="*.tsx"` still resolves all imports correctly
- [ ] `npm run build` passes with no type errors

## Work Log

- 2026-05-20: Found by architecture-strategist and pattern-recognition-specialist during review of Telegram account linking plan. Verified by reading entities/user/model/types.ts which confirmed 6 existing types.