---
title:
  Rename Profiles tab to Agents and fix empty-state crashes on Tools/Memories
  tabs
type: fix
status: completed
date: 2026-05-25
---

# Rename "Profiles" tab to "Agents" and fix Tools/Memories empty-state crashes

## Enhancement Summary

**Deepened on:** 2026-05-25 **Research agents used:**
kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel,
performance-oracle, architecture-strategist, julik-frontend-races-reviewer,
pattern-recognition-specialist, feasibility/coherence reviewer,
unit-test-booster, learnings-researcher

### Key Improvements Discovered

1. **Fix C is structurally wrong** — the proposed outer `memories.length === 0`
   conditional + `DataTable` `emptyState` prop creates dead code. The correct
   fix is to add the empty-state guard inside `DataTable.tsx` itself (one line
   in the mobile section), and pass `emptyState` to the existing `<DataTable>`
   call without an outer conditional.
2. **403 and 404 must be handled differently** — the plan originally treated
   both identically (return empty). Security analysis shows 403 = render
   `AccessDeniedState`; 404 = render neutral empty state. Conflating them is an
   IDOR oracle risk and a UX regression.
3. **Error handling belongs at the page/component layer, not inside the Server
   Action** — the existing codebase already establishes this pattern in
   `layout.tsx`. Server Actions should remain transparent error propagators;
   page components catch and decide the fallback.
4. **`EmptyState` component must be used** — every other agent-feature empty
   state uses `EmptyState` from `shared/ui/feedback/empty-state`. A plain `<p>`
   breaks visual consistency.
5. **`DataTable` has a mobile empty-state gap** — when `items.length === 0` and
   `renderMobileCard` is provided, the mobile section renders a blank container.
   The one-line fix belongs in `DataTable.tsx`, not in every caller.
6. **Three additional files the original plan missed:** `metadata.title` on
   `profiles/page.tsx`, the SR-only `caption='Agent Profiles'` in
   `AgentProfilesList`, and three new test files that should be added.
7. **`cache()` on `'use server'` is architecturally incorrect** — React's
   `cache()` is semantically wrong on Server Action exports. Pre-existing issue
   not introduced by this plan, but not to be compounded.

### New Considerations Discovered

- 403 swallowed silently creates invisible authorization failures in monitoring
  — any caught 403 should `console.error` for observability.
- `getAgentProfileTools` returns all system tools when `allowed_tools` is
  null/`[]` — the tools tab is never actually empty in normal flow; the crash is
  a 403 authorization error, not an empty-array case.
- No existing tests will break from the rename (confirmed: zero test assertions
  on any of the changing strings).
- Precedents for the try/catch empty-recovery pattern exist in
  `features/calendar/api/source.ts`, `features/onboarding/api/onboarding.ts`,
  and `features/teams/api/meeting-summary-template.ts`.

---

## Overview

Two independent tasks:

1. **Rename** the top-level "Profiles" tab under Agents section to "Agents"
   (resulting in navigation: Agents → Agents). Update all downstream labels:
   button "New profile" → "New Agent", page titles, accessibility captions.
2. **Fix crashes** on the `/tools` and `/memories` sub-tabs of a profile detail
   page when the backend returns 403 or 404. Both tabs currently throw unhandled
   `ServerError` to the Next.js dashboard error boundary instead of showing
   appropriate empty/access-denied states.

---

## Bug Analysis

### Bug 1 — Memories tab crashes when profile has no tasks

**Root cause (backend):** `AgentMemoryController@profileIndex` calls
`findAccessibleProfile()` which executes:

```php
// AgentMemoryLookupService.php
return AgentProfile::query()
    ->whereKey($profileId)
    ->whereHas('tasks', fn($q) => $q->where('user_id', $userId))
    ->firstOrFail(); // ← throws ModelNotFoundException (404) if profile has no tasks yet
```

When a brand-new profile has **zero agent tasks** linked to it, `firstOrFail()`
throws a 404. The frontend `httpClientList` (`shared/lib/httpClient.ts:118`)
throws `ServerError` on non-2xx. `getProfileMemories`
(`features/agents/api/agent-profiles.ts:169`) does not catch this — the
`ServerError` propagates out of the `async` Server Component
(`MemoriesContent`), which Next.js catches at the **dashboard-level** error
boundary (`app/dashboard/error.tsx`), blowing out the entire page shell.

**The 404 semantic**: the backend's 404 here is a business-logic signal — "user
has no tasks for this profile" — not a truly missing resource. The UX response
should be a neutral empty state: "No memories yet".

**What "no memories" should look like:** `AgentMemoriesList`
(`features/agents/ui/agent-memories-list.tsx`) renders a `DataTable` without an
`emptyState` prop. When `items.length === 0`, `DataTable` shows an empty
`<tbody>` with headers only (desktop) or a blank mobile container. Additionally,
`DataTable`'s `emptyState` prop only renders in the desktop branch — the mobile
card list has no empty-state handling at all.

### Bug 2 — Tools tab crashes on authorization errors

**Root cause (backend):** `AgentToolController@profileIndex` throws
`AppException` with HTTP 403 (`AGENT_TOOL_MANAGER_REQUIRED`) if the
authenticated user is not a member of any organization. The frontend
`getAgentProfileTools` (`features/agents/api/agent-profiles.ts:129`) calls
`httpClient`, which throws `ServerError` on non-2xx. `getAgentProfileTools` does
not catch this.

**Important nuance on empty tools:** When `allowed_tools` is `null` or `[]`, the
backend returns **all registered tools** (the
`->when(!empty($allowedNames), ...)` filter is skipped). This means the tools
tab is **never empty in normal flow** — a crash always indicates a 403
authorization error, not a zero-tools case. The existing empty state message in
`AgentProfileToolsList` ("No tools assigned. When allowed_tools is unset, all
system tools are available.") is therefore unreachable in normal operation.

**403 vs 404 must be differentiated:**

| Status | Meaning                                                  | Correct UX                                     |
| ------ | -------------------------------------------------------- | ---------------------------------------------- |
| 403    | No permission (not org member, or backend policy denied) | `AccessDeniedState` component with shield icon |
| 404    | Resource exists but no qualifying data (no tasks yet)    | Neutral empty state with descriptive copy      |

Treating both as an empty list masks authorization failures and misleads users
who actually lack access.

---

## Task 1 — Rename "Profiles" → "Agents"

**Precedent:** `features/meetings/ui/meeting-detail-tabs-nav.tsx:28` already
shows `label: hasProtocol ? 'Protocol' : 'Agenda'` while `href` stays on
`AGENDA` route — label/URL divergence in route-based tabs is established and
acceptable.

**No tests will break** — confirmed: zero existing test files assert any of the
strings being changed.

### Files to change

#### `features/agents/ui/agents-tabs-nav.tsx`

```tsx
// before
{ href: ROUTES.DASHBOARD.AGENT_PROFILES, label: 'Profiles' },
// after
{ href: ROUTES.DASHBOARD.AGENT_PROFILES, label: 'Agents' },
```

#### `app/dashboard/agents/profiles/page.tsx`

- Line 14: `export const metadata = { title: 'Agents' }` (was
  `'Agent Profiles'`)
- Line 36:
  `<ButtonLink href={ROUTES.DASHBOARD.AGENT_PROFILES_NEW}>New Agent</ButtonLink>`
  (was `New profile`)
- Line 43:
  `<EmptyState icon={Bot} title='No agents yet' description='Create the first agent configuration.' />`
  (was `No agent profiles yet`)

#### `app/dashboard/agents/profiles/new/page.tsx`

- Line 22 (access-denied branch):
  `<PageHeader hasButtonBack title='New Agent' />` (was `New Agent Profile`)
- Line 50 (access-denied branch):
  `<PageHeader hasButtonBack title='New Agent' />`
- Line 62 (main branch): `<PageHeader hasButtonBack title='New Agent' />`

#### `app/dashboard/agents/profiles/[id]/layout.tsx`

- Line 34 (access-denied branch): `<PageHeader hasButtonBack title='Agent' />`
  (was `Agent Profile`)
- Line 59 (second access-denied branch):
  `<PageHeader hasButtonBack title='Agent' />`
- Line 76 (main branch): uses `profile.name` — **no change needed**

#### `features/agents/ui/agent-profiles-list.tsx` (missed by original plan)

- Line 87: `caption='Agents'` (was `caption='Agent Profiles'`) — SR-only but
  affects screen readers

#### Route constants — **no changes**

`ROUTES.DASHBOARD.AGENT_PROFILES` stays `/dashboard/agents/profiles`. URL paths
are stable contracts. The `AGENT_PROFILES` constant name can be revisited in a
separate refactor if the conceptual rename warrants it.

---

## Task 2 — Fix empty-state crashes

### Architectural principle (from codebase patterns)

The existing layout (`/[id]/layout.tsx:42–63`) already catches `ServerError`
with `status === 403` at the **component layer** and renders
`AccessDeniedState`. This is the established pattern: **Server Actions throw;
components catch and decide the fallback**. The plan must follow this pattern —
not hide error handling inside the Server Action.

Precedents for graceful empty recovery at the API layer do exist
(`features/onboarding/api/onboarding.ts:21-36` catches 404 and returns `null`;
`features/teams/api/meeting-summary-template.ts:26-68` catches 404 and returns a
default shape). However, these cases normalize a "legitimately missing resource"
— they do not conflate 403 authorization failures with 404 not-found. For the
tools and memories cases where 403 and 404 have meaningfully different UX, the
page-layer catch is the right approach.

### Fix A — `DataTable.tsx` mobile empty-state gap (prerequisite)

`DataTable`'s `emptyState` prop only renders in the desktop branch
(`hidden md:block` div). The mobile card list (`flex-col gap-3 md:hidden`)
renders nothing when `items` is empty. Add one line inside the mobile section:

```tsx
// shared/ui/table/DataTable.tsx — inside the mobile renderMobileCard block
{renderMobileCard && (
  <div className='flex flex-col gap-3 md:hidden'>
    {items.map((row) => { return <div key={keyExtractor(row)}>{renderMobileCard(row)}</div>; })}
+   {items.length === 0 && !isLoading && emptyState}
    {isLoading && (...)}
    ...
  </div>
)}
```

This is a one-line fix in the shared component that fixes the mobile
blank-screen issue for ALL callers, including future ones.

### Fix B — `app/dashboard/agents/profiles/[id]/tools/page.tsx`

Move error handling to the page component layer. Differentiate 403 from 404:

```tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AgentProfileToolsList, AccessDeniedState } from '@/features/agents';
import { getAgentProfileTools } from '@/features/agents/api/agent-profiles';
import { ServerError } from '@/shared/lib/errors';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

async function ToolsContent({ profileId }: { profileId: number }) {
  try {
    const tools = await getAgentProfileTools(profileId);
    return <AgentProfileToolsList tools={tools} />;
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        // eslint-disable-next-line no-console
        console.error('[agents] 403 on profile tools', {
          profileId,
          url: error.url,
        });
        return (
          <AccessDeniedState description='You do not have permission to view tools for this agent.' />
        );
      }
      if (error.status === 404) {
        return <AgentProfileToolsList tools={[]} />;
      }
    }
    throw error;
  }
}

export default async function AgentProfileToolsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  return (
    <Suspense fallback={<SkeletonList rows={5} />}>
      <ToolsContent profileId={profileId} />
    </Suspense>
  );
}
```

**Why `console.error` for 403:** The `httpClient` does not log non-2xx
responses. A swallowed 403 that renders `AccessDeniedState` would be invisible
to any future monitoring. The `console.error` is consistent with the project's
logger conventions (needs `// eslint-disable-next-line no-console` per codebase
ESLint rules).

**`getAgentProfileTools` stays unchanged** — it remains a transparent thrower.
The `cache()` wrapper is a pre-existing architectural concern (React `cache()`
is semantically wrong on a `'use server'` export) but is not introduced by this
plan and should not be touched here.

### Fix C — `app/dashboard/agents/profiles/[id]/memories/page.tsx`

Same pattern — catch at the page component layer, differentiate 403 vs 404:

```tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  getProfileMemories,
  AgentMemoriesList,
  AccessDeniedState,
} from '@/features/agents';
import { ServerError } from '@/shared/lib/errors';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

async function MemoriesContent({ profileId }: { profileId: number }) {
  try {
    const { data, totalCount } = await getProfileMemories(profileId);
    return <AgentMemoriesList memories={data} totalCount={totalCount} />;
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        // eslint-disable-next-line no-console
        console.error('[agents] 403 on profile memories', {
          profileId,
          url: error.url,
        });
        return (
          <AccessDeniedState description='You do not have permission to view memories for this agent.' />
        );
      }
      if (error.status === 404) {
        return <AgentMemoriesList memories={[]} totalCount={0} />;
      }
    }
    throw error;
  }
}

export default async function AgentProfileMemoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  return (
    <Suspense fallback={<SkeletonList rows={5} />}>
      <MemoriesContent profileId={profileId} />
    </Suspense>
  );
}
```

### Fix D — `AgentMemoriesList` — add `emptyState` and use `EmptyState` component

Pass `emptyState` to `DataTable` using the `EmptyState` shared component
(consistent with every other agent-feature empty state:
`agent-activity-feed.tsx:10,76`, `profiles/page.tsx:43-47`,
`tasks/page.tsx:55`). Do **not** add an outer conditional — `DataTable` already
handles `items.length === 0` via the `showEmpty` prop logic, and the mobile gap
is fixed by Fix A:

```tsx
import { BrainCircuit } from 'lucide-react';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

// Inside AgentMemoriesList:
<DataTable
  columns={COLUMNS}
  items={memories}
  keyExtractor={(m) => { return m.id; }}
  caption='Agent Memories'
  captionSrOnly
  tableMinWidth='min-w-[700px]'
  emptyState={
    <EmptyState
      icon={BrainCircuit}
      title='No memories yet'
      description='Memories will appear as the agent runs tasks.'
    />
  }
  renderMobileCard={...}
/>
```

**Why `EmptyState` not `<p>`:** All other zero-states in this feature use
`EmptyState` with an icon. A plain `<p>` is inconsistent with the design system.

### Fix E — `AgentProfileToolsList` — update dead empty-state message

The existing empty state ("No tools assigned. When allowed_tools is unset, all
system tools are available.") was meant as documentation of backend behavior.
After Fix B moves error handling to the page layer, the component's empty-array
branch will only trigger on 404 (the page explicitly passes `tools={[]}`).
Update the message to be user-facing rather than developer-facing:

```tsx
if (tools.length === 0) {
  return (
    <p className='text-sm text-muted-foreground'>
      No tools available for this agent.
    </p>
  );
}
```

---

## New Tests to Add

**Zero existing tests will break** from the rename — confirmed by full search.

Three new test files should accompany this implementation:

### `features/agents/api/__tests__/agent-profiles.test.ts` (new)

Tests for `getAgentProfileTools` and `getProfileMemories`:

```ts
jest.mock('@/shared/lib/httpClient', () => ({
  httpClient: jest.fn(),
  httpClientList: jest.fn(),
}));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/shared/lib/config', () => ({ API_URL: 'https://api.test' }));
```

Key test cases:

- `getAgentProfileTools(0)` → returns `[]` (input guard)
- `getAgentProfileTools(1)` success → returns tools array
- `getAgentProfileTools(1)` + `ServerError { status: 403 }` → throws (no longer
  swallowed — handled at page layer)
- `getAgentProfileTools(1)` + `ServerError { status: 404 }` → throws
- `getAgentProfileTools(1)` + `TypeError` → re-throws
- `getProfileMemories(1)` success → correct `{ data, totalCount, hasMore }`
  shape
- `getProfileMemories(1, 0, 300)` → `limit` clamped to 200
- `getProfileMemories(1, -5)` → `offset` clamped to 0

### `features/agents/ui/__tests__/agent-memories-list.test.tsx` (new)

- Renders with `memories={[]}` → shows `EmptyState` with "No memories yet"
- Renders with memories → shows DataTable rows
- Shows `"Showing N of M memories"` banner when `totalCount > memories.length`

### `features/agents/ui/__tests__/agent-profile-tools-list.test.tsx` (new)

- Renders with `tools={[]}` → shows "No tools available for this agent."
- Renders with tools → shows tool names, descriptions, collapsible parameters

---

## Acceptance Criteria

### Task 1 — Rename

- [x] The second tab in the Agents section is labeled "Agents" (not "Profiles")
- [x] The "New profile" button on the profiles list page reads "New Agent"
- [x] Page title for the new-profile page reads "New Agent"
- [x] Access-denied states in the profile detail layout say "Agent" (not "Agent
      Profile")
- [x] SR-only `caption` in `AgentProfilesList` reads "Agents"
- [x] `metadata.title` on profiles page reads "Agents"
- [x] The URL path `/dashboard/agents/profiles` remains unchanged
- [x] No new TypeScript errors

### Task 2 — Bug fixes

- [x] `DataTable` mobile section shows `emptyState` when `items.length === 0`
      (Fix A)
- [x] Navigating to `/tools` for a profile when user lacks org membership shows
      `AccessDeniedState` — no crash, no empty list
- [x] Navigating to `/tools` for a profile with a 404 response shows an empty
      tools list — no crash
- [x] Navigating to `/memories` for a brand-new profile (zero tasks) shows
      `EmptyState` with "No memories yet" — no crash
- [x] Navigating to `/memories` for a profile with memories shows the
      `DataTable` correctly on desktop and mobile
- [x] 403 responses on tools/memories tabs log a `console.error` with profileId
      and URL
- [x] No regression on overview tab, tasks pages, or other agent features

---

## Files to Modify

| File                                                   | Change                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `features/agents/ui/agents-tabs-nav.tsx`               | Tab label `'Profiles'` → `'Agents'`                                                                |
| `app/dashboard/agents/profiles/page.tsx`               | metadata title, button label, EmptyState title/description                                         |
| `app/dashboard/agents/profiles/new/page.tsx`           | PageHeader title × 3 (access-denied × 2, main × 1)                                                 |
| `app/dashboard/agents/profiles/[id]/layout.tsx`        | PageHeader title × 2 (access-denied branches)                                                      |
| `features/agents/ui/agent-profiles-list.tsx`           | SR-only caption `'Agent Profiles'` → `'Agents'`                                                    |
| `shared/ui/table/DataTable.tsx`                        | Add 1 line: mobile section renders `emptyState` when `items.length === 0`                          |
| `app/dashboard/agents/profiles/[id]/tools/page.tsx`    | `ToolsContent` catches `ServerError`, renders `AccessDeniedState` on 403, empty list on 404        |
| `app/dashboard/agents/profiles/[id]/memories/page.tsx` | `MemoriesContent` catches `ServerError`, renders `AccessDeniedState` on 403, empty memories on 404 |
| `features/agents/ui/agent-memories-list.tsx`           | Add `emptyState={<EmptyState .../>}` prop to `DataTable`                                           |
| `features/agents/ui/agent-profile-tools-list.tsx`      | Update empty state message to user-facing copy                                                     |

**New files:**

| File                                                             | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `features/agents/api/__tests__/agent-profiles.test.ts`           | Tests for `getAgentProfileTools` and `getProfileMemories` branches |
| `features/agents/ui/__tests__/agent-memories-list.test.tsx`      | Tests for empty state and rendering                                |
| `features/agents/ui/__tests__/agent-profile-tools-list.test.tsx` | Tests for empty state and tool rendering                           |

---

## Out of Scope

- Renaming the URL path `/dashboard/agents/profiles` or the
  `ROUTES.DASHBOARD.AGENT_PROFILES` constant
- Renaming `AgentProfile*` TypeScript types or API resource names
- Fixing the pre-existing `cache()` on `'use server'` architectural concern
  (separate refactor)
- Adding server-side pagination to memories
- Adding `AbortSignal.timeout()` to `httpClient`/`httpClientList` (separate
  improvement)
- Fixing `getAgentTask`/`getAgentTaskRun` unsafe null casts (pre-existing,
  separate fix)
- Backend changes — all fixes are frontend-only

---

## References

### Internal

- `features/agents/api/agent-profiles.ts:129` — `getAgentProfileTools` (stays as
  transparent thrower)
- `features/agents/api/agent-profiles.ts:169` — `getProfileMemories` (stays as
  transparent thrower)
- `features/agents/ui/agent-profile-tools-list.tsx:10` — existing empty state
  (update message)
- `features/agents/ui/agent-memories-list.tsx:88` — `AgentMemoriesList` (add
  `emptyState` prop)
- `features/agents/ui/access-denied-state.tsx` — `AccessDeniedState` component
  (use for 403)
- `shared/ui/table/DataTable.tsx:63` — `showEmpty` logic; `70-86` — mobile
  section (add empty state)
- `shared/ui/feedback/empty-state` — `EmptyState` component (use for 404 empty
  states)
- `app/dashboard/agents/profiles/[id]/layout.tsx:42-63` — existing 403 catch
  pattern to replicate
- `features/meetings/ui/meeting-detail-tabs-nav.tsx:28` — precedent for
  label/URL divergence

### Existing patterns used as models

- `features/onboarding/api/onboarding.ts:21-36` — targeted 404 catch in Server
  Action
- `features/teams/api/meeting-summary-template.ts:26-68` — targeted 404 catch,
  returns default shape
- `features/calendar/api/source.ts:18-25` — bare catch returns `[]`

### Backend

- `AgentMemoryController@profileIndex` → `findAccessibleProfile` →
  `firstOrFail()` throws 404 when no tasks
- `AgentToolController@profileIndex` → 403 (`AGENT_TOOL_MANAGER_REQUIRED`) if
  not org member
- `AgentMemoryLookupService::findAccessibleProfile` — the
  `->whereHas('tasks', ...)` constraint
