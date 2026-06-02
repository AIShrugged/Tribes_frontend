---
title: Fix chat list organization scoping — enforce active organization filter
type: fix
status: completed
date: 2026-05-29
---

# Fix chat list organization scoping — enforce active organization filter

## Enhancement Summary

**Deepened on:** 2026-05-29 **Research agents used:** TypeScript reviewer,
Architecture strategist, Code simplicity reviewer, Race-condition reviewer,
Performance oracle, Security sentinel

### Key Improvements Added

1. **Race condition discovered** — in-flight `loadMore` pagination can append
   old-org chats onto new-org list during fast org switching; requires
   generation counter fix (modeled on `shared/hooks/use-infinite-scroll.ts`)
2. **Scope expanded** — `ChatFormModal` has the same `organizationId?: number`
   optional lie; fix must include that component
3. **`currentChat` should be required** — the `ChatLayout` fallback object is
   structurally unreachable; removing it is cleaner than patching the
   `organization_id: null` field
4. **Type mismatch in `Chat`** — `organization_id?: number | null` should be
   `organization_id: number | null` (remove `?`); same for `team_id`
5. **FSD violation found** — `widgets/dashboard-chat` imports from deep
   `features/chat/api/*` paths instead of `@/features/chat` public API
6. **Security gap** — `setActiveOrganization()` writes the cookie without
   verifying user membership in the requested org

### New Considerations Discovered

- The `revalidatePath('/dashboard', 'layout')` blast radius is too broad —
  poisons cache for all dashboard sub-routes on org switch
- Duplicate `getChats` fetch: `DashboardChatLoader` in the layout calls it, and
  `chat/page.tsx` calls it again on the same render cycle
- The `ChatList` component duplicates pagination logic that
  `shared/hooks/use-infinite-scroll.ts` already handles correctly — the custom
  implementation is missing the generation counter that the shared hook has

---

## Overview

The `/dashboard/chat` page must display only chats belonging to the currently
active organization. The backend API (`GET /api/v1/chats`) **requires**
`organization_id` as a mandatory parameter — omitting it returns HTTP 422. The
page already calls `getOrganizationId()` and passes the value to `getChats()`,
but `organizationId` is typed as `optional` in `ChatList`, `ChatLayout`, and
`ChatFormModal` components, creating dead-code branches and a latent race
condition. This plan tightens the type contract, removes ~25 lines of dead code,
and adds a generation counter to prevent old-org chat contamination during fast
org switching.

---

## Problem Statement

### What the user reported

The chat page should show only chats for the active organization. The current
behavior may be inconsistent — chats from other organizations could appear if
the optional `organizationId` prop is not passed, or the list may not refresh
correctly on org switch.

### Root causes found

1. **`organizationId` typed as optional in `ChatList`, `ChatLayout`, and
   `ChatFormModal`** — `organizationId?: number` is a lie: the page always
   provides it via `getOrganizationId()` which redirects to login on failure.
   This creates ~8 dead defensive branches across three components.

2. **Race condition: old-org chats appended onto new-org list** — when the user
   switches org while a `loadMore` pagination request is in-flight, the awaited
   result resolves after `useEffect([initialChats])` has already reset to the
   new org's page 1. React applies both state updates: new org's chats first,
   then old org's page 2 appends onto them. Result: visually correct list
   header + contaminated tail. The `organizationId === undefined` guard being
   removed does **not** fix this — a generation counter is required.

3. **`Chat` type has `organization_id?: number | null`** — the `?` makes the
   field optionally absent, but the backend `ChatResource` always returns it
   (it's `int`, nullable only when set to null in the DB). Should be
   `number | null` (non-optional).

4. **`ChatLayout.currentChat` fallback is dead code** — `currentChat` is always
   provided (`page.tsx` calls `getChat(chatId)` which throws on 404 before
   `ChatLayout` renders). The fallback object with `organization_id: null` is
   structurally unreachable but incorrectly typed.

5. **FSD violation in widget layer** —
   `widgets/dashboard-chat/ui/DashboardChatLoader.tsx` and
   `MobileChatDrawerLoader.tsx` import from deep paths
   `@/features/chat/api/chats` and `@/features/chat/api/messages` instead of the
   public API `@/features/chat`.

### Backend contract (verified)

| Endpoint        | Method | Required params                                                                |
| --------------- | ------ | ------------------------------------------------------------------------------ |
| `/api/v1/chats` | GET    | `organization_id` (integer, required), `offset` (nullable), `limit` (nullable) |

Source: `ChatRequest.php:23–28`, `ChatController.php:58–86`,
`ChatService.php:11–18`

The service layer does:
`$user->chats()->where('organization_id', $organizationId)->orderByDesc('updated_at')`.
The filter is always applied — there is no "all orgs" mode.

**Security:** Backend has two layers of enforcement:

1. `TenantScopeValidator::assertScopeIsValid` — 422 if user not a member of
   requested org
2. `ChatService` — always scopes by `user_id` in addition to `organization_id`

---

## Proposed Solution

### Change 1 — Make `organizationId` required in `ChatListProps` + remove dead guards

**File:** `features/chat/ui/chat-list.tsx`

```tsx
interface ChatListProps {
  initialChats: Chat[];
  totalCount: number;
  activeChatId?: number;
  organizations?: OrganizationProps[];
  organizationId: number; // was: organizationId?: number
  onActiveChatUpdate?: (chat: Chat) => void;
}
```

Dead code to remove:

- Line 70: `|| organizationId === undefined` clause in the `loadMore` guard →
  `if (isLoading || !hasMore) return;`
- Lines 185–189: `disabled={organizationId === undefined}` on New button + the
  early-return in `onClick`
- Lines 211–215:
  `{organizationId === undefined && !isLoading && <p>Select an organization...</p>}`
- Line 217: `organizationId !== undefined &&` prefix on the empty-state
  condition

### Change 2 — Add generation counter to `loadMore` to prevent mixed-org contamination

**File:** `features/chat/ui/chat-list.tsx`

This is the most important correctness fix. Modeled on
`shared/hooks/use-infinite-scroll.ts:100–106`.

```tsx
const generationRef = useRef(0);

// In the useEffect that syncs initial state:
useEffect(() => {
  generationRef.current += 1; // invalidate any in-flight loadMore
  setChats(initialChats);
  setOffset(initialChats.length);
  setHasMore(initialChats.length < totalCount);
  setIsLoading(false); // cancel spinner too
}, [initialChats, totalCount]);

// In loadMore:
const loadMore = useCallback(async () => {
  if (isLoading || !hasMore) return;
  const generation = generationRef.current; // capture before await
  setIsLoading(true);
  try {
    const { data: more, totalCount: total } = await getChats(
      organizationId,
      offset,
      PAGE_SIZE,
    );
    if (generationRef.current !== generation) return; // org switched mid-flight — discard
    setChats((prev) => [...prev, ...more]);
    setOffset((prev) => prev + more.length);
    setHasMore(more.length > 0 && offset + more.length < total);
  } catch {
    toast.error('Failed to load more chats. Try again.');
  } finally {
    if (generationRef.current === generation) setIsLoading(false);
  }
}, [isLoading, hasMore, organizationId, offset]);
```

### Change 3 — Make `organizationId` required in `ChatLayoutProps` + make `currentChat` required

**File:** `features/chat/ui/chat-layout.tsx`

```tsx
interface ChatLayoutProps {
  // ...
  currentChat: Chat; // was: currentChat?: Chat
  organizationId: number; // was: organizationId?: number
}
```

The `useState` initializer simplifies from the 9-line fallback object to:

```tsx
const [chat, setChat] = useState<Chat>(currentChat);
```

Delete the entire fallback object — it was unreachable and had
`organization_id: null` (incorrect).

### Change 4 — Make `organizationId` required in `ChatFormModalProps` + remove dead guards

**File:** `features/chat/ui/chat-form-modal.tsx`

```tsx
interface ChatFormModalProps {
  // ...
  organizationId: number; // was: organizationId?: number
}
```

Dead code to remove:

- `onSubmit` early-return guard:
  `if (!isEdit && organizationId === undefined) return;`
- Conditional spread:
  `...(organizationId !== undefined && { organization_id: organizationId })` →
  `organization_id: organizationId`
- `helperText` branch that tests `organizationId === undefined`

### Change 5 — Fix `Chat` type: remove `?` from `organization_id` and `team_id`

**File:** `features/chat/model/types.ts`

```tsx
// Before
organization_id?: number | null;
team_id?: number | null;

// After
organization_id: number | null;   // field always present, may be null
team_id: number | null;
```

Also update `makeChat` factory in test files accordingly (add
`organization_id: null, team_id: null` to test fixtures).

### Change 6 — Fix FSD deep imports in widget layer

**Files:** `widgets/dashboard-chat/ui/DashboardChatLoader.tsx`,
`widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx`

```tsx
// Before
import { getChats } from '@/features/chat/api/chats';
import { getMessages } from '@/features/chat/api/messages';

// After
import { getChats, getMessages } from '@/features/chat';
```

Both are already re-exported through `features/chat/index.ts`.

---

## Acceptance Criteria

### Core fixes (required)

- [x] `ChatListProps.organizationId` is `number` (required)
- [x] `ChatLayoutProps.organizationId` is `number` (required)
- [x] `ChatLayoutProps.currentChat` is `Chat` (required, not optional)
- [x] `ChatFormModalProps.organizationId` is `number` (required)
- [x] Dead `organizationId === undefined` guards removed from all three
      components (~8 branches)
- [x] Dead `"Select an organization to use chats"` empty-state UI removed
- [x] `ChatLayout` fallback `useState` object removed; initializer is just
      `useState<Chat>(currentChat)`
- [x] `Chat.organization_id` type is `number | null` (not `?: number | null`)
- [x] `Chat.team_id` type is `number | null` (not `?: number | null`)
- [x] Generation counter added to `ChatList.loadMore` to prevent old-org
      contamination

### FSD compliance

- [x] `widgets/dashboard-chat` imports `getChats` and `getMessages` from
      `@/features/chat` (not deep paths)

### Quality gates

- [x] `npm run build` — TypeScript compiles without errors
- [x] `npm test` — all existing tests pass (update test fixtures where
      `organization_id` was omitted)
- [ ] Manual: switch active org → chat list shows only new org's chats
- [ ] Manual: open `/dashboard/chat` in org A → only org A's chats appear

---

## Files to Change

| File                                                   | Type  | Change                                                                    |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------- |
| `features/chat/ui/chat-list.tsx`                       | Core  | Require `organizationId`; add generation counter; remove dead guards      |
| `features/chat/ui/chat-layout.tsx`                     | Core  | Require `organizationId` and `currentChat`; remove fallback state object  |
| `features/chat/ui/chat-form-modal.tsx`                 | Core  | Require `organizationId`; remove dead guards                              |
| `features/chat/model/types.ts`                         | Type  | `organization_id?: number \| null` → `number \| null`; same for `team_id` |
| `widgets/dashboard-chat/ui/DashboardChatLoader.tsx`    | FSD   | Fix deep import                                                           |
| `widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx` | FSD   | Fix deep import                                                           |
| Test fixtures (`makeChat` factory)                     | Tests | Add `organization_id: null, team_id: null` to test objects                |

**No changes needed:**

- `app/dashboard/chat/page.tsx` — already passes `organizationId` as required ✓
- `app/dashboard/chat/[id]/page.tsx` — already passes both `organizationId` and
  `currentChat` ✓
- `features/organization/api/organization.ts` — revalidation scope already
  covers chat ✓
- `features/chat/api/chats.ts` — already passes `organization_id` query param ✓

---

## Technical Context

### How `organizationId` flows (unchanged by this fix)

```
getOrganizationId()          ← reads 'organization_id' cookie, validates > 0, redirects on failure
    ↓ (number)
app/dashboard/chat/page.tsx  ← calls getChats(organizationId, 0, 20)
    ↓ (prop)
<ChatList organizationId={organizationId} />
    ↓ (captured in loadMore callback + generation counter guards it)
getChats(organizationId, offset, PAGE_SIZE)  ← sends ?organization_id=X to backend
```

### Org switch flow (verified correct)

```
User clicks org in OrganizationDropdown
    → setActiveOrganization() form action
    → writes 'organization_id' HTTP-only cookie
    → revalidatePath('/dashboard', 'layout')   ← invalidates dashboard SSR cache
    → user navigates → Server Component reads new cookie → fetches new org's chats
    → ChatList receives new initialChats prop
    → useEffect fires → generationRef.current++ → in-flight loadMore discards results
    → state reset to new org's page 1
```

### Generation counter pattern (from `shared/hooks/use-infinite-scroll.ts:100–106`)

The shared hook already implements this correctly. The `ChatList` duplicates the
pagination logic without this guard. The fix brings `ChatList` into alignment
with the existing shared pattern.

---

## Research Insights

### Race condition detail (from julik-frontend-races-reviewer)

Without a generation counter, fast org switching produces this sequence:

```
1. ChatList: loadMore() called → await getChats(orgA, offset=20) in flight
2. User switches to orgB
3. useEffect([initialChats]) fires → setChats(orgBPage1) → setOffset(20)
4. getChats(orgA, ...) resolves → setChats(prev => [...prev, ...orgAPage2])
   Result: [orgB chats 1-20] + [orgA chats 21-40] — CONTAMINATED
5. setOffset(prev => prev + 20) → offset = 40 (wrong for orgB)
```

**Impact:** Silent data contamination. Users see chats from the wrong
organization at the bottom of their list with no error indicator. This is the
most critical correctness bug uncovered by deepening.

### Architecture: why Pattern B (prop injection) is correct here (from architecture-strategist)

`getOrganizationId()` uses `next/headers` (`cookies()`), unavailable in Client
Components. `ChatList` calls `getChats()` from a client-side `loadMore` callback
for infinite scroll. The org ID must be injected via prop — Pattern A (server
action reads org internally) cannot work for client-triggered pagination calls
because `React.cache()` deduplication doesn't apply across the client-server
boundary.

### Performance note: duplicate `getChats` fetch (from performance-oracle)

`DashboardChatLoader` (in the dashboard layout) and
`app/dashboard/chat/page.tsx` both call `getChats(organizationId, 0, 20)` in the
same render cycle when the user is on `/dashboard/chat`. `DashboardChatColumn`
hides itself client-side on `/dashboard/chat/**` routes, but the server still
renders `DashboardChatLoader` and fires the fetch. Addressing this (moving the
hide-check server-side) is out of scope for this fix but logged as a follow-up.

### Security note: `setActiveOrganization` lacks membership validation (from security-sentinel)

`setActiveOrganization()` at `features/organization/api/organization.ts:186`
writes the `organization_id` cookie from `formData` without verifying the
authenticated user belongs to the requested org. A user could set their cookie
to an arbitrary org ID, which the backend then rejects with 422 on the next API
call (self-DoS, not data breach). Fixing this is out of scope here but should be
addressed in a follow-up security fix.

---

## Known Out-of-Scope Issues (Follow-up Candidates)

| Issue                                                                                    | File                                                | Priority        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------- |
| `setActiveOrganization` writes cookie without membership check                           | `features/organization/api/organization.ts:186`     | Medium security |
| `revalidatePath('/dashboard', 'layout')` blast radius too broad                          | `features/organization/api/organization.ts:202`     | Low performance |
| Duplicate `getChats` fetch when layout + page both render                                | `widgets/dashboard-chat/ui/DashboardChatLoader.tsx` | Low performance |
| `updateChat` missing `revalidatePath` (unlike `createChat`/`deleteChat`)                 | `features/chat/api/chats.ts`                        | Low correctness |
| `viewAny` in `ChatPolicy` delegates all scoping to `TenantScopeValidator` — undocumented | `ChatPolicy.php:12`                                 | Informational   |

---

## References

- Backend: `ChatController.php` — `organization_id` required, line 59
  `#[QueryParameter(required: true)]`
- Backend: `ChatRequest.php:23–28` — validation rules
- Backend: `ChatService.php:11–18` — `WHERE organization_id = $organizationId`
  filter
- Generation counter pattern: `shared/hooks/use-infinite-scroll.ts:100–106` —
  existing correct implementation
- `features/chat/index.ts` — public API re-exports (includes `getChats`,
  `getMessages`)
- Pattern reference: `features/issues/api/issue-stats.ts:13` —
  `const organizationId = await getOrganizationId()` inside server action
  (Pattern A, not applicable here)
- Pattern reference: `app/dashboard/teams/page.tsx:35` — prop injection pattern
  (Pattern B, same as chat)
