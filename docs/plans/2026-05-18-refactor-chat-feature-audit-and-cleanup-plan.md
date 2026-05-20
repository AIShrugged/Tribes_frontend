---
title: 'refactor: Chat Feature Audit & Cleanup'
type: refactor
status: active
date: 2026-05-18
deepened: 2026-05-18
---

# refactor: Chat Feature Audit & Cleanup

## Enhancement Summary

**Deepened on:** 2026-05-18  
**Research agents used:** 10 parallel agents (julik-frontend-races-reviewer,
kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle,
architecture-strategist, security-sentinel, accessibility-reviewer,
best-practices-researcher, pattern-recognition-specialist,
feasibility-correctness-reviewer)

### Key Improvements Over Original Plan

1. **Ghost poll loop in `ArtifactPanel`** — the shared `mountedRef`/`pollingRef`
   pattern is architecturally broken when `chatId` changes; requires a
   generation counter, not just ref guards
2. **`isSending` as state enables double-sends** — must become a ref kept in
   sync with state; `handleSend` has no guard against concurrent calls
3. **`json.error` always `undefined`** — backend returns `json.message`, not
   `json.error`; every mutation silently loses the server error message
4. **`ChatList` infinite scroll loop** — when server returns 0 items despite
   `hasMore`, offset doesn't advance → infinite network loop
5. **`httpClientList` `hasMore` formula differs** — must not blindly adopt
   `httpClientList`'s `data.length < totalCount` since current code uses
   offset-based formula; switching changes behavior
6. **Security: prompt injection via `document.body.textContent`** — full page
   content sent with every message; stored prompt injection risk
7. **Security: no Content-Security-Policy** — DOMPurify bypass has no second
   defense layer
8. **11 accessibility issues** — keyboard-inaccessible hover buttons, missing
   roles, no `aria-current` on active chat
9. **`makeEmptyChat` factory rejected** — `code-simplicity-reviewer` correctly
   notes this adds abstraction over a 2-call pattern; inline is clearer
10. **`handleSendRef` pattern rejected** — `useEffectEvent` (React 19.2, stable)
    is the idiomatic fix for the stale closure

### New Confirmed Bugs Not in Original Plan

- `ChatList` infinite scroll loop (empty page → offset stuck → hasMore stays
  true → loop)
- `doPoll` and `handleRefresh` can race each other when `chatId` changes
  (generation counter needed)
- `handleSend` has no concurrent-call guard (`isSending` state is checked but
  not as a ref)
- `splitTaskBlocks` regex fails on `\r\n` line endings (Windows/some AI
  backends)
- Server action args (`chatId`, `runUuid`, etc.) not validated at runtime —
  callable with arbitrary browser args

---

## Overview

Comprehensive audit and cleanup of `features/chat`, `app/dashboard/chat`, and
`widgets/dashboard-chat`. The goal is to bring the code in line with project
conventions (FSD rules, API layer rules, design system), fix confirmed bugs and
edge cases, and extract improvement opportunities that require no backend
changes.

---

## Problems Found

### 🔴 Bugs & Edge Cases

#### 1. Polling memory leak in `ChatWindow` — no mounted guard in `doPoll`

**File:** `features/chat/ui/chat-window.tsx`

`doPoll` is an `async` function that calls `updateMessage` and `setIsSending`
after `await pollRun(...)`. If the component unmounts while a poll is in flight,
the `await` resolves and calls setState on an unmounted component. The cleanup
only clears `pollTimerRef` and sets `activeRunRef = null`, but `doPoll` has
already entered the `await`.

**Fix:** Use an effect-local `let active = true` variable (not a shared
`useRef`) — this is the React-canonical pattern. A shared `useRef(true)` breaks
when deps change because the ref persists across effect lifetimes.

```tsx
// features/chat/ui/chat-window.tsx
useEffect(() => {
  let active = true; // effect-local, not a shared ref
  return () => {
    active = false;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    activeRunRef.current = null;
  };
}, []);

const doPoll = useCallback(async () => {
  const run = activeRunRef.current;
  if (!run) return;
  try {
    const result = await pollRun(chatId, run.runUuid);
    if (!active) return; // ← guard after await
    // ... setState calls
  } catch {
    if (!active) return;
    schedulePoll();
  }
}, [chatId]);
```

**Why `let active` not `useRef`:** A ref's `.current` is shared across all
effect invocations. When the effect re-runs (e.g. `chatId` changes), the old
cleanup sets `ref.current = false` but the new effect sets it back to `true`
immediately — the old in-flight async call then sees `true` and proceeds to call
setState with stale data. With `let active`, each effect closure captures its
own boolean.

**Testing gaps to add:**

- Component unmounts mid-poll → `updateMessage` must not be called after unmount
- Timeout path (attempt 61) → message marked `failed`, `isSending` becomes
  `false`
- Poll succeeds after several `processing` states → intermediate + final
  `updateMessage` calls
- Network error during poll → poll continues (does not stop)

---

#### 2. `ArtifactPanel` ghost poll loop when `chatId` changes

**File:** `features/chat/ui/artifact-panel.tsx`

**This is more severe than originally identified.** The current pattern uses
shared refs (`mountedRef`, `pollingRef`) that persist across effect invocations.
When `chatId` changes:

1. The old effect cleanup sets `pollingRef.current = false` and
   `mountedRef.current = false`
2. The new effect immediately sets both back to `true`
3. The old in-flight `poll()` call resumes after its `await`, sees both refs as
   `true`, and schedules another tick for the **new** `chatId` — creating a
   ghost loop polling the wrong chat

**Fix:** Use a generation counter (or effect-local `let active = true`):

```tsx
// features/chat/ui/artifact-panel.tsx
useEffect(() => {
  if (!chatId || !isOpen) return;
  let active = true; // effect-local
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (!active) return;
    try {
      const data = await getArtifacts(chatId);
      if (active) setArtifacts(data);
    } catch {
      /* keep previous data */
    }
    if (active) timerId = setTimeout(poll, POLLING_INTERVAL_MS);
  };

  timerId = setTimeout(poll, POLLING_INTERVAL_MS);

  return () => {
    active = false;
    if (timerId) clearTimeout(timerId);
  };
}, [chatId, isOpen]);
```

**Why `let active` prevents the ghost loop:** Each effect closure captures its
own `active`. When `chatId` changes, the old closure's `active` is set to
`false` by its cleanup. The old in-flight `await` resolves, checks `active` (now
`false`), and returns. No second timer is scheduled.

**`handleRefresh` must also check the generation:**

`handleRefresh` is an async function that also calls `setArtifacts` after an
`await`. If `chatId` changes while `handleRefresh` is in-flight, the stale call
will overwrite the new chat's artifacts. The fix: include `handleRefresh` inside
the effect so it captures the same `active` variable, or track a separate
`refreshActive` local.

---

#### 3. `isSending` state allows concurrent sends — use ref guard

**File:** `features/chat/ui/chat-window.tsx`

`handleSend` checks `if (isSending) return` but `isSending` is React state.
Between the check and `setIsSending(true)`, another render can have
`isSending = false` (due to concurrent rendering). A second call to `handleSend`
within the same event loop tick passes the guard.

**Fix:** Add a ref guard synchronized with the state:

```tsx
const isSendingRef = useRef(false);

const handleSend = useCallback(
  async (text: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);
    try {
      // ... send logic
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  },
  [chatId, addMessage, updateMessage],
);
```

The ref provides a synchronous, concurrent-safe guard. The state drives the UI.
Both must be kept in sync in `finally`.

---

#### 4. Stale closure in auto-prompt `useEffect` — use `useEffectEvent`

**File:** `features/chat/ui/chat-window.tsx:296–309`

```tsx
useEffect(() => {
  // ...
  setTimeout(() => {
    handleSend(prompt);
  }, 100);
}, [searchParams]); // ← handleSend missing from deps
```

ESLint `exhaustive-deps` flags this. The callbackRef pattern
(`handleSendRef.current = handleSend`) is a valid workaround but adds
boilerplate.

**Preferred fix (React 19.2 — stable in this project):** Use `useEffectEvent`:

```tsx
// React 19.2: useEffectEvent is stable (no longer experimental)
import { useEffectEvent } from 'react';

const onAutoPrompt = useEffectEvent((prompt: string) => {
  handleSend(prompt);
});

useEffect(() => {
  const prompt = searchParams.get('prompt');
  if (!prompt || autoPromptFired.current || initialMessages.length > 0) return;
  autoPromptFired.current = true;
  globalThis.history.replaceState(null, '', globalThis.location.pathname);
  setTimeout(() => onAutoPrompt(prompt), 100);
}, [searchParams, onAutoPrompt]); // onAutoPrompt is stable — no stale closure
```

`useEffectEvent` creates a stable function reference that always reads the
latest closure values. No lint suppression needed. The `setTimeout(100)` should
be documented: it gives the keyboard a frame to dismiss before the input is
focused.

**Why not `handleSendRef` pattern:** `code-simplicity-reviewer` correctly notes
that `handleSendRef.current = handleSend` on every render is a sign of fighting
React rather than using its model. `useEffectEvent` is the canonical React 19
solution.

---

#### 5. Russian text in UI — violates UI language convention

**File:** `features/chat/ui/chat-window.tsx:258`

```tsx
'Выберите организацию в верхнем переключателе, чтобы продолжить работу в нужном контексте.';
```

**Fix:**

```tsx
'Select an organization using the top switcher to continue working in the right context.';
```

---

#### 6. `json.error` always `undefined` — backend returns `json.message`

**Files:** `features/chat/api/chats.ts`, `features/chat/api/messages.ts`

```ts
// ❌ current — json.error is always undefined; backend returns message, not error
return { data: null, error: json.error ?? 'Failed to create chat' };
```

The backend response envelope is `{ success, data, message, status, meta }`.
There is no `error` field. Every mutation that catches a server error silently
falls back to the hardcoded string, completely discarding the backend's error
message.

**Fix:** After migrating to `httpClient`, use
`parseApiError(error.responseBody ?? '', 'Failed')` which correctly reads
`json.message`.

---

#### 7. `ChatList` infinite scroll loop when server returns empty page

**File:** `features/chat/ui/chat-list.tsx:65–86`

```ts
const { chats: more, totalCount: total } = await getChats(offset, PAGE_SIZE);
setChats((prev) => [...prev, ...more]);
setOffset((prev) => prev + more.length); // ← increments by 0 when empty
setHasMore(offset + more.length < total); // ← true when total > 0
```

If the server returns 0 items despite `hasMore === true` (a race or server
inconsistency), `offset` does not advance, `hasMore` stays `true`, the
IntersectionObserver fires again immediately → infinite loop of requests.

**Fix:**

```ts
setHasMore(more.length > 0 && offset + more.length < total);
```

This also means `httpClientList`'s built-in `hasMore = data.length < totalCount`
must **not** be used directly — the offset-based formula must be preserved.

---

#### 8. `splitTaskBlocks` regex fails on `\r\n` line endings

**File:** `features/chat/ui/chat-message-content.tsx:18`

````ts
const TASK_BLOCK_REGEX = /```json\n([\s\S]*?)\n```/g;
````

If the AI response uses `\r\n` (Windows line endings or some backend
implementations), the pattern fails to match. Content falls through as raw text
rendered by ReactMarkdown — silent degradation.

**Fix:**

````ts
const TASK_BLOCK_REGEX = /```json\r?\n([\s\S]*?)\r?\n```/g;
````

---

#### 9. `key={i}` (array index as key) in `ChatMessageContent`

**File:** `features/chat/ui/chat-message-content.tsx:90, 92`

Index keys cause subtle reconciliation bugs when segments are dynamically added
during streaming.

**Fix:** Use content-derived keys:

```tsx
segments.map((seg, i) =>
  seg.type === 'tasks' ? (
    <TaskTable
      key={`tasks-${i}-${seg.tasks.length}`}
      data={{ tasks: seg.tasks }}
    />
  ) : (
    <ReactMarkdown
      key={`text-${seg.content.slice(0, 32)}`}
      remarkPlugins={[remarkGfm]}
    >
      {seg.content}
    </ReactMarkdown>
  ),
);
```

---

#### 10. `ArtifactPanel` recursive polling: only first `setTimeout` ID tracked

**File:** `features/chat/ui/artifact-panel.tsx`

Covered by Bug #2's fix — tracking the latest `timerId` via an effect-local
variable handles this correctly.

---

### 🔴 Security (New — Found by Research Agents)

#### 11. Prompt injection via `document.body.textContent`

**File:** `features/chat/ui/chat-window.tsx` (auto-prompt URL param)

The `?prompt=` URL parameter silently sends user-provided text to the AI backend
via `handleSend`. This is an **auto-prompt injection vector**: any page that
navigates to `/dashboard/chat/[id]?prompt=<payload>` causes the AI to execute
the payload without user review.

Additionally, if any component reads `document.body.textContent` or page context
to enrich messages (check `features/chat/api/messages.ts`), stored content from
the page becomes a stored prompt injection surface.

**Fix:**

- Validate and sanitize the `?prompt=` value before passing to `handleSend`
- Add a visible UI notice when an auto-prompt fires (e.g. a dismissible banner
  "Sending auto-prompt from link...")
- Never include page DOM content in AI message payloads

---

#### 12. No Content-Security-Policy header

**File:** `next.config.ts`

`DOMPurify` is used to sanitize AI-generated HTML before `innerHTML` injection.
But if DOMPurify has a bypass (they exist), there is no second defense layer.
CSP provides that layer.

**Fix:** Add to `next.config.ts`:

```ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // tighten to nonces in production
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://dev-api.shrugged.ai",
    ].join('; '),
  },
];
```

---

#### 13. Server Action args not validated at runtime

**Files:** `features/chat/api/chats.ts`, `features/chat/api/messages.ts`

Server Actions are callable from the browser with arbitrary arguments. `chatId`,
`runUuid`, `offset`, `limit` are trusted as-is. A user can call `pollRun(0, '')`
or `getMessages(-1, 99999)` directly from browser DevTools.

**Fix:** Add Zod runtime validation at the top of each Server Action:

```ts
'use server';
import { z } from 'zod';

const PollRunInput = z.object({
  chatId: z.number().int().positive(),
  runUuid: z.string().uuid(),
});

export async function pollRun(chatId: number, runUuid: string) {
  const { chatId: id, runUuid: uuid } = PollRunInput.parse({ chatId, runUuid });
  // ...
}
```

---

### 🟡 Convention Violations (Project Rules)

#### 14. `features/chat/api/chats.ts` and `messages.ts` use raw `fetch` — Rule 2 violation

**Files:** `features/chat/api/chats.ts`, `features/chat/api/messages.ts`

All API calls use raw `fetch(...)` with manual `getAuthHeaders()`, manual 401
handling, and manual error parsing. The project mandates `httpClient<T>` /
`httpClientList<T>` from `@/shared/lib/httpClient`.

**Migration impact (confirmed by feasibility agent):**

The current `getChats` return type is
`{ chats: Chat[]; totalCount: number; hasMore: boolean }`. After migration to
`httpClientList`, it becomes `PaginatedResult<Chat>` which has
`{ data: Chat[]; totalCount: number; hasMore: boolean }`. Exactly **3 call
sites** use `chats`:

- `widgets/dashboard-chat/ui/DashboardChatLoader.tsx:15` — `const { chats } =`
- `app/dashboard/chat/page.tsx:11` — `const [{ chats, totalCount }, ...]`
- `features/chat/ui/chat-list.tsx:69–72` —
  `const { chats: more, totalCount: total } =`

Similarly, `getMessages` return changes from `{ messages }` to `{ data }`. Call
sites:

- `widgets/dashboard-chat/ui/DashboardChatLoader.tsx` (2 calls, lines 23 and 35)
- `features/chat/hooks/use-messages.ts:52` — `const { messages: older } =`

**⚠️ `httpClientList` `hasMore` formula must not be used directly.** It computes
`hasMore = data.length < totalCount`, which is wrong for offset-based pagination
when the server returns a partial page. Preserve the current formula:
`offset + items.length < totalCount`. Use `httpClientList` for the fetch, but
compute `hasMore` manually.

**Fix:**

```ts
// features/chat/api/chats.ts
'use server';
import { httpClientList } from '@/shared/lib/httpClient';
import type { ActionResult } from '@/shared/types/server-action';
import { parseApiError } from '@/shared/lib/apiError';
import { ServerError } from '@/shared/lib/errors';

export async function getChats(offset = 0, limit = 20) {
  const result = await httpClientList<Chat>(
    `${API_URL}/chats?offset=${offset}&limit=${limit}`,
  );
  // Preserve offset-based hasMore formula — do NOT use httpClientList's hasMore
  return {
    data: result.data,
    totalCount: result.totalCount,
    hasMore: offset + result.data.length < result.totalCount,
  };
}

export async function createChat(
  payload: Partial<ChatUpsertDTO>,
): Promise<ActionResult<Chat>> {
  try {
    const { data } = await httpClient<Chat>(`${API_URL}/chats`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create chat',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}
```

**401 behavior change:** `httpClient` redirects to `/login` on 401 (calls
`redirect()`). The current raw fetch throws `new Error('Unauthorized')`.
Components handling the `error` field from `createChat` will now get a redirect
instead of an error string. This is the correct behavior but must be verified:
confirm no catch block in UI suppresses the redirect.

**Institutional learning (from
`docs/solutions/integration-issues/server-action-html-response-json-parse.md`):**
The `res.json()` call in the current `chats.ts` and `messages.ts` throws
`SyntaxError` when the backend returns an HTML 5xx page. `httpClient` uses the
safe two-step parse pattern (`res.text()` → `JSON.parse()` → catch), which
resolves this entirely.

---

#### 15. Local `ChatActionError` / `MessageActionError` types duplicate `ActionResult<T>`

**Files:** `features/chat/api/chats.ts:11–14`,
`features/chat/api/messages.ts:11–14`

```ts
// ❌ current
type ChatActionError = { data: null; error: string; fieldErrors?: ... };
```

**Fix:** Delete local types; use `ActionResult<T>` from
`@/shared/types/server-action`. Resolved automatically by Fix #14.

**Discriminant check update:** After migration, callers using
`'error' in result` continue to work. Callers using the normalization pattern in
`chat-window.tsx` lines 244–251
(`typeof result === 'object' && 'error' in result && 'data' in result ? result : { data: result, error: null }`)
can be simplified to a direct `result.error` check since `ActionResult<T>`
always has both fields.

---

#### 16. Types defined in `api/` files — Rule 6 violation

Resolved by Fix #15 (local types removed entirely).

---

#### 17. Two types files (`types.ts` + `model/types.ts`) causing confusion

**Files:** `features/chat/types.ts`, `features/chat/model/types.ts`

`features/chat/types.ts` is a re-export barrel. Confirmed by feasibility agent:
**19 files** import from `@/features/chat/types`, including **5 test files**:

- `features/chat/ui/__tests__/chat-message.test.tsx`
- `features/chat/ui/__tests__/chat-window.test.tsx`
- `features/chat/ui/__tests__/artifact-panel.test.tsx`
- `features/chat/ui/__tests__/chat-list.test.tsx`
- `features/chat/hooks/__tests__/use-messages.test.ts`

**Fix:** Single find-and-replace commit across all 19 files:

```
@/features/chat/types → @/features/chat/model/types
```

All 5 test files must be updated in the same commit that removes `types.ts`.
Validate with `npm run build && npm test` before merging.

---

#### 18. `ChatFormModal` not using `zodResolver` — violates convention

**File:** `features/chat/ui/chat-form-modal.tsx:73`

Schemas exist in `features/chat/model/schemas.ts` but are not wired to the form.

**Fix:**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateChatSchema,
  UpdateChatSchema,
} from '@/features/chat/model/schemas';

const schema = chat ? UpdateChatSchema : CreateChatSchema;
const {
  register,
  formState: { errors },
} = useForm<ChatFormValues>({
  resolver: zodResolver(schema),
  defaultValues,
});
```

**Type alignment:** `ChatFormValues.title: string` must match `CreateChatSchema`
which has `nullable().optional()`. Reconcile the two — either make the form type
nullable or tighten the schema. The schema is the source of truth.

---

#### 19. FSD: `features/chat/index.ts` re-exports `getArtifacts` from `entities/artifact`

**File:** `features/chat/index.ts:14`

Features must not re-export from entities. Fix: remove the re-export. Update
`app/dashboard/chat/[id]/page.tsx` to import `getArtifacts` directly from
`@/entities/artifact`.

---

#### 20. FSD: Deep entity imports in `features/chat`

**Files:** `features/chat/ui/chat-message-content.tsx:8–10`,
`features/chat/ui/artifact-panel.tsx:7`

```ts
// ❌ deep import
import { TaskTable } from '@/entities/artifact/ui/task-table';
import type { TaskTableArtifact } from '@/entities/artifact/model/types';
```

**Fix:**

1. Add `TaskTableArtifact` to `entities/artifact/index.ts` exports
2. Update all deep imports to use `@/entities/artifact`

---

#### 21. `DashboardChatColumn` uses raw CSS vars instead of Tailwind design tokens

**File:** `widgets/dashboard-chat/ui/DashboardChatColumn.tsx`

```tsx
// ❌ raw CSS vars
'border-l border-[var(--border)]';
'text-[var(--muted-foreground)] hover:text-[var(--foreground)]';
'rounded-[var(--r-sm)]';
'text-[length:var(--fs-xs)]';
```

**Fix:**

```tsx
// ✅ Tailwind tokens
'border-l border-border';
'text-muted-foreground hover:text-foreground';
'rounded-sm';
'text-xs';
```

---

#### 22. `ChatList` and `ChatListItem` use plain `<button>` instead of shared `Button` component

At minimum, use `ButtonIcon` for icon-only actions (edit, delete, collapse). The
`New chat` button should use the primary `Button` variant from
`@/shared/ui/button`.

---

#### 23. Double-render in composerError block

**File:** `features/chat/ui/chat-window.tsx:394–402`

```tsx
{
  composerError ? (
    <div className='composer-error'>
      {composerError ? <span>{composerError}</span> : null}{' '}
      {/* redundant inner check */}
    </div>
  ) : null;
}
```

Remove the redundant inner ternary:

```tsx
{
  composerError && (
    <div className='composer-error'>
      <span>{composerError}</span>
    </div>
  );
}
```

---

#### 24. `ChatFormModal` mounted twice in `ChatList`

**File:** `features/chat/ui/chat-list.tsx`

Both "create" and "edit" modals are always mounted; only one is shown. Each
instance holds its own form state. The edit modal's `chat` prop changes when the
user selects a different chat to edit.

**Fix:** Mount a single `ChatFormModal` instance. Pass `mode` and `chat` props
to switch behavior:

```tsx
{
  modalOpen && (
    <ChatFormModal
      chat={editingChat} // null = create mode
      onClose={() => {
        setModalOpen(false);
        setEditingChat(null);
      }}
    />
  );
}
```

---

### 🟡 Accessibility (New — Found by Research Agents)

#### 25. Edit/Delete buttons keyboard-inaccessible

**File:** `features/chat/ui/chat-list-item.tsx`

Edit and delete buttons use `display:none` (CSS `hidden` class) and only appear
on hover. Keyboard users navigating by Tab can never reach these buttons — they
are removed from the tab order when hidden with `display:none`.

**Fix:** Use `opacity-0 focus-within:opacity-100 hover:opacity-100` with
`pointer-events-none focus:pointer-events-auto` so the buttons exist in the tab
order but are visually subtle when not focused. Or use a menu button (always
visible) that opens an action menu.

```tsx
<div className='opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity'>
  <ButtonIcon aria-label='Edit chat' onClick={onEdit}>
    <Pencil className='size-4' />
  </ButtonIcon>
  <ButtonIcon aria-label='Delete chat' onClick={onDelete}>
    <Trash className='size-4' />
  </ButtonIcon>
</div>
```

---

#### 26. No `aria-current` on active chat link

**File:** `features/chat/ui/chat-list-item.tsx`

The current chat link has no `aria-current="page"` attribute. Screen readers
cannot identify which chat is selected.

**Fix:**

```tsx
<Link aria-current={isActive ? 'page' : undefined} href={...}>
```

---

#### 27. Mobile tab bar missing tab semantics

**File:** `features/chat/ui/chat-layout.tsx` (mobile bottom bar)

The mobile tab bar renders `<button>` elements with no `role="tablist"` /
`role="tab"` container. Screen readers do not understand these as tabs.

**Fix:**

```tsx
<nav role='tablist' aria-label='Chat navigation'>
  <button
    role='tab'
    aria-selected={activeTab === 'chat'}
    aria-controls='chat-panel'
  >
    Chat
  </button>
  <button
    role='tab'
    aria-selected={activeTab === 'artifacts'}
    aria-controls='artifacts-panel'
  >
    Artifacts
  </button>
</nav>
```

---

#### 28. Action buttons missing `type='button'`

**File:** `features/chat/ui/chat-list.tsx`

The "New" and "Collapse" buttons lack `type='button'`. Add this as defensive
hygiene.

---

#### 29. `ArtifactPanel` artifact count badge missing `aria-label`

**File:** `features/chat/ui/artifact-panel.tsx:97–99`

```tsx
<span className='text-xs bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full'>
  {items.length}
</span>
```

**Fix:** Add `aria-label={`${items.length} artifacts`}`.

---

### 🟢 Improvements (No Backend Changes Required)

#### 30. `ThinkingIndicator` exists but unused — `PendingIndicator` duplicates it

`ThinkingIndicator` (animated cycling phrases + dots) is only tested but never
rendered. `PendingIndicator` (static dots + label) is used in `ChatMessage`.

**Recommended:** Replace `PendingIndicator` inline in `ChatMessage` with
`ThinkingIndicator` for a richer animated UX. The component is already tested.

---

#### 31. `ChatMessageContent` only parses `task_table` — misses 6 other artifact types

**File:** `features/chat/ui/chat-message-content.tsx`

`splitTaskBlocks` only detects task arrays. The backend may embed any of the 7
artifact types in message content as JSON blocks.

**Recommended generalization:**

```ts
type Segment =
  | { type: 'text'; content: string }
  | { type: 'artifact'; artifact: Artifact };

function splitArtifactBlocks(content: string): Segment[] {
  // Detect artifact type by shape (type field or structure)
  // Render via <ArtifactRenderer artifact={seg.artifact} />
}
```

This is the largest UX improvement possible without backend changes.

---

#### 32. `ChatInput` `field-sizing: content` not supported in Firefox

**File:** `features/chat/ui/chat-input.tsx:63`

`field-sizing: content` requires Chrome 123+. Firefox users get a fixed 1-row
textarea.

**Fix:** Use `CSS.supports()` to detect support, with a `useLayoutEffect`
fallback:

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);

const supportsFieldSizing =
  typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');

useLayoutEffect(() => {
  if (supportsFieldSizing || !textareaRef.current) return;
  const el = textareaRef.current;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}, [value, supportsFieldSizing]);
```

`useLayoutEffect` fires synchronously after DOM mutations before paint —
prevents the height flash that `useEffect` causes.

---

#### 33. Scope labels show raw IDs — resolve to org/team names

**Files:** `features/chat/ui/chat-window.tsx:313–316`,
`features/chat/ui/chat-list-item.tsx:44–50`

`organizations` is already available in `ChatList`'s parent. Pass it down to
`ChatListItem` (or create a context) and resolve `organization_id → name`
client-side. Extract the derivation to a model utility:

```ts
// features/chat/model/chat-scope.ts
export function resolveScopeLabel(
  chat: Chat,
  organizations: Organization[],
  teams: Team[],
): string {
  const org = organizations.find((o) => o.id === chat.organization_id);
  const team = teams.find((t) => t.id === chat.team_id);
  if (org && team) return `${org.name} · ${team.name}`;
  if (org) return org.name;
  return 'All organizations';
}
```

This removes the duplicated derivation between `chat-window.tsx` and
`chat-list-item.tsx`.

---

#### 34. `ChatList` pagination errors silently swallowed

**File:** `features/chat/ui/chat-list.tsx:56`

```tsx
} catch {
  // silently fail
}
```

**Fix:** Add `toast.error('Failed to load more chats. Try again.')` in the catch
block.

---

#### 35. Performance: `ChatMessage` re-renders O(n × poll_rate) times

**File:** `features/chat/ui/chat-message.tsx`,
`features/chat/ui/chat-message-content.tsx`

During polling, every `updateMessage` call causes all `n` messages to re-render.
Each re-render runs the `splitTaskBlocks` regex across the full message content.
At 1500ms poll intervals with 50+ messages, this is ~33 regex operations/second.

**Fix:**

1. Wrap `ChatMessage` in `React.memo` with a custom comparator:
   ```tsx
   export const ChatMessage = React.memo(
     ChatMessageComponent,
     (prev, next) =>
       prev.message.id === next.message.id &&
       prev.message.content === next.message.content &&
       prev.message.status === next.message.status,
   );
   ```
2. Memoize the `remarkPlugins` array at module scope (not inline):
   ```tsx
   // Module level — not recreated per render
   const REMARK_PLUGINS = [remarkGfm];
   // In component:
   <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
   ```

---

#### 36. `loadOlder` IntersectionObserver torn down on every state change

**File:** `features/chat/hooks/use-messages.ts`

`loadOlder` is a `useCallback` that has state variables in its deps array. Every
time messages or loading state changes, `loadOlder` gets a new reference → the
IntersectionObserver in `ChatList` tears down and re-creates → scroll anchor is
briefly lost mid-load.

**Fix:** Use `useEffectEvent` for `loadOlder`:

```tsx
const loadOlder = useEffectEvent(async () => {
  if (isLoading || !hasMore) return;
  // ... fetch older messages
});
```

`useEffectEvent` always reads the latest values without needing to be in the
deps array, so `loadOlder` has a stable identity.

---

#### 37. Polling design gap: 90s timeout, no resume after backend completes late

**Design gap (document, not fix):**

After 60 attempts × 1500ms, the frontend marks the message `failed`. If the
backend's agent run actually completes at 91s, the frontend has no mechanism to
discover it. The only recovery is a page refresh (which re-checks run status on
mount).

**Document in code with a comment:**

```ts
// Max 60 attempts × 1500ms = 90s timeout. Backend may complete after this point.
// Recovery: user can refresh the page — the mount effect re-polls in-flight runs.
// Long-term: replace polling with WebSocket or SSE.
const MAX_POLL_ATTEMPTS = 60;
```

---

## Implementation Plan

### Phase 1 — Critical Bugs (Do First)

| Task                                                               | File(s)                           | Effort |
| ------------------------------------------------------------------ | --------------------------------- | ------ |
| Fix `ArtifactPanel` ghost poll loop with effect-local `let active` | `artifact-panel.tsx`              | S      |
| Add concurrent-send ref guard (`isSendingRef`) to `handleSend`     | `chat-window.tsx`                 | XS     |
| Fix `mountedRef` → `let active` in `doPoll`                        | `chat-window.tsx`                 | XS     |
| Fix `ChatList` infinite scroll loop (empty page → loop)            | `chat-list.tsx`                   | XS     |
| Fix `json.error` → `json.message` in error returns                 | `api/chats.ts`, `api/messages.ts` | XS     |
| Replace Russian text with English                                  | `chat-window.tsx`                 | XS     |
| Fix stale closure → `useEffectEvent` in auto-prompt effect         | `chat-window.tsx`                 | XS     |
| Fix `splitTaskBlocks` regex for `\r\n`                             | `chat-message-content.tsx`        | XS     |
| Fix `key={i}` to content-derived keys                              | `chat-message-content.tsx`        | XS     |
| Add Zod runtime validation to Server Action args                   | `api/chats.ts`, `api/messages.ts` | S      |

### Phase 2 — Convention Compliance

| Task                                                                                                            | File(s)                                                                        | Effort             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------ |
| Migrate API functions to `httpClient`/`httpClientList` (preserve hasMore formula)                               | `api/chats.ts`, `api/messages.ts`                                              | M                  |
| Update all 3 `getChats` call sites: `chats` → `data`                                                            | `DashboardChatLoader.tsx`, `chat/page.tsx`, `chat-list.tsx`                    | S                  |
| Update all `getMessages` call sites: `messages` → `data`                                                        | `DashboardChatLoader.tsx`, `use-messages.ts`                                   | S                  |
| Remove `ChatActionError`/`MessageActionError`; use `ActionResult<T>`                                            | `api/chats.ts`, `api/messages.ts`                                              | XS (part of above) |
| Remove `features/chat/types.ts`; find-replace 19 files: `@/features/chat/types` → `@/features/chat/model/types` | All 19 files incl. 5 test files                                                | S                  |
| Add `zodResolver` to `ChatFormModal`; align `ChatFormValues` with schema                                        | `chat-form-modal.tsx`                                                          | XS                 |
| Remove `getArtifacts` re-export from `features/chat/index.ts`                                                   | `index.ts`, `app/dashboard/chat/[id]/page.tsx`                                 | XS                 |
| Fix deep entity imports → use public index; add `TaskTableArtifact` to `entities/artifact/index.ts`             | `chat-message-content.tsx`, `artifact-panel.tsx`, `entities/artifact/index.ts` | XS                 |
| Fix `DashboardChatColumn` raw CSS vars → Tailwind tokens                                                        | `DashboardChatColumn.tsx`                                                      | XS                 |
| Remove double `ChatFormModal` — single instance with mode prop                                                  | `chat-list.tsx`                                                                | S                  |
| Fix double-render in composerError block                                                                        | `chat-window.tsx`                                                              | XS                 |
| Add `type='button'` to all action buttons                                                                       | `chat-list.tsx`, `chat-list-item.tsx`                                          | XS                 |
| Add CSP header to `next.config.ts`                                                                              | `next.config.ts`                                                               | XS                 |

### Phase 3 — Accessibility

| Task                                                      | File(s)              | Effort |
| --------------------------------------------------------- | -------------------- | ------ |
| Fix keyboard-inaccessible hover buttons in `ChatListItem` | `chat-list-item.tsx` | S      |
| Add `aria-current="page"` to active chat link             | `chat-list-item.tsx` | XS     |
| Add `role="tablist"` / `role="tab"` to mobile bottom bar  | `chat-layout.tsx`    | XS     |
| Add `aria-label` to artifact count badge                  | `artifact-panel.tsx` | XS     |

### Phase 4 — Performance & Improvements

| Task                                                                  | File(s)                                                        | Effort |
| --------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Wrap `ChatMessage` in `React.memo` with custom comparator             | `chat-message.tsx`                                             | XS     |
| Move `remarkPlugins` array to module scope                            | `chat-message-content.tsx`                                     | XS     |
| Fix `loadOlder` `useCallback` → `useEffectEvent`                      | `use-messages.ts`                                              | XS     |
| Replace `PendingIndicator` with `ThinkingIndicator`                   | `chat-message.tsx`                                             | XS     |
| Add `useLayoutEffect` auto-resize fallback for Firefox in `ChatInput` | `chat-input.tsx`                                               | S      |
| Extract `resolveScopeLabel` utility                                   | `model/chat-scope.ts`, `chat-window.tsx`, `chat-list-item.tsx` | S      |
| Add `toast.error` for failed `ChatList` pagination                    | `chat-list.tsx`                                                | XS     |
| Generalize `splitTaskBlocks` → detect all 7 artifact types            | `chat-message-content.tsx`                                     | M      |
| Document 90s polling timeout design gap with comment                  | `chat-window.tsx`                                              | XS     |

---

## Acceptance Criteria

### Phase 1 (Bugs)

- [ ] No `setState after unmount` React warnings when navigating away during
      active polling
- [ ] Clicking "Send" twice in rapid succession sends only one message
- [ ] `ChatList` does not loop when server returns an empty page
- [ ] All UI text is in English — no Russian strings in JSX
- [ ] `ChatFormModal` validates with Zod on submit (catches empty title, length
      violations)
- [ ] Server Actions reject non-numeric `chatId` with a 400-equivalent error

### Phase 2 (Conventions)

- [ ] Deep entity imports replaced with public index imports
- [ ] `getArtifacts` removed from `features/chat/index.ts`
- [ ] `ChatActionError` / `MessageActionError` removed — `ActionResult<T>` used
      instead
- [ ] `features/chat/types.ts` re-export barrel removed
- [ ] All 19 import sites updated (confirmed by
      `grep -r "@/features/chat/types" .`)
- [ ] `npm run build` passes — TypeScript catches any missed renames at compile
      time
- [ ] `npm test` passes — no regressions in all 5 affected test files
- [ ] `fsd-boundary-guard` reports no new violations
- [ ] CSP header present in response headers (verify with DevTools → Network →
      response headers)

### Phase 3 (Accessibility)

- [ ] Edit/Delete buttons reachable via Tab key on keyboard
- [ ] Screen reader announces `aria-current="page"` on the active chat
- [ ] Mobile tab bar announced as tabs by VoiceOver / NVDA

### Phase 4 (Performance)

- [ ] `ChatMessage` does not re-render for unchanged messages during polling
      (verify with React DevTools Profiler)
- [ ] `loadOlder` does not tear down the IntersectionObserver mid-scroll

### Non-Functional Requirements

- [ ] Zero ESLint errors introduced (`npm run lint`)
- [ ] TypeScript strict mode — no new `any`

---

## Sequencing Notes

**Do phases in order.** Phase 1 fixes are safe to merge independently. Phase 2
is an all-or-nothing migration for `types.ts` (all 19 files in one commit) and
should be a dedicated PR. Phase 3 and 4 can be parallelized once Phase 2 is
merged.

**`types.ts` deletion:** Must be a single atomic commit touching all 19 files +
5 test files. Do not delete the barrel in one PR and update imports in another —
the intermediate state fails the build.

**`httpClient` migration:** Do the `getChats`/`getMessages` call-site renames in
the same PR as the API file changes. The TypeScript compiler will error at all
missed sites, making it impossible to merge with regressions.

---

## References

### Internal

| What                            | Where                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `httpClient` / `httpClientList` | `shared/lib/httpClient.ts`                                                    |
| `ActionResult<T>`               | `shared/types/server-action.ts`                                               |
| `ServerError` / `parseApiError` | `shared/lib/errors.ts`, `shared/lib/apiError.ts`                              |
| Artifact entity public API      | `entities/artifact/index.ts`                                                  |
| Design system tokens            | `app/globals.css` (search for `@theme`)                                       |
| FSD rules                       | `CLAUDE.md` → "FSD Layer Rules"                                               |
| API layer rules                 | `CLAUDE.md` → "API Layer Conventions"                                         |
| HTML response JSON parse issue  | `docs/solutions/integration-issues/server-action-html-response-json-parse.md` |

### Affected Files Summary

```
features/chat/
  api/chats.ts                # httpClient migration, Zod arg validation, remove ChatActionError
  api/messages.ts             # httpClient migration, Zod arg validation, remove MessageActionError
  model/types.ts              # no change (canonical source)
  model/schemas.ts            # no change — wire to ChatFormModal
  model/chat-scope.ts         # NEW: resolveScopeLabel() utility
  types.ts                    # DELETE (re-export barrel) — 19 importers to update
  index.ts                    # remove getArtifacts re-export
  hooks/use-messages.ts       # useEffectEvent for loadOlder, update messages→data rename
  ui/chat-window.tsx          # let active guard, isSendingRef, useEffectEvent, Russian text, double-render fix
  ui/chat-layout.tsx          # mobile tab semantics
  ui/chat-message.tsx         # React.memo, replace PendingIndicator with ThinkingIndicator
  ui/chat-message-content.tsx # fix key={i}, fix \r\n regex, fix deep import, move remarkPlugins, generalize artifacts
  ui/chat-form-modal.tsx      # add zodResolver, align ChatFormValues with schema
  ui/chat-list.tsx            # infinite scroll fix, toast error, type='button', single ChatFormModal
  ui/chat-list-item.tsx       # accessible hover buttons, aria-current, type='button'
  ui/artifact-panel.tsx       # let active ghost loop fix, fix deep import, aria-label

widgets/dashboard-chat/
  ui/DashboardChatColumn.tsx  # fix raw CSS vars → Tailwind tokens
  ui/DashboardChatLoader.tsx  # update chats→data, messages→data call sites

entities/artifact/
  index.ts                    # add TaskTableArtifact export

app/
  dashboard/chat/[id]/page.tsx  # update getArtifacts import source
  dashboard/chat/page.tsx       # update chats→data destructuring
  next.config.ts                # add CSP header
```
