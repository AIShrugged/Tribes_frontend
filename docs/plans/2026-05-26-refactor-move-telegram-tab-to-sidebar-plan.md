---
title: 'refactor: Move Telegram tab from Profile to top-level Sidebar'
type: refactor
status: active
date: 2026-05-26
deepened: 2026-05-26
---

# refactor: Move Telegram tab from Profile to top-level Sidebar

## Enhancement Summary

**Deepened on:** 2026-05-26 **Agents used:** kieran-typescript-reviewer,
architecture-strategist, code-simplicity-reviewer, performance-oracle,
security-sentinel, spec-flow-analyzer, scope-guardian, feasibility-reviewer,
coherence-reviewer, adversarial-reviewer, frontend-design,
pattern-recognition-specialist

### Key Improvements vs. Original Plan

1. **Tab count corrected** — ProfileTabsNav currently has 5 tabs (not 6); after
   removal: 4 tabs
2. **`permanentRedirect()` specified** instead of `redirect()` — the move is
   permanent, 308 is correct
3. **`PROFILE_TELEGRAM` constant must be deleted** — it becomes dead code with
   zero consumers
4. **Both `revalidatePath` sites explicitly enumerated** — lines 36 and 61 in
   `telegram.ts`
5. **Sidebar position confirmed as 51** — after AI Chat (50), before Agents
   (90); secondary zone
6. **Latent stale-data bug identified** — Teams page also needs revalidation
   after Telegram mutations
7. **Full page.tsx body specified** — includes `orgMap` construction and
   `botUsername` verbatim
8. **`options.test.ts` update required** — new menu item needs a named test
   assertion
9. **Two Telegram surfaces clarification** — personal link stays in
   Integrations; workspace chats move
10. **Exhaustive reference list confirmed** — only 4 references to old path in
    entire codebase

### New Considerations Discovered

- `permanentRedirect()` vs `redirect()` distinction matters for browser caching
  of the 308 response
- `getTelegramChats()` is not wrapped in React `cache()` unlike
  `getOrganizations()` — low-priority but worth noting
- `IDOR` on `destroy` endpoint in backend (pre-existing, separate ticket)
- Sidebar items land in **secondary zone** by default unless added to
  `PRIMARY_IDS`; Telegram should start secondary

---

## Overview

The Telegram workspace chats management page currently lives as a tab inside
`/dashboard/profile/telegram`. It is structurally unrelated to personal profile
settings — it manages **workspace-level Telegram group chats** linked to
organizations. Moving it to the top-level sidebar makes it discoverable as a
first-class feature alongside Meetings, Issues, and Agents.

> **Important: Two distinct Telegram surfaces exist in this app.** This plan
> moves only workspace chat management. Personal Telegram account linking
> (`TelegramLinkSection`) lives at `/dashboard/profile/integrations` and stays
> there.
>
> - **Moving:** `/dashboard/profile/telegram` → `/dashboard/telegram` —
>   workspace group chat registration (`TelegramWorkspaceChat`, org-level)
> - **Staying:** `/dashboard/profile/integrations` → `TelegramLinkSection` —
>   personal Telegram account linking for notifications (user-level)

---

## Problem Statement

`/dashboard/profile/telegram` manages org-level Telegram group chat
registrations (`TelegramWorkspaceChat`), but it is buried inside the Profile tab
strip alongside personal settings (Account, Calendar, Password). This makes it
invisible to users who don't explore the profile section. It should be a
top-level sidebar entry, consistent with how other workspace-level features are
surfaced.

---

## Proposed Solution

1. Create a new top-level route `/dashboard/telegram` with its own `page.tsx`
2. Remove the Telegram tab from the Profile tab strip (5 tabs → 4 tabs)
3. Add a "Telegram" sidebar nav item in the secondary zone at position 51
4. Add `ROUTES.DASHBOARD.TELEGRAM` and remove the now-dead
   `ROUTES.DASHBOARD.PROFILE_TELEGRAM`
5. Update both `revalidatePath` calls in `features/telegram/api/telegram.ts` to
   the new path
6. Replace old `/dashboard/profile/telegram` page with `permanentRedirect()` to
   preserve deep links

---

## Technical Considerations

- `TelegramChatsManagement` is already a self-contained Client Component in
  `features/telegram/ui/` — no feature-internal changes needed
- The page fetches `getTelegramChats()` + `getOrganizations()` via `Promise.all`
  (both needed; streaming with Suspense offers no benefit since the Client
  Component requires both props to render at all)
- The Telegram icon is not in `ICONS_MAP` yet — use `Send` from lucide-react,
  key `'send'` (Telegram paper-plane visual; `MessageCircle` is semantically
  generic and `Bot` is taken by Agents)
- `revalidatePath` currently hardcodes `'/dashboard/profile/telegram'` — update
  both call sites to use `ROUTES.DASHBOARD.TELEGRAM`; also add
  `revalidatePath(ROUTES.DASHBOARD.TEAMS)` to fix latent stale-data issue on
  Teams page (Teams page renders Telegram chat counts and will show stale data
  after mutations)
- **ICONS_MAP update must come before menu item** — `MenuProps.icon` is
  `keyof typeof ICONS_MAP`; adding the item before the key causes a TypeScript
  error and breaks `options.test.ts`
- The redirect at the old URL should use `permanentRedirect()` (308), not
  `redirect()` (307). This is a structural move, not a conditional redirect —
  308 signals crawlers and preloaders correctly.

---

## Reference Verification — All Consumers of the Old Path

Before implementing, confirm these are the **only 4 references** in the entire
codebase (verified by grep):

| File                                            | Line | Reference                                                        |
| ----------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shared/lib/routes.ts`                          | 40   | `PROFILE_TELEGRAM: '/dashboard/profile/telegram'`                |
| `features/user-profile/ui/profile-tabs-nav.tsx` | 11   | `{ href: ROUTES.DASHBOARD.PROFILE_TELEGRAM, label: 'Telegram' }` |
| `features/telegram/api/telegram.ts`             | 36   | `revalidatePath('/dashboard/profile/telegram')`                  |
| `features/telegram/api/telegram.ts`             | 61   | `revalidatePath('/dashboard/profile/telegram')`                  |

No other file in the codebase references this route. The redirect is a safety
net, not a correctness requirement — the only entry point (the tab) is being
deleted simultaneously.

---

## Affected Files

| File                                            | Change                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `shared/lib/routes.ts`                          | Add `TELEGRAM: '/dashboard/telegram'`; **delete** `PROFILE_TELEGRAM`         |
| `app/dashboard/telegram/page.tsx`               | **New file** — async Server Component (see exact body below)                 |
| `app/dashboard/telegram/loading.tsx`            | **New file** — skeleton loader (required by project convention)              |
| `app/dashboard/profile/telegram/page.tsx`       | Replace with `permanentRedirect(ROUTES.DASHBOARD.TELEGRAM)`                  |
| `app/dashboard/profile/telegram/loading.tsx`    | **Delete** — redirect is instant, no loader needed                           |
| `features/menu/lib/options.ts`                  | Add `send: Send` to `ICONS_MAP`; add nav item at position 51                 |
| `features/user-profile/ui/profile-tabs-nav.tsx` | Remove `PROFILE_TELEGRAM` entry from `TABS` array                            |
| `features/telegram/api/telegram.ts`             | Update lines 36 and 61: new path + add `ROUTES.DASHBOARD.TEAMS` revalidation |
| `features/menu/lib/__tests__/options.test.ts`   | Add named assertion for the new Telegram menu item                           |

---

## Acceptance Criteria

- [ ] `/dashboard/telegram` renders `TelegramChatsManagement` with all existing
      functionality intact (add chat, delete chat, org selector, bot username)
- [ ] The Telegram tab no longer appears in the Profile tab strip (4 tabs
      remain: Account, Calendar, Preferences, Integrations)
- [ ] A "Telegram" item with the `Send` icon appears in the sidebar secondary
      zone (below the divider), highlights correctly when on
      `/dashboard/telegram`
- [ ] Navigating to `/dashboard/profile/telegram` issues a 308 permanent
      redirect to `/dashboard/telegram`
- [ ] Both `revalidatePath` calls in `telegram.ts` (lines 36 and 61) use
      `ROUTES.DASHBOARD.TELEGRAM`
- [ ] Both mutation actions also call `revalidatePath(ROUTES.DASHBOARD.TEAMS)`
      to prevent stale data on the Teams page
- [ ] `loading.tsx` exists at `app/dashboard/telegram/loading.tsx`
- [ ] `ROUTES.DASHBOARD.PROFILE_TELEGRAM` is deleted from `shared/lib/routes.ts`
      (TypeScript will catch any missed consumer)
- [ ] `options.test.ts` has a named test for the `telegram` menu item
- [ ] No FSD boundary violations — `features/telegram` public API consumed only
      from `app/`
- [ ] Lint and type-check pass (`npm run lint && npx tsc --noEmit`)

---

## Implementation Steps

> Execute in this exact order. Steps 1 and 5 must come before step 6 to keep
> TypeScript + tests green at every commit point.

### Step 1 — Update route constants in `shared/lib/routes.ts`

Inside the `DASHBOARD` object:

```ts
// Add:
TELEGRAM: '/dashboard/telegram',

// Delete this line entirely:
PROFILE_TELEGRAM: '/dashboard/profile/telegram',
```

TypeScript will immediately surface any missed consumer of `PROFILE_TELEGRAM` —
fix before proceeding.

---

### Step 2 — Create `app/dashboard/telegram/page.tsx`

Copy the exact body from `app/dashboard/profile/telegram/page.tsx` — do not use
the abbreviated pseudocode from the original plan:

```tsx
import { getOrganizations } from '@/features/organization';
import { TelegramChatsManagement } from '@/features/telegram';
import { getTelegramChats } from '@/features/telegram/api/telegram';
import { TELEGRAM_BOT_USERNAME } from '@/shared/lib/config';

export default async function TelegramPage() {
  const [{ data: chats }, { data: organizations }] = await Promise.all([
    getTelegramChats(),
    getOrganizations(),
  ]);

  const orgList = organizations ?? [];
  const orgMap: Record<number, string> = Object.fromEntries(
    orgList.map((org) => {
      return [org.id, org.name];
    }),
  );

  return (
    <TelegramChatsManagement
      initialChats={chats ?? []}
      organizations={orgList}
      orgMap={orgMap}
      botUsername={TELEGRAM_BOT_USERNAME ?? 'your_bot'}
    />
  );
}
```

Note: `getTelegramChats` is imported directly from
`@/features/telegram/api/telegram` (deep path), not from the
`@/features/telegram` index. This is the established pattern for Server Actions
per CLAUDE.md — Server Actions are not bundled client-side and should be
imported directly.

---

### Step 3 — Create `app/dashboard/telegram/loading.tsx`

Copy the skeleton pattern from another `loading.tsx` in the same dashboard level
(e.g., `app/dashboard/teams/loading.tsx`). Every top-level dashboard route with
async data-fetching requires this file per project convention.

---

### Step 4 — Convert old route to permanent redirect

Replace the entire content of `app/dashboard/profile/telegram/page.tsx`:

```tsx
import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/shared/lib/routes';

export default function TelegramRedirectPage() {
  permanentRedirect(ROUTES.DASHBOARD.TELEGRAM);
}
```

Use `permanentRedirect` (308), not `redirect` (307) — this is a permanent
structural move.

Then delete `app/dashboard/profile/telegram/loading.tsx` — the redirect executes
before any React rendering, so no loading skeleton is ever shown.

---

### Step 5 — Add `Send` icon to `ICONS_MAP` in `features/menu/lib/options.ts`

**This step must come before step 6** to keep tests and the TypeScript compiler
green simultaneously.

1. Add the import at the top with the other lucide imports:

```ts
import { Send } from 'lucide-react';
```

2. Add the entry to `ICONS_MAP`:

```ts
send: Send,
```

---

### Step 6 — Add sidebar nav item in `features/menu/lib/options.ts`

Add to the array returned by `getMenuItems()`:

```ts
{
  id: 'telegram',
  label: 'Telegram',
  icon: 'send',
  href: ROUTES.DASHBOARD.TELEGRAM,
  position: 51,
},
```

**Position 51** places it immediately after AI Chat (position 50) in the
secondary zone, before Agents (position 90). The secondary zone appears below
the divider in the sidebar — correct for a workspace integration feature. Do not
add `'telegram'` to `DEFAULT_PRIMARY_IDS` in
`features/user-profile/model/menu-settings.ts`; users who rely on Telegram daily
can promote it to primary via the Preferences → Navigation drag-and-drop.

---

### Step 7 — Remove Telegram tab from `features/user-profile/ui/profile-tabs-nav.tsx`

Delete the entry from the `TABS` array:

```ts
{ href: ROUTES.DASHBOARD.PROFILE_TELEGRAM, label: 'Telegram' },
```

After this change, the Profile tab strip has 4 tabs: Account, Calendar,
Preferences, Integrations.

---

### Step 8 — Update `revalidatePath` in `features/telegram/api/telegram.ts`

Update both lines 36 and 61. Also add a Teams revalidation to fix the latent
stale-data issue:

```ts
// In createTelegramWorkspaceChat (line ~36):
revalidatePath(ROUTES.DASHBOARD.TELEGRAM);
revalidatePath(ROUTES.DASHBOARD.TEAMS);

// In deleteTelegramWorkspaceChat (line ~61):
revalidatePath(ROUTES.DASHBOARD.TELEGRAM);
revalidatePath(ROUTES.DASHBOARD.TEAMS);
```

Import `ROUTES` at the top of the file:

```ts
import { ROUTES } from '@/shared/lib/routes';
```

This satisfies the `sonarjs/no-duplicate-string` ESLint rule (no repeated path
strings) and fixes a pre-existing bug where the Teams page showed stale Telegram
chat data after mutations.

---

### Step 9 — Add test assertion in `features/menu/lib/__tests__/options.test.ts`

Following the existing pattern (Teams item test, Tasks item test):

```ts
it('includes a Telegram item', () => {
  const items = getMenuItems();
  const telegram = items.find((item) => item.id === 'telegram');
  expect(telegram).toBeDefined();
  expect(telegram?.label).toBe('Telegram');
  expect(telegram?.href).toBe(ROUTES.DASHBOARD.TELEGRAM);
});
```

---

## Dependencies & Risks

| Risk                                                 | Mitigation                                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broken deep links                                    | `permanentRedirect()` at old URL covers all 4 known references                                                                                                                |
| Stale data on Teams page after mutations             | Resolved in Step 8 — add `revalidatePath(ROUTES.DASHBOARD.TEAMS)`                                                                                                             |
| `ICONS_MAP` not updated before menu item             | Resolved by ordering: Step 5 before Step 6                                                                                                                                    |
| Dead `PROFILE_TELEGRAM` constant                     | Resolved in Step 1 — delete it; TypeScript catches any missed consumer                                                                                                        |
| Wrong sidebar position                               | Confirmed: position 51 slots between Chat (50) and Agents (90) — verified against actual `options.ts` values                                                                  |
| Users confused about personal vs. workspace Telegram | Two surfaces have different scopes and live at different URLs; the Profile Integrations tab retains personal linking. No UI change needed — they were already separate pages. |
| No backend changes required                          | This is purely a frontend routing/navigation change                                                                                                                           |

---

## UI Clarification — Two Telegram Surfaces

After this refactor, Telegram appears in two places in the app. This is
intentional and correct:

| Surface                | URL                               | Scope                                 | Stays or moves?      |
| ---------------------- | --------------------------------- | ------------------------------------- | -------------------- |
| Sidebar "Telegram"     | `/dashboard/telegram`             | Workspace group chats (org-level)     | **Moves here (new)** |
| Profile → Integrations | `/dashboard/profile/integrations` | Personal account linking (user-level) | Stays unchanged      |

No UI copy changes are needed — the two features have distinct purposes and are
unlikely to cause user confusion. If users report confusion, a future ticket can
add a cross-link from the Telegram page to the Integrations tab.

---

## Performance Notes

- `Promise.all` is the correct pattern — both `getTelegramChats` and
  `getOrganizations` are required before rendering; streaming with Suspense
  would offer no benefit
- `getOrganizations` is wrapped in React `cache()` (deduplicating calls within a
  request); `getTelegramChats` is not. Low-priority: wrap it in `cache()` in a
  separate cleanup ticket if it becomes a bottleneck
- The new `/dashboard/telegram` route follows the same SSR-first pattern as all
  other dashboard pages; no `'use client'` is introduced at the page level

---

## References

- Existing page: `app/dashboard/profile/telegram/page.tsx`
- Feature: `features/telegram/` (api, ui, model)
- Sidebar menu: `features/menu/lib/options.ts`
- Sidebar menu test: `features/menu/lib/__tests__/options.test.ts`
- Route constants: `shared/lib/routes.ts:34–40`
- Profile tabs nav: `features/user-profile/ui/profile-tabs-nav.tsx:11`
- Menu preferences: `features/user-profile/model/menu-settings.ts`
  (`DEFAULT_PRIMARY_IDS`)
- Tab navigation convention: `CLAUDE.md` → "Tab Navigation Convention"
- Prior art (reverse of this task):
  `docs/plans/2026-05-15-refactor-move-telegram-to-profile-tab-plan.md`
