---
status: pending
priority: p2
issue_id: "093"
tags: [code-review, fsd, architecture, scope]
dependencies: []
---

# Scope Creep — FSD Deep-Import Fixes and isIssueHistoryPeriod Type Guard Should Be Separate PRs

## Problem Statement

The plan bundles 3–4 pre-existing improvements into the tab restructure PR that have no causal relationship to the requested feature changes:

1. **3 FSD deep-import violations** (Steps 6, 7) — pre-existing violations in `activity/page.tsx`, `task-stats-block.tsx`, `closed-tasks-block.tsx`
2. **`isIssueHistoryPeriod` type guard** (Step 2) — a model enhancement not needed for the tab rename

Each of these is worthwhile, but bundling them into the tab restructure PR:
- Makes the PR harder to review ("why is there an issues model change in a tab rename PR?")
- Increases regression surface (a wrong import path fix breaks a dashboard silently at runtime)
- Creates a dependency chain that can block the main feature if the fix has a bug

The scope-guardian review flagged Steps 2 and 7 as HIGH confidence scope creep; Step 6's FSD fix portion as HIGH confidence scope creep.

## Findings

From the scope-guardian agent review:
- **Step 7 (FSD fixes in today-briefing)**: Highest risk of the bundled items. `task-stats-block.tsx` and `closed-tasks-block.tsx` are on the critical render path of the new combined page. A wrong import refactor (e.g. the public index doesn't re-export the server action) would break the page silently at runtime.
- **Step 2 (isIssueHistoryPeriod)**: `progress/page.tsx` already handles period validation inline with a `Set` check (lines 9–19). Moving it to the model with a named export is a quality improvement but has zero functional impact on this PR's goals.
- **Step 6 FSD fix (activity/page.tsx)**: One-line fix to the import path. Low risk individually, but bundled for no reason.

The minimum file set for this feature is:
1. `today-tabs-nav.tsx` — remove Tasks tab, rename labels
2. `app/dashboard/today/tasks/page.tsx` — convert to redirect
3. `app/dashboard/today/progress/page.tsx` — add briefing data + AI blocks
4. `app/dashboard/today/activity/page.tsx` — update metadata.title only

## Proposed Solutions

### Option 1: Separate PRs — Recommended

Ship the tab restructure in one PR (4 files + loading.tsx). Create a separate "FSD boundary cleanup" PR for the 3 deep-import fixes. Create a separate "issues model improvements" PR for the type guard.

**Pros:** Clean PR history. Easier code review. Isolated risk.
**Cons:** Slightly more coordination.
**Effort:** No extra implementation effort — just branching strategy
**Risk:** Low

---

### Option 2: Include FSD fixes, exclude type guard

The FSD fixes are small (one-line changes each) and can be verified quickly. The type guard is the most speculative of the additions. Include the FSD fixes with the PR (they touch files already being modified), but move the type guard to a follow-up.

**Pros:** Fixes violations while in the area. type guard is the safest to defer.
**Cons:** Still increases PR scope.
**Effort:** Trivial
**Risk:** Low (FSD fixes are low-risk one-liners)

---

### Option 3: Include everything as planned

**Pros:** All improvements land together.
**Cons:** PR is harder to review; regression risk from bundled changes.
**Effort:** As planned
**Risk:** Moderate

## Recommended Action

Option 2 (include FSD one-liner fixes, defer type guard). The FSD fixes are all in files touched by this PR anyway, the changes are one-line import path corrections, and `getIssueStats`/`CriticalPathPageClient` are confirmed exported from `features/issues/index.ts`. The type guard has no urgency and belongs in a model quality PR.

## Technical Details

**Files where FSD fixes are needed (confirmed violations):**
- `app/dashboard/today/activity/page.tsx:1` — `@/features/issues/ui/critical-path-page` → `@/features/issues`
- `features/today-briefing/ui/task-stats-block.tsx:4` — `@/features/issues/api/issue-stats` → `@/features/issues`
- `features/today-briefing/ui/closed-tasks-block.tsx:3` — `@/features/issues/api/issue-stats` → `@/features/issues`

All three target exports already exist in `features/issues/index.ts` (lines 20, 65).

**Type guard to defer:**
- `features/issues/model/types.ts` — `isIssueHistoryPeriod` + `VALID_HISTORY_PERIODS`
- `features/issues/index.ts` — export line

## Acceptance Criteria

- [ ] FSD deep-import fixes are either in this PR (as one-liners) or tracked as a separate todo
- [ ] `isIssueHistoryPeriod` type guard deferred to a separate PR
- [ ] PR description explains why FSD fixes are included (if included) so reviewers aren't confused

## Work Log

### 2026-05-28 - Discovery during plan review

**By:** Claude Code (scope-guardian + architecture review agents)

**Actions:**
- Scope-guardian identified 3 out-of-scope items bundled into the PR
- Architecture review confirmed FSD violations are real and the fixes are trivially safe
- Decision matrix documented above