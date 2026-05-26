---
status: done
priority: p2
issue_id: '086'
tags: [code-review, routing, telegram, design-decision]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P2: Design decision — keep `permanentRedirect` page or delete old route entirely

## Problem Statement

The plan's Step 4 converts `app/dashboard/profile/telegram/page.tsx` to a
`permanentRedirect()`. The simplicity reviewer argues this is overkill (just
delete it); the architecture and security reviewers argue keep it for safety.
This is a genuine design decision requiring explicit resolution.

**Arguments for permanentRedirect (keep the file):**

- Costs nothing long-term — the file is 5 lines
- Handles browser bookmarks, search engine indexes, shared links
- 308 is the semantically correct signal for a permanent structural move

**Arguments for delete (remove the file):**

- The only internal link to the old URL (the tab entry) is being deleted in the
  same PR
- Grep confirms only 4 references in the entire codebase — all addressed by this
  plan
- Adding a redirect creates maintenance surface for a route nothing will point
  to
- Simplicity reviewer: "Just delete `app/dashboard/profile/telegram/page.tsx`
  outright"

## Findings

- Simplicity agent: "The permanentRedirect pattern is justified when external
  parties hold links to the old URL. For an internal dashboard route with a
  single nav entry being removed simultaneously, it is pure overhead."
- Architecture agent: "Using `permanentRedirect()` (308) at
  `/dashboard/profile/telegram` is the correct choice. A `permanent: true`
  redirect sends HTTP 308... a `permanentRedirect` is more resilient and costs
  nothing long-term."
- Security agent: "Using `permanentRedirect()` (308) is appropriate. It does not
  introduce open-redirect risk."

## Proposed Solutions

### Option A: Keep `permanentRedirect` (Recommended for safety)

5-line file, zero ongoing cost, handles the edge case of any external reference
that was missed.

```tsx
import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/shared/lib/routes';
export default function TelegramRedirectPage() {
  permanentRedirect(ROUTES.DASHBOARD.TELEGRAM);
}
```

**Effort:** Small | **Risk:** None

### Option B: Delete the old route entirely

Remove `app/dashboard/profile/telegram/page.tsx` and
`app/dashboard/profile/telegram/loading.tsx`. **Pros:** Fewer files, cleaner.
**Cons:** Anyone with a bookmark or shared link gets a 404 instead of a smooth
redirect. **Effort:** Trivial | **Risk:** Low

## Recommended Action

Option A — keep the `permanentRedirect`. The 5-line file costs nothing and
provides a safety net. Resolves the disagreement between simplicity and safety
reviewers in favor of safety.

## Acceptance Criteria

- [ ] Decision documented: keep redirect OR delete (one or the other,
      explicitly)
- [ ] Plan updated to reflect the decision clearly
- [ ] If keeping redirect: `permanentRedirect` used (not `redirect`)
- [ ] If deleting: both `page.tsx` and `loading.tsx` are deleted

## Work Log

- 2026-05-26: Identified during /technical_review. Simplicity vs architecture
  agents disagreed — flagged as explicit design decision.
