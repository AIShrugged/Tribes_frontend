---
status: done
priority: p1
issue_id: '081'
tags: [code-review, fsd, architecture, telegram]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P1: `getTelegramChats` import uses deep path — FSD violation in new page

## Problem Statement

The plan's Step 2 proposes `app/dashboard/telegram/page.tsx` with this import:

```tsx
import { getTelegramChats } from '@/features/telegram/api/telegram';
```

This is a direct violation of the FSD rule in CLAUDE.md: "`app/` imports only
from feature `index.ts` public APIs, never deep paths."
`features/telegram/index.ts` already exports `getTelegramChats`, so the correct
import is:

```tsx
import { getTelegramChats } from '@/features/telegram';
```

The plan perpetuates this error because
`app/dashboard/profile/telegram/page.tsx` (the source being copied) already has
the same violation. The new page must not copy the violation.

## Findings

- Architecture agent: "The FSD rule in CLAUDE.md explicitly states: `app/`
  imports only from feature `index.ts` public APIs, never deep paths.
  `features/telegram/index.ts` already exports `getTelegramChats`."
- Pattern recognition agent: consistent with how
  `app/dashboard/teams/page.tsx:13` imports correctly.
- The plan body at Step 2 says "copy from
  `app/dashboard/profile/telegram/page.tsx` — do not use the abbreviated
  pseudocode" — but the source file has the violation, so the copy instruction
  will reproduce the bug.

## Proposed Solutions

### Option A: Fix the import in the plan and in the new page (Recommended)

Change the import in `app/dashboard/telegram/page.tsx` to use the public index:

```tsx
import { getTelegramChats } from '@/features/telegram';
```

**Pros:** FSD-compliant, clean, aligns with `teams/page.tsx` pattern. **Cons:**
Minor divergence from copy-paste instruction. **Effort:** Small | **Risk:** None

### Option B: Also fix the source file

Fix the violation in the existing `app/dashboard/profile/telegram/page.tsx` as
part of the same commit. **Pros:** Cleans up the pre-existing violation too.
**Cons:** Wider diff. **Effort:** Small | **Risk:** None

## Recommended Action

Apply Option A (fix only the new page). Option B is a nice bonus but not
required for this plan.

## Acceptance Criteria

- [ ] `app/dashboard/telegram/page.tsx` imports `getTelegramChats` from
      `@/features/telegram` (index)
- [ ] No deep path imports from `@/features/*/api/*` in `app/` directory

## Work Log

- 2026-05-26: Identified during /technical_review. Architecture agent + pattern
  recognition agent both flagged this.
