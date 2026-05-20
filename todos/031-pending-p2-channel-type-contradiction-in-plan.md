---
status: pending
priority: p2
issue_id: '031'
tags: [code-review, telegram, plan-quality, types, yagni]
dependencies: [025]
---

# P2: `ChannelType` contradiction — Enhancement Summary says removed, plan body still includes it

## Problem Statement

The deepened plan's Enhancement Summary explicitly states: "ChannelType union removed — using `channel: string` on `ProfileIdentity` (YAGNI until more channels exist)". However, the plan body still includes `ChannelType` in multiple places:

- `entities/user/model/types.ts` listing shows `export type ChannelType = 'telegram' | 'google_calendar';`
- `entities/user/index.ts` re-exports `ChannelType`
- `ProfileIdentity` still uses `channel: ChannelType` in some plan sections

This contradiction means an implementer following the plan body would add `ChannelType`, while an implementer following the Enhancement Summary would not. The resulting code would be inconsistent based on which section the implementer read first.

## Findings

From `code-simplicity-reviewer`:

```
Enhancement Summary (page 1 of plan):
> "ChannelType union removed — using channel: string (YAGNI until more channels exist)"

Plan body (Phase 1, entities/user/model/types.ts):
> export type ChannelType = 'telegram' | 'google_calendar';

Plan body (Phase 1, entities/user/index.ts):
> export type { ..., ChannelType } from './model/types';

Plan body (ProfileIdentity definition):
> channel: ChannelType;  // ← uses removed type
```

## Analysis

The YAGNI argument is sound: at the time of implementation, only `'telegram'` linking is implemented in this feature. `'google_calendar'` is an existing identity that comes from the backend but has no frontend management UI. Using `channel: string` is correct and honest about the type — the backend returns any string value, and constraining it to a union prematurely would require updating the union every time the backend adds a new identity channel.

**Recommendation: Remove `ChannelType`.** Use `channel: string` in `ProfileIdentity`. If a discriminated union is needed later when multiple channels have management UI, it can be added then.

## Proposed Solutions

### Option A — Remove `ChannelType` from plan and implementation (Recommended)

Update all plan sections to:
```typescript
export interface ProfileIdentity {
  id: number;
  channel: string;           // ← not ChannelType
  channel_identifier: string;
  user_id: number;
}
```

Remove `ChannelType` from `entities/user/model/types.ts` (don't add it).
Remove `ChannelType` from `entities/user/index.ts` exports.

**Pros:** Consistent with Enhancement Summary. Simpler. Honest about backend contract (backend can return any channel string). No premature abstraction.
**Cons:** Type narrowing at call site requires string literal comparison: `identity.channel === 'telegram'` (which is already what the plan does in all examples).
**Effort:** Trivial — update plan, don't add the type.
**Risk:** None.

### Option B — Keep `ChannelType` and remove Enhancement Summary note

Revert the Enhancement Summary decision and add `ChannelType` to entities/user/.

**Pros:** Type-safe channel discrimination.
**Cons:** Premature — only one channel (`telegram`) is actually managed by this feature. `google_calendar` is read-only display. Creates maintenance burden to update the union.
**Effort:** Small.
**Risk:** Low but creates technical debt.

## Recommended Action

**Option A.** Remove `ChannelType`. The Enhancement Summary's decision was correct. Fix the plan body to be consistent: `ProfileIdentity.channel` is `string`, `ChannelType` is not added to `entities/user/`. Update the plan document to remove all mentions of `ChannelType`.

## Technical Details

- **Plan file:** `docs/plans/2026-05-20-feat-telegram-account-linking-plan.md`
- **Lines with `ChannelType`:** search for `ChannelType` in the plan file
- **Consistency check:** `identity.channel === 'telegram'` comparisons in the plan already use string literals, so `ChannelType` adds no narrowing benefit in practice

## Acceptance Criteria

- [ ] Plan updated — `ChannelType` removed from all sections
- [ ] Enhancement Summary and plan body are consistent about `ChannelType`
- [ ] `ProfileIdentity.channel` is `string` in all plan code samples
- [ ] No `ChannelType` added to `entities/user/model/types.ts` during implementation
- [ ] `identity.channel === 'telegram'` string literal comparisons used throughout

## Work Log

- 2026-05-20: Found by code-simplicity-reviewer during review of Telegram account linking plan. Enhancement Summary and plan body contradict each other on this decision.