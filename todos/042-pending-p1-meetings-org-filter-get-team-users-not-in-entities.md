---
id: "042"
priority: P1
status: pending
area: meetings
file: entities/team/api/team.ts
---

# `getTeamUsers` must be moved to `entities/team/api/team.ts` before cross-feature import fix

## Problem

`features/meetings/ui/meetings-list-filters-bar.tsx` line 6 has a cross-feature import violation:

```ts
import { getTeams, getTeamUsers } from '@/features/teams/api/team'
```

The plan proposes fixing this by importing from `@/entities/team/api/team` instead. However, `entities/team/api/team.ts` only exports `getTeams` — it does **not** export `getTeamUsers`. `getTeamUsers` only exists in `features/teams/api/team.ts` (line ~164).

Applying the plan's import change as written would produce a compile error: `Module '"@/entities/team/api/team"' has no exported member 'getTeamUsers'`.

## Required Fix

Before or as part of this PR, move `getTeamUsers` from `features/teams/api/team.ts` into `entities/team/api/team.ts`.

`getTeamUsers` fetches team members — a generic domain entity lookup, not a teams-feature-specific operation. It belongs in the entity layer. After the move:

1. Add `getTeamUsers` to `entities/team/api/team.ts` (follow existing pattern, use `httpClient`)
2. Update `features/meetings/ui/meetings-list-filters-bar.tsx` import to `@/entities/team/api/team`
3. Update any other callers of `getTeamUsers` from `features/teams/api/team.ts` to the new path
4. Remove or keep (re-export) from `features/teams/api/team.ts` depending on other consumers

## Note on Scope

The plan's line estimate (~20-25 lines, 2 files) is incorrect. This adds a third file (`entities/team/api/team.ts`) and the actual change is closer to 40-50 lines across 3 files.
