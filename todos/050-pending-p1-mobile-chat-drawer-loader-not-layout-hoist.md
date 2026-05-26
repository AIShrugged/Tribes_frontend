---
status: pending
priority: p1
issue_id: '050'
tags: [mobile-chat, architecture, server-components, streaming, next.js]
dependencies: []
---

# Create MobileChatDrawerLoader Server Component — Do Not Hoist Fetches Into layout.tsx

## Problem Statement

The plan proposes hoisting `getChats`/`getMessages` into
`app/dashboard/layout.tsx` to avoid "two DashboardChatLoader instances". This
reasoning is architecturally wrong: it converts currently-parallel
Suspense-streamed background fetches into a serial blocking step that gates
every dashboard page render — `/dashboard/kanban`, `/dashboard/agents/activity`,
`/dashboard/summary`, all of them — on chat data the user may not need.

## Findings

- `app/dashboard/layout.tsx` is the root shell for ALL dashboard routes. After
  the hoist, every dashboard navigation fires `getChats(0,20)` + up to two
  `getMessages(...)` calls before `page.tsx` can render — 2–3 extra serial
  round-trips per navigation.
- The existing `DashboardChatLoader` is correct: wrapped in `<Suspense>` inside
  `DashboardChatColumn`, it runs in parallel with the page's data, never
  blocking it. The layout hoist destroys this property.
- The "two loaders" duplication concern only exists if `MobileChatDrawer` is
  _also_ a Server Component fetcher. But the plan makes it a Client Component
  receiving props — which means the duplication problem is being created and
  solved simultaneously by the same change.
- `cache: 'no-store'` (confirmed `shared/lib/httpClient.ts:37`) means two
  parallel Server Component fetches fire concurrently during the same streaming
  render — they do NOT block each other.
- `/dashboard/chat` page does not use `DashboardChatLoader` at all — it fetches
  directly in `app/dashboard/chat/page.tsx` and
  `app/dashboard/chat/[id]/page.tsx`. After the hoist, `DashboardChatLoader`
  becomes dead code.

**Impact diagram:**

```
Current (correct):
  layout.tsx (sync: cookies, getUser, getOrganization) — resolves fast
    └─ DashboardChatLoader (parallel Suspense stream — never blocks page)

After plan's hoist (wrong):
  layout.tsx (serial: cookies → getUser → getOrg → getChats → getMessages x2)
    └─ page.tsx render BLOCKED until ALL of the above resolve
```

**Source:** Architecture Strategist review, finding #1 (HIGH severity).

## Proposed Solutions

### Option 1: Create `MobileChatDrawerLoader` as a parallel Server Component (Recommended)

**Approach:** Mirror the existing `DashboardChatLoader` pattern. Create
`widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx` as an async Server
Component that fetches and passes props to `MobileChatDrawer`. Include it in
layout alongside `DashboardChatColumn` under its own
`<Suspense fallback={null}>`.

```tsx
// widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx
import { getChats, getMessages } from '@/features/chat';
import { MobileChatDrawer } from './MobileChatDrawer';

export async function MobileChatDrawerLoader() {
  const LIMIT = 20;
  const { data: chats, totalCount } = await getChats(0, LIMIT);
  // ... same fetch logic as DashboardChatLoader
  return <MobileChatDrawer initialChats={chats} ... />;
}

// layout.tsx (no new fetches in async body):
<DashboardChatColumn>
  <DashboardChatLoader />        {/* existing — no change */}
</DashboardChatColumn>

<Suspense fallback={null}>
  <MobileChatDrawerLoader />     {/* new — parallel stream */}
</Suspense>
```

**Pros:**

- Preserves streaming parallel data loading
- Zero impact on page render TTFB
- `DashboardChatLoader` stays in use — no dead code
- Consistent with existing codebase pattern

**Cons:**

- Two sets of `getChats`/`getMessages` calls fire (but concurrently, not
  serially)
- Slightly more code than the hoist

**Effort:** 1–2 hours  
**Risk:** Low

---

### Option 2: Keep the layout hoist but accept the TTFB penalty

**Approach:** Proceed as the plan describes but document the serialization
penalty explicitly.

**Pros:** Simpler implementation — one data source **Cons:** Every dashboard
page load pays the chat fetch penalty; violates Next.js streaming best
practices; dead-codes `DashboardChatLoader`

**Effort:** 30 min  
**Risk:** Medium (performance regression on all dashboard routes)

## Recommended Action

Implement Option 1. Create `MobileChatDrawerLoader.tsx` following the same async
Server Component pattern as `DashboardChatLoader.tsx`. Do not add any fetch
calls to `layout.tsx`. If `DashboardChatLoader` would become unused after any
future changes, delete it at that point — do not leave it with a preservation
note.

## Technical Details

**Affected files:**

- `app/dashboard/layout.tsx` — NO changes to fetch logic; add
  `<MobileChatDrawerLoader>` wrapped in `<Suspense fallback={null}>`
- `widgets/dashboard-chat/ui/MobileChatDrawerLoader.tsx` — NEW: async Server
  Component (mirrors `DashboardChatLoader`)
- `widgets/dashboard-chat/ui/MobileChatDrawer.tsx` — NEW: Client Component
  (receives props from Loader)
- `widgets/dashboard-chat/ui/DashboardChatLoader.tsx` — NO CHANGES (stays in use
  for desktop column)
- `widgets/dashboard-chat/index.ts` — export `MobileChatDrawerLoader` and
  `MobileChatDrawer`

## Acceptance Criteria

- [ ] `app/dashboard/layout.tsx` has no new `await` calls in its async body
      compared to current
- [ ] `MobileChatDrawerLoader` is an async Server Component in
      `widgets/dashboard-chat/ui/`
- [ ] `MobileChatDrawerLoader` is included in layout under
      `<Suspense fallback={null}>`
- [ ] `DashboardChatLoader` still has at least one call site
- [ ] Opening DevTools Network tab on `/dashboard/agents` shows chat fetches in
      parallel with page data, not blocking it

## Work Log

### 2026-05-22 - Identified by Architecture Strategist review

**By:** Claude Code

**Actions:**

- Architecture Strategist found layout hoist converts parallel stream to serial
  block
- Confirmed `httpClient.ts:37` has `cache: 'no-store'` (no deduplication)
- Confirmed `/dashboard/chat` routes don't use `DashboardChatLoader`
- Documented parallel Server Component pattern as fix
