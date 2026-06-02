---
title: Add Insight section to Today Goals page
type: feat
status: completed
date: 2026-05-29
---

# feat: Add Insight Section to Today Goals Page

## Enhancement Summary

**Deepened on:** 2026-05-29 **Research agents used:**
kieran-typescript-reviewer, performance-oracle, architecture-strategist,
code-simplicity-reviewer, security-sentinel, julik-frontend-races-reviewer,
pattern-recognition-specialist, best-practices-researcher

### Key Improvements Discovered

1. **Critical bug in existing page**: `goals/page.tsx` is missing
   `export const dynamic = 'force-dynamic'` — all other Today sub-pages have it.
   Without it, user-specific insight data could theoretically be served stale.
   **Fix this first, regardless of the insight feature.**
2. **Type regression caught**: The plan's local `UserIdentity` interface drops
   `channel: string | null` and `user_id: number | null` nullability that the
   existing `ProfileIdentity` entity already models correctly. Use
   `entities/user` instead of redefining.
3. **CATEGORY_LABELS must use `Record<InsightCategory, string>`** for TypeScript
   exhaustiveness — `Record<string, string>` silently allows new categories to
   fall through with no compile error.
4. **Wrong CSS variable**: Plan used `var(--r-lg)` for border radius; actual
   codebase card components use `var(--radius-card)`.
5. **Simplification opportunity**: The plan's 7-file feature slice can be
   reduced to 3 files by placing code in `features/today-briefing/` (where
   analogous features like `TaskStatsBlock` already live).
6. **Security**: Do not use `JSON.stringify(item)` for `unknown[]` content —
   follow the existing `normalizeInsightCategory()` pattern from
   `features/teams/` to whitelist fields and prevent internal metadata leakage.
7. **Performance**: `GoalsPage` blocks `InsightProfileSection` render
   unnecessarily — parallel fetch pattern or split Suspense boundaries is
   preferred.

---

## Overview

Add a personal AI Insight panel to `app/dashboard/today/goals/page.tsx`. The
section shows the current user's long-term AI-generated behavioural profile
(strengths, work patterns, goals & motivations, etc.) fetched from the backend
Insight API. It sits below the existing epics/goals list, giving users a
contextual self-awareness block alongside their goals.

---

## Backend Insight API (Confirmed)

All routes are authenticated (Sanctum). The URL parameter `{profile}` is a
`Profile.id` (an integer), **not** the `User.id`.

### How to get the current user's Profile ID

`GET /api/v1/users/me/identities` (route: `users/me/identities`, controller:
`UserIdentityController@index`)

Returns an array of profiles linked to the current user. The type already exists
in the codebase:

```ts
// entities/user/model/types.ts — already exists, use this instead of a local interface
export interface ProfileIdentity {
  id: number;
  channel: string | null; // ← nullable in backend
  channel_identifier: string;
  user_id: number | null; // ← nullable in backend
}
```

Use the profile with `channel === "google_calendar"` as primary — fall back to
`identities[0]` if none found. Note: `channel` is nullable, so use
`identity.channel === 'google_calendar'` (a null channel never matches, which is
safe).

### Primary endpoint to fetch

`GET /api/v1/insight/profiles/{profile}` — returns the full profile:

```ts
// features/today-briefing/model/types.ts — add these interfaces here
interface InsightFullProfile {
  profile_id: number;
  user_name: string | null;
  is_ready: boolean;
  profiles: InsightProfileCategory[];
  short_term: InsightShortTermItem[];
  relationships: InsightRelationship[];
}

interface InsightProfileCategory {
  category: InsightCategory;
  content: string[]; // ← backend returns string arrays per InsightEvolutionService; NOT unknown[]
  version: number;
  source_count: number;
  last_updated: string | null; // "YYYY-MM-DD"
}

interface InsightShortTermItem {
  context_type: InsightContextType;
  content: string[];
  expires_at: string; // "YYYY-MM-DD"
}

interface InsightRelationship {
  with: number; // profile_id of the other person
  with_name: string | null;
  type: InsightRelationshipType;
  dynamics: string[];
  interaction_count: number;
}

// Use Record<InsightCategory, string> — NOT Record<string, string> — for exhaustiveness checking
type InsightCategory =
  | 'communication_style'
  | 'work_patterns'
  | 'strengths'
  | 'development_areas'
  | 'goals_motivations'
  | 'psychological_profile';

type InsightContextType =
  | 'current_projects'
  | 'recent_decisions'
  | 'emotional_state'
  | 'general_knowledge'
  | 'user_focus';

type InsightRelationshipType =
  | 'collaborative'
  | 'conflicting'
  | 'hierarchical'
  | 'neutral';
```

**⚠️ Before implementing:** Confirm `content[]` shape with the backend
`InsightEvolutionService`. The service likely produces `string[]` (fact
statements). If it ever produces structured objects, narrow the type using a
discriminated union — never use `unknown[]` in rendered UI.

**Edge case:** `is_ready: false` means the AI hasn't generated the profile yet
(no meeting data). The UI must handle this gracefully with an empty/collecting
state.

**Authorization:** The Gate policy allows the profile owner + any user who
hosted a meeting with the profile's person. So the current user can always see
their own profile.

---

## Feature Scope

Show the **`profiles` array** (long-term categories) from
`GET /insight/profiles/{profile}`. Each category renders as a collapsible card.
Short-term context (`short_term`) and relationships are out of scope for this
iteration.

---

## FSD Structure (Simplified — 3 files, not 7)

Based on the code-simplicity review: `InsightCategoryCard` is private to its
parent, not a shared component. `InsightNotReady` is a single `<EmptyState>`
call that should be inlined. The skeleton can use the existing `SkeletonList`
component. The feature belongs in `features/today-briefing/` alongside
`TaskStatsBlock` and other today-specific blocks.

```
features/today-briefing/
  api/
    insight.ts            ← NEW: getMyInsightProfile()
  model/
    types.ts              ← MODIFY: add InsightFullProfile, InsightProfileCategory, enums
  ui/
    insight-profile-section.tsx   ← NEW: main section component + inline InsightCategoryCard
```

**Why not a separate `features/insight/` slice?** The existing codebase
precedent: `TaskStatsBlock`, `WaitingOnYou`, `StaleItems`, `AiPrepPanel` all
live in `features/today-briefing/` without their own slice. They are consumed
only by today-section pages. A new slice boundary is only justified when the
feature is consumed by two or more different features/pages. When that happens,
extract then.

---

## Implementation Plan

### Step 0 — Fix the pre-existing bug (URGENT — do this first)

**File:** `app/dashboard/today/goals/page.tsx`

Add this line at the top of the file before the metadata export:

```ts
export const dynamic = 'force-dynamic';
```

**Why:** Every other sub-page under `today/` has this declaration (`meetings`,
`progress`, `activity`). The goals page is missing it. The layout already forces
dynamic, but without explicit declaration at the page level, Next.js 16 may
attempt static analysis and the route cache could in theory serve stale
auth-gated data. This is a low-risk practical issue but a correctness gap.

---

### Step 1 — Add TypeScript types

**File:** `features/today-briefing/model/types.ts` (add to existing file)

Add the interfaces from the Backend Insight API section above. Key corrections
from the TypeScript review:

1. Use `content: string[]` — not `unknown[]`. Verify with backend before using.
2. Types go in `model/types.ts`, never in `api/` files.
3. Import `ProfileIdentity` from `@/entities/user` — do not redefine it locally.

---

### Step 2 — Add Server Action

**File:** `features/today-briefing/api/insight.ts` (new file)

```ts
'use server';

import { cache } from 'react';

import { API_URL } from '@/shared/lib/config';
import { httpClient } from '@/shared/lib/httpClient';
import type { ProfileIdentity } from '@/entities/user';

import type { InsightFullProfile } from '../model/types';

/**
 * Fetches the current user's AI insight profile.
 * Memoised per React render tree — call freely from Server Components.
 * Do NOT call from Client Components (this is a Server Action).
 *
 * Returns null when the user has no linked profiles or the profile is not yet ready.
 * The caller is responsible for showing the appropriate empty state.
 */
export const getMyInsightProfile = cache(
  async (): Promise<InsightFullProfile | null> => {
    const { data: identities } = await httpClient<ProfileIdentity[]>(
      `${API_URL}/users/me/identities`,
    );

    if (!identities || identities.length === 0) return null;

    // Prefer google_calendar identity — null channel never matches, safe
    const primary =
      identities.find((identity) => identity.channel === 'google_calendar') ??
      identities[0];

    // Guard against non-integer IDs before URL construction
    if (!Number.isInteger(primary.id) || primary.id <= 0) return null;

    // Sequential fetch is required — profile ID depends on identity result
    // TODO: Replace with GET /users/me/insight-profile when backend ships combined endpoint
    const { data } = await httpClient<InsightFullProfile | null>(
      `${API_URL}/insight/profiles/${primary.id}`,
    );

    return data;
  },
);
```

**Notes:**

- Uses `ProfileIdentity` from `@/entities/user` — avoids duplicating the type
  and preserves correct nullability (`channel: string | null`).
- Uses `httpClient<InsightFullProfile | null>` — explicit about the `| null` the
  backend can return.
- `Number.isInteger` guard prevents path traversal via corrupted IDs.
- The `cache()` wrapper is idiomatic in this codebase (see `getEpics`,
  `getIssueStats`, `getAgentProfile`) — it deduplicates within a single render
  tree only, NOT across requests.
- `cache()` in `'use server'` files is an established pattern in this codebase —
  7 existing files use it the same way.

---

### Step 3 — Build the UI component

**File:** `features/today-briefing/ui/insight-profile-section.tsx` (new file)

The `InsightCategoryCard` rendering function is private to this file — extract
to a separate file only when a second consumer needs it.

The label map must use `Record<InsightCategory, string>` for TypeScript
exhaustiveness. If a new category is added to the union and not to this map,
TypeScript will produce a compile error.

```tsx
import { BrainCircuit } from 'lucide-react';

import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';

import { getMyInsightProfile } from '../api/insight';
import type { InsightCategory, InsightProfileCategory } from '../model/types';

// Record<InsightCategory, string> — compile error if InsightCategory gains a new value
// without a corresponding label here
const CATEGORY_LABELS: Record<InsightCategory, string> = {
  communication_style: 'Communication Style',
  work_patterns: 'Work Patterns',
  strengths: 'Strengths',
  development_areas: 'Development Areas',
  goals_motivations: 'Goals & Motivations',
  psychological_profile: 'Psychological Profile',
};

function InsightCategoryCard({
  category,
}: {
  category: InsightProfileCategory;
}) {
  const label = CATEGORY_LABELS[category.category] ?? category.category;

  return (
    <CollapsibleSection label={label} defaultOpen={false}>
      <div className='flex flex-col gap-2 px-4 pb-4'>
        <div className='flex flex-wrap gap-2'>
          {category.content.map((item) => (
            <span
              key={item}
              className='rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs'
            >
              {item}
            </span>
          ))}
        </div>
        <p className='text-xs text-muted-foreground'>
          {category.source_count} source{category.source_count !== 1 ? 's' : ''}
          {category.last_updated ? ` · updated ${category.last_updated}` : ''}
        </p>
      </div>
    </CollapsibleSection>
  );
}

export async function InsightProfileSection() {
  const profile = await getMyInsightProfile();

  if (!profile || !profile.is_ready || profile.profiles.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title='Collecting your insights'
        description='Your AI profile is being built from meetings. Check back after a few sessions.'
      />
    );
  }

  return (
    <section>
      <div className='flex items-center gap-2 mb-3'>
        <BrainCircuit className='h-4 w-4 text-primary' />
        <h2 className='text-sm font-semibold text-foreground'>
          Your AI Profile
        </h2>
      </div>
      <div className='flex flex-col gap-2'>
        {profile.profiles.map((cat) => (
          <InsightCategoryCard key={cat.category} category={cat} />
        ))}
      </div>
    </section>
  );
}
```

**Key corrections applied:**

- `key={item}` (stable string content key) instead of `key={i}` (index)
- `flex flex-col gap-2` instead of `space-y-2` — matches `today-briefing`
  component convention
- `rounded-[var(--radius-card)]` used in skeleton (see Step 4) — NOT
  `rounded-[var(--r-lg)]`
- `EmptyState` receives `icon={BrainCircuit}` (component reference, not JSX
  element `<BrainCircuit />`)
- "calls" replaced with "sessions" in empty state description — "calls" is
  ambiguous
- `InsightNotReady` inlined — it was a single `<EmptyState>` call with no reuse
  value

---

### Step 4 — Update `app/dashboard/today/goals/page.tsx`

The page structure uses the fully-split Suspense approach so that `getEpics` and
`getMyInsightProfile` can start simultaneously (neither depends on the other):

```tsx
// app/dashboard/today/goals/page.tsx
import { Suspense } from 'react';
import { Target } from 'lucide-react';

import { getEpics } from '@/features/issues/api/issues';
import {
  EpicGoalCard,
  EpicGoalCardSkeleton,
} from '@/features/issues/ui/epic-goal-card';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { InsightProfileSection } from '@/features/today-briefing/ui/insight-profile-section';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Skeleton, SkeletonList } from '@/shared/ui/layout/skeleton';

export const dynamic = 'force-dynamic'; // ← required: user-specific data
export const metadata = { title: 'Goals' };

function UnlinkedTasksSkeleton() {
  return (
    <div className='rounded-[var(--radius-card)] border border-dashed border-border bg-card/50 p-4 space-y-2'>
      <Skeleton className='h-4 w-40' />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-8 w-full' />
      ))}
    </div>
  );
}

// Inline skeleton — no separate file needed (uses existing SkeletonList)
function InsightSkeleton() {
  return (
    <div className='space-y-2'>
      <Skeleton className='h-4 w-40 mb-1' />
      <SkeletonList rows={3} />
    </div>
  );
}

export default async function GoalsPage() {
  // Cookie read only — no network, resolves immediately
  const orgId = await getOrganizationId();

  return (
    <div className='space-y-6 p-6'>
      {/* ── Goals section — streams independently ── */}
      <Suspense fallback={<EpicGoalCardSkeleton />}>
        <EpicsList orgId={orgId} />
      </Suspense>

      {/* ── Divider ── */}
      <hr className='border-border' />

      {/* ── Personal AI Insight — streams independently ── */}
      <Suspense fallback={<InsightSkeleton />}>
        <InsightProfileSection />
      </Suspense>
    </div>
  );
}
```

**Note on `EpicsList`:** The fully-split Suspense approach requires extracting
the epics rendering + empty state logic into a child Server Component
(`EpicsList`) so that the Goals page itself can return JSX immediately without
awaiting `getEpics`. This makes both sections stream in parallel from the
server.

**File:** `features/issues/ui/epics-list.tsx` (new, or colocate in goals page
file)

```tsx
// Can be in the same goals/page.tsx file as a local async function, or extracted
async function EpicsList({ orgId }: { orgId: number }) {
  const epics = await getEpics(orgId);

  if (epics.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title='No open goals yet'
        description='Create an epic to start tracking team goals.'
      />
    );
  }

  return (
    <div className='space-y-4'>
      {epics.map((epic) => (
        <Suspense key={epic.id} fallback={<EpicGoalCardSkeleton />}>
          <EpicGoalCard epic={epic} />
        </Suspense>
      ))}
      <Suspense fallback={<UnlinkedTasksSkeleton />}>
        <UnlinkedTasksSection orgId={orgId} epics={epics} />
      </Suspense>
    </div>
  );
}
```

**Simplest acceptable approach (if parallel streaming is not a priority):** Keep
the current sequential structure (`await getEpics` → render page with
`<Suspense>` for insight only). This is functionally correct and easier to
implement; the insight section renders as soon as epics finishes. Add
`export const dynamic = 'force-dynamic'` regardless.

---

## Acceptance Criteria

- [x] `export const dynamic = 'force-dynamic'` added to
      `app/dashboard/today/goals/page.tsx`
- [x] Goals page shows a "Your AI Profile" section below the epics list
- [x] Each insight category renders as a collapsible block with structured
      content (key-value + pills per category schema)
- [x] When `is_ready: false` or no identities: shows "Collecting your insights"
      empty state (no crash)
- [x] When no goals exist, the insight section still renders below the empty
      state
- [x] Loading skeleton shows while the Suspense boundary resolves
- [x] TypeScript compiles without errors (`npm run build`)
- [x] ESLint passes (`npm run lint`)
- [x] FSD: `features/today-briefing/` does not import from other features
- [x] `InsightProfileSection` uses `ProfileIdentity` from `@/entities/user` — no
      local redefinition

---

## Edge Cases

| Scenario                                                   | Behaviour                                                                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User has no linked profiles (`identities === []`)          | `getMyInsightProfile` returns `null` → empty state                                                                                                                                                    |
| Profile exists but `is_ready: false`                       | Empty state with "collecting" message                                                                                                                                                                 |
| Profile exists and `is_ready: true`, but `profiles === []` | Empty state (no categories yet)                                                                                                                                                                       |
| `primary.id` is not a positive integer                     | `Number.isInteger` guard → return null, show empty state                                                                                                                                              |
| Insight API returns 404                                    | `httpClient` throws `ServerError` → caught by `app/dashboard/error.tsx` boundary                                                                                                                      |
| Insight API returns 403                                    | Same — `ServerError` → error boundary                                                                                                                                                                 |
| Multiple identities                                        | `google_calendar` first (null channel never matches), else `identities[0]`                                                                                                                            |
| `content[]` unexpectedly contains objects                  | If type is `string[]`, TypeScript prevents this at compile time. If runtime objects slip through, they render as `[object Object]` — check `InsightEvolutionService` output before choosing the type. |

---

## Security Checklist

- [ ] **Do not use `JSON.stringify(item)` for rendering insight content.** If
      `content` is confirmed as `string[]`, this is moot. If it remains
      `unknown[]`, use a field-whitelist normalizer following
      `normalizeInsightCategory()` in
      `features/teams/ui/dashboard/team-dashboard-tab-people.tsx` — this
      prevents leaking backend-internal fields like `evidence` or confidence
      scores.
- [ ] **Integer guard on `primary.id`** before URL construction
      (`Number.isInteger(primary.id) && primary.id > 0`). Already included in
      the Server Action above.
- [ ] **Verify `NEXT_PUBLIC_APP_ENV` on staging**: The `ErrorDisplay` component
      shows `error.url` (which includes the profile ID) and `error.responseBody`
      when `isDev` is true. If staging is user-accessible with
      `NEXT_PUBLIC_APP_ENV=development`, this exposes internal API structure.
- [ ] **No `dangerouslySetInnerHTML`** anywhere in the insight rendering path —
      confirmed by the component design above.

---

## Performance Notes

### `cache()` semantics

`React.cache()` deduplicates within a **single render tree per request only** —
it is not a cross-request or cross-user cache. React discards the cache after
each HTTP response. This is the correct tool for deduplication when
`InsightProfileSection` and any other server component on the same page might
call `getMyInsightProfile()` in the same render pass.

If the insight profile is expensive to recompute on the backend and can be
safely cached for a few minutes, add `unstable_cache` from `next/cache` with a
per-user tag:

```ts
import { unstable_cache } from 'next/cache';

export const getMyInsightProfile = unstable_cache(
  async (profileId: number): Promise<InsightFullProfile | null> => {
    const { data } = await httpClient<InsightFullProfile | null>(
      `${API_URL}/insight/profiles/${profileId}`,
    );
    return data;
  },
  ['insight-profile'],
  { revalidate: 300, tags: [`insight-profile-${profileId}`] },
);
```

**Not recommended for the initial implementation** — add only if backend latency
for the insight endpoint is measured to be slow.

### Parallel streaming

The split-Suspense approach in Step 4 allows `getEpics` and
`getMyInsightProfile` to start simultaneously, improving time-to-first-content.
The sequential approach (await getEpics, then render Suspense for insight) is
acceptable for a first implementation.

---

## Files to Create / Modify

| Action     | Path                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| **Modify** | `app/dashboard/today/goals/page.tsx` — add `dynamic`, add Suspense for insight                       |
| **Modify** | `features/today-briefing/model/types.ts` — add `InsightFullProfile`, `InsightProfileCategory`, enums |
| **Create** | `features/today-briefing/api/insight.ts` — `getMyInsightProfile()` Server Action                     |
| **Create** | `features/today-briefing/ui/insight-profile-section.tsx` — main section + inline card                |

**Total: 2 new files, 2 modified files** (down from original plan's 7 new + 1
modified)

---

## Design Notes

- Uses `CollapsibleSection` from `shared/ui/layout/collapsible-section` — props:
  `label: string`, `defaultOpen?: boolean` (defaults to `true` — set `false` for
  all cards)
- Pill style: `bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs` —
  matches `InsightCard` artifact renderer in
  `entities/artifact/ui/insight-card.tsx`
- Card border radius: `rounded-[var(--radius-card)]` — NOT
  `rounded-[var(--r-lg)]` (confirmed by `shared/ui/card/Card.tsx` and all
  feature card components)
- Vertical spacing inside content: `flex flex-col gap-2` — NOT `space-y-N`
  (matches `today-briefing` component convention)
- `EmptyState` `icon` prop takes a component reference (`icon={BrainCircuit}`),
  NOT a JSX element
- Section header icon: `BrainCircuit` from lucide-react
- Empty state text: "Check back after a few sessions" — "sessions" is clearer
  than "calls" or "meetings"

---

## Alternative Approaches Considered

### Separate `features/insight/` slice (original plan)

Creates 7 files with a full FSD slice. Rejected: the feature is consumed by
exactly one page, all analogous today-section blocks (`TaskStatsBlock`,
`WaitingOnYou`, `StaleItems`) live in `features/today-briefing/` without their
own slice. Extract to a separate slice only when a second page needs it.

### Render all categories expanded by default

Rejected: 6 expanded collapsible sections is visually overwhelming.
`defaultOpen={false}` lets users explore at their own pace.

### Show `short_term` context (current projects, emotional state)

Out of scope for this iteration. The `short_term` data is ephemeral and changes
daily. A separate short-term context block could be valuable but warrants its
own design consideration — particularly around the `user_focus` context type
with its structured `{ focus_text, deadline, issue_ids }` shape.

---

## Risks and Dependencies

| Risk                                                    | Mitigation                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `content[]` shape is not `string[]` in practice         | Confirm with backend `InsightEvolutionService` before implementing; use `string[]` type if confirmed  |
| User has no Google Calendar integration                 | `identities[0]` fallback handles this; show empty state if no identities at all                       |
| `is_ready: false` for most users on first deploy        | Empty state covers this; no user-visible error                                                        |
| Backend insight API is slow (>500ms)                    | Suspense boundary + skeleton masks latency; consider `unstable_cache` if latency is consistently high |
| `goals/page.tsx` missing `force-dynamic` (existing bug) | Fix in Step 0, independent of the insight feature                                                     |

---

## References

- Backend routes:
  `/Users/slavapopov/Documents/WandaAsk_backend/routes/api.php:375–387`
- Backend controller:
  `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/InsightController.php`
- Backend service:
  `/Users/slavapopov/Documents/WandaAsk_backend/app/Services/Insight/InsightRetrievalService.php`
- Backend identity controller:
  `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/UserIdentityController.php`
- Existing `ProfileIdentity` type: `entities/user/model/types.ts`
- Existing artifact insight card (for reference):
  `entities/artifact/ui/insight-card.tsx`
- Existing team insight pattern + `normalizeInsightCategory()`:
  `features/teams/ui/dashboard/team-dashboard-tab-people.tsx`
- Analogous today-section block for file placement precedent:
  `features/today-briefing/ui/task-stats-block.tsx`
- Current goals page: `app/dashboard/today/goals/page.tsx`
- CollapsibleSection API: `shared/ui/layout/collapsible-section.tsx`
- httpClient: `shared/lib/httpClient.ts`
- Existing `cache()` + `'use server'` precedents:
  `features/issues/api/issues.ts`, `features/agents/api/agent-profiles.ts`
- Institutional learning (safe JSON parsing):
  `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
