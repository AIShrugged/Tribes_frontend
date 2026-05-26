---
title: 'feat: LLM Prompts Management Tab in Agents Section'
type: feat
status: active
date: 2026-05-25
deepened: 2026-05-25
---

# feat: LLM Prompts Management Tab in Agents Section

## Enhancement Summary

**Deepened on:** 2026-05-25 **Research agents used:**
kieran-typescript-reviewer, security-sentinel, performance-oracle,
architecture-strategist, julik-frontend-races-reviewer,
code-simplicity-reviewer, best-practices-researcher (×2), agent-native-reviewer,
framework-docs-researcher

### Key Improvements from Deepening

1. **New FSD slice**: Move to `features/llm-prompts/` (not extending
   `features/agents/`) — architecturally, prompts are a distinct domain.
2. **Critical regex fix**: The shared `/g`-flag regex is stateful and will
   produce missed matches in loops. Remove the flag from the constant; construct
   fresh regexes at call sites.
3. **Race condition — PATCH + revalidatePath**: Server-confirmed revalidation
   can stomp on in-flight edits. A pending-edits guard is required.
4. **Security**: Backdrop overlay must use React JSX children (not `innerHTML`)
   to avoid XSS. Add a 100,000-char client-side max on prompt length. Add
   `isOrgManager` guard inside Server Actions.
5. **`cache()` misuse**: `react.cache()` only works for Server Component data
   helpers, not Server Actions. Split `getLlmPrompt` into a data helper (for
   page.tsx) and remove `cache()` from the action.
6. **`useActionState` vs `useTransition`**: Because this project uses
   `react-hook-form`, `useTransition` is correct. `useActionState` would
   conflict.
7. **Simplifications**: Remove `PlaceholderChips` stub, remove "load more"
   guard, collapse 5 phases to 3, replace type-to-confirm with checkbox confirm
   for seed.
8. **Mirror div CSS**: Added exact critical CSS rules (Firefox margin, iOS
   Safari, trailing newline fix, ResizeObserver for resize handle sync).
9. **UX upgrades**: Token count badge, "Unsaved changes" indicator, word-level
   diff for Reset preview, sidebar pill-list for groups.
10. **Agent-native**: Read-only MCP exposure (list + get) is safe and useful;
    write access is a security anti-pattern (agent modifying its own prompts).

---

## Overview

Add a new **Prompts** tab to `/dashboard/agents` that lets organization managers
view and edit the LLM prompt templates powering the AI system. All org members
can read; mutations (update, reset, seed) require the **manager** role.

The feature surfaces 31 system-defined prompt templates organized by functional
group (agent, meeting, issue, etc.), lets managers customize `name` and `prompt`
text, reset individual prompts to their system defaults, and seed missing
default prompts for new orgs.

---

## Backend Contract (Verified)

### Routes (`/api/v1/organizations/{organization}/llm-prompts`)

| Method  | Path                      | Auth             | Description                                                 |
| ------- | ------------------------- | ---------------- | ----------------------------------------------------------- |
| `GET`   | `/llm-prompts`            | any member       | List prompts; supports `search`, `group`, `offset`, `limit` |
| `GET`   | `/llm-prompts/{id}`       | any member       | Single prompt                                               |
| `PATCH` | `/llm-prompts/{id}`       | **manager only** | Update `name` and/or `prompt`                               |
| `POST`  | `/llm-prompts/{id}/reset` | **manager only** | Reset prompt to system default                              |
| `POST`  | `/llm-prompts/seed`       | **manager only** | Bootstrap org with default prompts                          |

### TypeScript Interface (from `LlmPromptResource`)

```ts
// features/llm-prompts/model/types.ts
export interface LlmPromptProps {
  id: number;
  organization_id: number | null;
  slug: string; // e.g. "meeting.summary.user"
  name: string;
  prompt: string; // longText — can be very large
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface LlmPromptUpdatePayload {
  name?: string; // optional; min:1, max:255
  prompt?: string; // optional; min:1
}

export interface LlmPromptSeedPayload {
  overwrite?: boolean; // default false. true = overwrite existing prompts
}

export interface LlmPromptSeedStats {
  created: number;
  updated: number;
  skipped: number;
}
```

> **Research insight (TypeScript reviewer):** Derive `LlmPromptUpdatePayload`
> from the schema to eliminate the dual-definition mismatch:
>
> ```ts
> export type LlmPromptUpdatePayload = z.infer<typeof llmPromptUpdateSchema>;
> ```
>
> Delete the hand-written interface.

### Query Params — List

| Param    | Type              | Description                                         |
| -------- | ----------------- | --------------------------------------------------- |
| `search` | `string?`         | Searches `name` and `slug` (LIKE, case-insensitive) |
| `group`  | `LlmPromptGroup?` | Slug prefix filter: `WHERE slug LIKE '{group}.%'`   |
| `offset` | `number?`         | Default 0                                           |
| `limit`  | `number?`         | Default 10; max 50                                  |

> **Research insight (TypeScript reviewer):** Type the `group` param as
> `LlmPromptGroup | undefined`, not `string`, so callers get compile-time
> validation.

### Seed Payload (POST /seed)

Seed returns: `LlmPromptSeedStats` (not `LlmPromptResource`).

### Known Groups (14 prefixes, from slug convention)

```ts
// features/llm-prompts/model/types.ts
export const LLM_PROMPT_GROUPS = [
  'agent',
  'agenda',
  'chat',
  'critical_path',
  'decisions',
  'demo',
  'digest',
  'followup',
  'issue',
  'meeting',
  'methodology',
  'onboarding',
  'telegram',
  'today',
] as const;
export type LlmPromptGroup = (typeof LLM_PROMPT_GROUPS)[number];
```

> **Note:** Slug dot-notation: `meeting.summary.user` — the group is the first
> dot-segment, not the first underscore-segment. Split on `.` and take index 0.
>
> **Simplification (code-simplicity-reviewer):** Merge `LLM_PROMPT_GROUPS`
> directly into `model/types.ts`. No separate `llm-prompt-groups.ts` file — it's
> 4 lines that belong alongside the other prompt types.

---

## FSD Structure

> **Architecture insight:** LLM prompts are a structurally distinct backend
> resource with their own CRUD, their own access model, and their own
> grouping/filtering logic. Adding them to `features/agents/` would create a
> "mega-slice" antipattern. Use a **new `features/llm-prompts/` slice**. The
> route URL (`/dashboard/agents/prompts`) is a routing concern, not a FSD
> justification for co-location.

```
features/llm-prompts/
  api/
    llm-prompts.ts               # Server Actions for prompts CRUD
  lib/
    placeholders.ts              # token regex, extract, diff utilities
    access.ts                    # isOrgManager() helper
  model/
    types.ts                     # LlmPromptProps, payload types, LLM_PROMPT_GROUPS
    schemas.ts                   # llmPromptUpdateSchema
  ui/
    llm-prompts-list.tsx         # list page content (DataTable + search + filters)
    llm-prompt-form.tsx          # edit form (name + prompt + placeholder highlight)
    llm-prompt-group-filter.tsx  # group sidebar pill-list filter
  index.ts                       # public API

app/dashboard/agents/prompts/
  page.tsx                       # Server Component list page
  loading.tsx                    # skeleton loader
  [id]/
    page.tsx                     # Server Component edit page
    loading.tsx                  # skeleton for edit page
```

---

## Routing & Navigation

### 1. Routes Constants (`shared/lib/routes.ts`)

```ts
AGENT_PROMPTS: '/dashboard/agents/prompts',
AGENT_PROMPT_EDIT: (id: number) => `/dashboard/agents/prompts/${id}`,
```

### 2. Tab Strip Update (`features/agents/ui/agents-tabs-nav.tsx`)

Add to `TABS`:

```ts
{ href: ROUTES.DASHBOARD.AGENT_PROMPTS, label: 'Prompts' }
```

### 3. Parent redirect stays on `AGENT_TASKS` (no change to `app/dashboard/agents/page.tsx`)

---

## Access Control

### `isOrgManager()` in new `features/llm-prompts/lib/access.ts`

> **Architecture insight:** `isOrgManager` encodes a different policy than
> `canManageAgents` (which intentionally includes employees). They must not live
> in the same file. The new helper belongs in
> `features/llm-prompts/lib/access.ts`.

```ts
// features/llm-prompts/lib/access.ts
import type { AgentAccessContext } from '@/features/agents';

export function isOrgManager(context: AgentAccessContext): boolean {
  return context.activeOrganization?.pivot?.role === 'manager';
}
```

### Guard in Server Actions (required — Security insight)

> **Security insight:** Non-managers can invoke Server Actions directly (browser
> DevTools). The backend will 403, but add an early return in each mutation to
> avoid the round-trip:

```ts
// At the top of each mutation Server Action:
const ctx = await getAgentAccessContext();
if (!isOrgManager(ctx)) {
  return { data: null, error: 'Forbidden' };
}
```

### Usage pattern in pages

```tsx
const ctx = await getAgentAccessContext();
const canEdit = isOrgManager(ctx);
// Read-only view for all members; edit controls gated on canEdit
```

> The Prompts tab is **visible to all org members** in read-only mode. Only
> managers see edit/reset/seed controls.

---

## Server Actions (`features/llm-prompts/api/llm-prompts.ts`)

> **Framework docs insight:** `react.cache()` only deduplicates within a Server
> Component render tree — it does NOT work on Server Actions (which are invoked
> as POST from the client). Split the data helper from the Server Action:

```ts
'use server';

// Data helper for Server Components (page.tsx) — deduplicates per request
import { cache } from 'react';
export const getLlmPromptData = cache(
  async (
    organizationId: number,
    promptId: number,
  ): Promise<LlmPromptProps | null> => {
    try {
      const { data } = await httpClient<LlmPromptProps>(
        `${API_URL}/organizations/${organizationId}/llm-prompts/${promptId}`,
      );
      return data;
    } catch (error) {
      if (error instanceof ServerError && error.status === 404) return null;
      throw error;
    }
  },
);

// Server Actions (called from Client Components)
export async function getLlmPrompts(
  organizationId: number,
  params: {
    search?: string;
    group?: LlmPromptGroup;
    offset?: number;
    limit?: number;
  },
): Promise<PaginatedResult<LlmPromptProps>>;

export async function updateLlmPrompt(
  organizationId: number,
  promptId: number,
  payload: LlmPromptUpdatePayload,
): Promise<ActionResult<LlmPromptProps>>;

export async function resetLlmPrompt(
  organizationId: number,
  promptId: number,
): Promise<ActionResult<LlmPromptProps>>;

export async function seedLlmPrompts(
  organizationId: number,
  overwrite: boolean,
): Promise<ActionResult<LlmPromptSeedStats>>;
```

### Revalidation

- `updateLlmPrompt` →
  `revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPT_EDIT(promptId), 'page')` +
  `revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPTS, 'page')`
- `resetLlmPrompt` → same two paths
- `seedLlmPrompts` → `revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPTS, 'page')`
  only (list-level)

> **Framework docs insight:** `revalidatePath('/dashboard/agents/prompts/42')`
> (resolved string) is valid in Next.js 16 — it invalidates that exact path. The
> `'page'` type argument scopes invalidation to avoid cascading layout cache
> busting. Do NOT use `'layout'` scope on individual PATCH operations — it's
> only appropriate for seed which affects the whole list.

---

## Zod Schema (`features/llm-prompts/model/schemas.ts`)

```ts
export const llmPromptUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Max 255 characters'),
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(100_000, 'Prompt too long'),
});

// Derive the payload type — never hand-write a duplicate interface
export type LlmPromptUpdatePayload = z.infer<typeof llmPromptUpdateSchema>;
```

> **Security insight:** Add `max(100_000)` to the prompt field. MySQL `longText`
> allows up to 4 GB but an oversized payload can cause OOM in the Server Action
> worker and inflated RSC payloads for all readers.

---

## Placeholder Highlighting

Prompt text can contain `{placeholder_name}` tokens that are injected at runtime
by the AI system.

### Token utilities (`features/llm-prompts/lib/placeholders.ts`)

> **Critical fix (TypeScript reviewer + performance-oracle):** A module-level
> constant with the `/g` flag is stateful — `lastIndex` persists between calls.
> If the regex is ever passed to `RegExp.exec` in a loop or used in `matchAll`,
> it will produce missed matches. Remove the flag from the constant; construct
> fresh regexes at call sites.

```ts
// features/llm-prompts/lib/placeholders.ts

// No /g flag on the constant — avoids stateful lastIndex bugs
export const PLACEHOLDER_PATTERN = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/;

export function extractPlaceholders(text: string): string[] {
  return [...new Set(text.matchAll(new RegExp(PLACEHOLDER_PATTERN, 'g')))].map(
    (m) => m[0],
  );
}

export function diffPlaceholders(
  original: string[],
  current: string[],
): string[] {
  const currentSet = new Set(current);
  return original.filter((p) => !currentSet.has(p));
}
```

### Rendering technique — textarea backdrop overlay

> **Best practices research confirmed:** Mirror div is the correct approach for
> this use case. Zero dependencies, full accessibility compliance, handles
> 10,000+ chars with debouncing. CodeMirror 6 is only justified if requirements
> expand to multi-cursor editing. Never use `innerHTML` — use React JSX children
> to avoid XSS.

#### Critical CSS (must all match exactly between textarea and mirror)

```css
/* Both textarea and .mirror must share ALL of these: */
textarea,
.mirror {
  font-family: inherit;
  font-size: 14px; /* resolved px value, not em/rem */
  line-height: 1.5;
  letter-spacing: normal;
  width: 100%;
  padding: 12px;
  border: 1px solid transparent;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
  -webkit-appearance: none; /* iOS Safari */
  border-radius: 0; /* iOS Safari adds border-radius by default */
  margin: 0; /* Firefox adds 1px top/bottom margin */
}

.mirror {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: transparent;
  background: transparent;
  overflow: hidden; /* mirror does NOT scroll; textarea does */
}

textarea {
  position: relative;
  z-index: 1;
  background: transparent;
  resize: vertical;
}

mark.token {
  background: rgba(139, 92, 246, 0.3); /* bg-violet-500/20 */
  color: transparent;
  border-radius: 3px;
}
```

#### Known pitfalls

- **Trailing newline**: append `​` (zero-width space) to mirror content when
  text ends with `\n` — prevents 1-line height misalignment.
- **Resize handle**: use a `ResizeObserver` to sync mirror height when user
  resizes the textarea.
- **Font metrics drift**: use `getComputedStyle` at mount time and explicitly
  apply all resolved font values to the mirror div. Re-apply in the
  `ResizeObserver` callback.

#### Implementation sketch

```tsx
// features/llm-prompts/ui/llm-prompt-form.tsx (excerpt)
'use client';

// Mirror div uses React JSX children — NEVER innerHTML (XSS risk)
function HighlightedTextarea({ value, onChange, disabled }: Props) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounce highlight computation — do NOT update mirror on every keystroke
  const debouncedValue = useDebounce(value, 100);

  const segments = useMemo(() => {
    if (!debouncedValue) return [{ text: '', isToken: false }];
    return buildSegments(debouncedValue, PLACEHOLDER_PATTERN);
  }, [debouncedValue]);

  // Scroll sync — use passive listener + requestAnimationFrame
  useEffect(() => {
    const ta = textareaRef.current;
    const m = mirrorRef.current;
    if (!ta || !m) return;
    let rafId: number;
    const syncScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        m.scrollTop = ta.scrollTop;
      });
    };
    ta.addEventListener('scroll', syncScroll, { passive: true });
    return () => {
      ta.removeEventListener('scroll', syncScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className='relative'>
      <div
        ref={mirrorRef}
        aria-hidden='true'
        className='absolute inset-0 pointer-events-none overflow-hidden
                      whitespace-pre-wrap break-words text-transparent select-none
                      font-mono text-sm leading-relaxed p-3'
      >
        {segments.map((seg, i) =>
          seg.isToken ? (
            <mark
              key={i}
              className='bg-violet-500/20 text-transparent rounded-sm px-0.5'
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* Trailing newline fix */}
        {'​'}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className='relative z-10 bg-transparent w-full font-mono text-sm
                           leading-relaxed p-3 resize-y min-h-[200px]'
      />
    </div>
  );
}
```

### Placeholder disappear warning

- Checked **on Save click**, before submitting
- If `diffPlaceholders(originalPlaceholders, currentPlaceholders).length > 0`:
  - Show inline warning below textarea:
    `"You removed {n} placeholder(s): {list}. This may break AI responses. Save anyway?"`
  - Two buttons: **Save anyway** (proceeds), **Keep editing** (cancels submit)
- Do NOT block save — warn and let manager decide

### Future: known placeholder chips

The `PlaceholderChips` component should only be created when the backend ships
`LlmPromptMeta` metadata. Do not create a stub now.

> **Simplification (code-simplicity-reviewer):** Remove the PlaceholderChips
> stub entirely — YAGNI. Keep the commented-out JSX inline in the form for
> future reference.

---

## Screens

### Screen 1: `/dashboard/agents/prompts` — Prompts List

> **UX insight (best-practices-researcher):** Use a left sidebar pill-list for
> group navigation rather than a dropdown — more scalable for 14+ categories,
> shows count badges, supports URL persistence.

```
┌──────┬──────────────────────────────────────────────────────┐
│ All  │  LLM Prompts                    [Sync Defaults]▼     │ ← manager only
│(31)  │                                                      │
│──────│  [🔍 Search by name or slug...]                      │
│agent │                                                      │
│(1)   │  ┌────────────────────────────────────────────────┐  │
│agenda│  │ Name              Slug              Updated     │  │
│(4)   │  │────────────────────────────────────────────────│  │
│chat  │  │ Meeting Summary   meeting.summary.u  3 days ago │  │
│(1)   │  │ Chat Wanda        chat.wanda.system  —          │  │
│...   │  │ ...                                            │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

- **Read-only members**: see table, search, sidebar filter; no edit icon, no
  Sync button
- **Managers**: see edit icon per row + "Sync Defaults" dropdown header button
- **Empty state** (no prompts seeded):
  - For managers: `EmptyState` with sync icon + "Seed default prompts" single
    CTA button + explanation text
  - For employees: neutral icon + "No prompts configured. Ask your organization
    manager."
- **Search**: client-side filter (31 items fit in one fetch with `limit=50`);
  debounced at 150ms
- **Group filter**: sidebar pill-list from `LLM_PROMPT_GROUPS` with count
  badges; "All (31)" at top; URL param `?group=meeting` for deep-link support
- **Pagination**: fetch with `limit=50` → all 31 in one request. No "load more"
  guard needed at current scale.

> **Simplification (code-simplicity-reviewer):** Remove the "load more" guard
> for `totalCount > data.length`. 31 items, limit 50 — this guard will never
> fire. Add it if/when the count approaches 50.

### Screen 2: `/dashboard/agents/prompts/[id]` — Prompt Edit Page

> **UX insight:** Add a token count badge and "Unsaved changes" indicator —
> table-stakes for prompt admin UIs.

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Prompts                                      │
│                                                         │
│  Meeting Summary                    ● Unsaved changes   │ ← amber indicator when dirty
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Slug                                                   │
│  [meeting.summary.user]  📋                             │ ← read-only + copy button
│                                                         │
│  Name                                                   │
│  [Meeting Summary                    ]                  │
│                                                         │
│  Prompt                               ~340 tokens       │ ← token count badge
│  ┌─────────────────────────────────────────────────┐   │
│  │ You are an AI assistant. Summarize the          │   │
│  │ following meeting for {user_name} on the        │   │  ← {user_name} highlighted violet
│  │ team {team_name}.                               │   │
│  │ Meeting context: {meeting_context}              │   │
│  └─────────────────────────────────────────────────┘   │
│  ⚠ You removed 1 placeholder: {team_name}. Save anyway?│ ← warning (conditional)
│     [Save anyway]  [Keep editing]                       │
│                                                         │
│  [Save]  [Reset to Default]  [Cancel]                   │ ← manager only
└─────────────────────────────────────────────────────────┘
```

- **Read-only members**: show slug, name, prompt text (read-only display); no
  form controls
- **Manager**: full edit form with Save / Reset to Default / Cancel
- **"Unsaved changes" indicator**: amber dot + text when `isDirty === true`
- **Token count**: `Math.ceil(prompt.length / 4)` as a rough estimate, shown in
  muted text top-right of textarea
- **Save**: PATCH → toast.success / toast.error; stay on page with updated
  server values
- **Reset to Default**: two-step inline confirm; then show a **word-level diff**
  of what will change before committing:
  ```
  "This will reset to the system default. Changes:"
  [Show diff: word-level additions in green, deletions in red]
  [Confirm Reset]  [Cancel]
  ```
- **Cancel**: navigate back to `ROUTES.DASHBOARD.AGENT_PROMPTS`
- **Form disabled during `useTransition` / pending state**

> **UX insight (best-practices-researcher):** Use `diff-match-patch` (12 KB, no
> deps) for word-level diff in the Reset preview. Side-by-side is too wide for
> prose; inline unified diff is the correct choice.

### Screen 3: Seed confirmation (inline in list page)

"Sync Defaults" button opens a confirmation:

- **Sync missing** (safe): Inline popover:
  `"Add default prompts for any missing slugs. Existing customizations are preserved."`
  → Confirm
- **Overwrite all** (destructive):

> **Simplification (code-simplicity-reviewer):** Replace the type-to-confirm
> input with a checkbox confirm — appropriate for this admin-only, low-frequency
> action:
>
> ```
> "Replace ALL prompt text with system defaults."
> "This will overwrite 14 customized prompts."
> [☐] I understand all customizations will be lost
> [Overwrite All]  (disabled until checkbox checked)
> ```

---

## Error Handling

| Scenario                       | Handling                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| 403 on PATCH/reset/seed        | `toast.error("You don't have permission to edit prompts.")`           |
| 404 on GET `[id]`              | `notFound()` → Next.js 404 page                                       |
| 422 on PATCH                   | Map `fieldErrors.name` / `fieldErrors.prompt` to form via `setError`  |
| Network error                  | `toast.error("Network error. Please try again.")`                     |
| 404 on reset (deprecated slug) | `toast.error("This prompt no longer exists in the system defaults.")` |

---

## Race Conditions & Mitigations

> **Critical (julik-frontend-races-reviewer):** Several race conditions exist in
> the plan. Must address before implementation.

### 1. PATCH in-flight + revalidatePath stomping form values — HIGH

Sequence: user saves prompt A → PATCH in-flight → `revalidatePath` fires →
Server Component re-renders → form reset to server snapshot → stale values
shown.

**Mitigation:** Lock the edit page to one prompt at a time (single edit route).
After `revalidatePath`, the Server Component re-renders with the server-returned
values from the PATCH response itself — pass the server-returned `data` back to
the form's `reset()` call immediately on success, **before** the revalidation
cycle:

```ts
const result = await updateLlmPrompt(orgId, id, payload);
if (!result.error && result.data) {
  form.reset(result.data); // Reset form to server-confirmed values immediately
  toast.success('Prompt saved');
}
```

### 2. Scroll sync jank — MEDIUM

`onScroll` fires after paint. Use `{ passive: true }` + `requestAnimationFrame`
(already shown in implementation sketch above).

### 3. Font metrics drift in mirror div — HIGH

Subpixel rendering and kerning cause highlight layer misalignment over long
text.

**Mitigation:** On mount, apply `getComputedStyle` values explicitly to the
mirror:

```ts
useEffect(() => {
  const ta = textareaRef.current;
  const m = mirrorRef.current;
  if (!ta || !m) return;
  const s = getComputedStyle(ta);
  m.style.fontFamily = s.fontFamily;
  m.style.fontSize = s.fontSize;
  m.style.lineHeight = s.lineHeight;
  m.style.letterSpacing = s.letterSpacing;
  m.style.padding = s.padding;
}, []);
```

Also attach a `ResizeObserver` to re-apply when textarea is resized.

### 4. Double-submit — LOW (safe with `useTransition`)

`startTransition` sets `isPending` synchronously — button `disabled={isPending}`
prevents double-submit. No additional mitigation needed.

### 5. Reset confirmation + Cancel while submitting — MEDIUM

Replace two booleans (`showConfirm`, `isResetting`) with a state machine:

```ts
type ResetState = 'idle' | 'confirming' | 'submitting';
const [resetState, setResetState] = useState<ResetState>('idle');
```

Cancel from `submitting` state discards the result when the action resolves.

---

## Accessibility

- Mirror div: `aria-hidden="true"` — screen readers interact only with the
  `<textarea>`
- Search input: `aria-label="Search prompts by name or slug"`
- Group sidebar: `role="listbox"` with `aria-selected` per item
- "Unsaved changes" indicator: `role="status"` for live region

---

## Security Notes

> **From security-sentinel review:**

1. **Backdrop overlay**: Use React JSX children only — **never `innerHTML`**.
   React escapes all children automatically. Add a linting rule banning
   `innerHTML` assignment in this component file.

2. **Prompt injection audit trail**: A manager can save arbitrary AI
   instructions affecting all users. Recommend surfacing `updated_at` + who last
   edited in the read-only view for transparency.

3. **Server Action `isOrgManager` guard**: Add at the top of each mutation
   before the HTTP call (see Server Actions section above).

4. **Prompt size limit**: `max(100_000)` in the Zod schema prevents oversized
   payloads.

5. **Seed confirmation**: Use `autoComplete="off"` on any confirmation inputs;
   compare with strict equality (`=== 'overwrite'`).

---

## Agent-Native Parity

> **From agent-native-reviewer:** Read-only MCP tools are safe and useful; write
> access is a security anti-pattern (agent rewriting its own system prompts).

**Recommended additions to `wanda-backend` MCP server:**

- `list_llm_prompts` — allows Wanda to answer "What does the meeting summary
  prompt say?"
- `get_llm_prompt(slug)` — fetch a specific prompt by slug

**Do NOT expose:**

- `update_llm_prompt`, `reset_llm_prompt`, `seed_prompts` — these create a
  self-modification attack surface

---

## Acceptance Criteria

### Core Functionality

- [ ] New "Prompts" tab appears in the agents section tab strip
- [ ] Route `/dashboard/agents/prompts` renders a list of LLM prompts
- [ ] Route `/dashboard/agents/prompts/[id]` renders the edit page
- [ ] All org members can view the list and individual prompts
- [ ] Only managers see edit controls, the seed button, and can use mutations
- [ ] `loading.tsx` exists for both new routes

### List Page

- [ ] Fetches prompts with `limit=50` in a single request
- [ ] Displays `name`, `slug`, `updated_at` columns in `DataTable`
- [ ] Search input filters client-side by `name` and `slug` (debounced 150ms)
- [ ] Group filter is a sidebar pill-list with count badges, "All" at top
- [ ] Active group persisted in `?group=` URL param
- [ ] Empty state shown when list is empty (different for manager vs employee)
- [ ] Manager sees per-row edit affordance (row click or edit icon)
- [ ] Manager sees "Sync Defaults" button with dropdown (sync missing /
      overwrite all)
- [ ] Overwrite confirmation requires checking "I understand" checkbox before
      button activates

### Edit Page

- [ ] `slug` field is read-only with copy-to-clipboard button
- [ ] `name` field is editable, max 255 chars, shows validation error
- [ ] `prompt` textarea shows `{placeholder}` tokens highlighted in violet
- [ ] Mirror div uses React JSX children (no `innerHTML`)
- [ ] Highlight debounced at 100ms; scroll sync uses `requestAnimationFrame`
- [ ] Font metrics applied via `getComputedStyle` on mount
- [ ] Token count badge shown (approximate: `length / 4`)
- [ ] "Unsaved changes" amber indicator when form is dirty
- [ ] Removing a placeholder triggers a warning before save (checked on Save
      click)
- [ ] Warning shows which specific placeholders were removed
- [ ] Save calls PATCH, resets form to server-returned values immediately
- [ ] Reset to Default shows two-step confirm with word-level diff preview
- [ ] After reset, form repopulates with server-returned default values
- [ ] Cancel navigates back to list
- [ ] Form is disabled during `useTransition` pending state
- [ ] 422 field errors from server displayed inline on the corresponding field
- [ ] Reset state machine: `idle → confirming → submitting` (no boolean pair)

### Access Control

- [ ] `isOrgManager()` in `features/llm-prompts/lib/access.ts` (NOT in
      `features/agents/`)
- [ ] `isOrgManager()` guard at top of each mutation Server Action
- [ ] Edit controls, reset button, and seed button hidden for non-managers
- [ ] Non-managers navigating directly to `[id]` see a read-only view

### Architecture

- [ ] Feature lives in `features/llm-prompts/` (new FSD slice, not in
      `features/agents/`)
- [ ] `PLACEHOLDER_PATTERN` has no `/g` flag; fresh regexes created at call
      sites
- [ ] `LlmPromptUpdatePayload` is derived from schema (`z.infer<...>`), not
      hand-written
- [ ] `LLM_PROMPT_GROUPS` in `model/types.ts` (not a separate file)
- [ ] `getLlmPromptData` is a `cache()`-wrapped data helper (not a Server
      Action)
- [ ] `AGENT_PROMPTS` and `AGENT_PROMPT_EDIT` constants added to
      `shared/lib/routes.ts`
- [ ] No `any` types anywhere in the feature
- [ ] `features/llm-prompts/index.ts` exports all public types

---

## Implementation Phases

> **Simplification (code-simplicity-reviewer):** Flatten from 5 phases to 3.
> Phases 1 and 5 are bookend housekeeping; fold them into the surrounding
> phases.

### Phase 1 — Foundation + List Page

1. Create `features/llm-prompts/` directory and `index.ts`
2. Add `AGENT_PROMPTS` and `AGENT_PROMPT_EDIT` to `shared/lib/routes.ts`
3. Add all types to `features/llm-prompts/model/types.ts` (including
   `LLM_PROMPT_GROUPS`)
4. Add `llmPromptUpdateSchema` to `features/llm-prompts/model/schemas.ts`
5. Create `features/llm-prompts/lib/placeholders.ts` (regex, extract, diff)
6. Create `features/llm-prompts/lib/access.ts` with `isOrgManager()`
7. Create `features/llm-prompts/api/llm-prompts.ts` with all 5 Server Actions +
   `getLlmPromptData` helper
8. Create `app/dashboard/agents/prompts/page.tsx` + `loading.tsx`
9. Create `features/llm-prompts/ui/llm-prompts-list.tsx` (DataTable + search +
   group sidebar)
10. Add Prompts tab to `features/agents/ui/agents-tabs-nav.tsx`

### Phase 2 — Edit Page + Placeholder Highlighting

1. Create `app/dashboard/agents/prompts/[id]/page.tsx` + `loading.tsx`
2. Create `features/llm-prompts/ui/llm-prompt-form.tsx`:
   - react-hook-form + zodResolver
   - Read-only slug with copy button
   - Name input with char count
   - Prompt textarea with backdrop overlay (mirror div technique)
   - Token count badge
   - "Unsaved changes" indicator
   - Placeholder disappear warning logic (on Save click)
   - Save / Reset to Default / Cancel buttons
   - Reset state machine (`idle → confirming → submitting`)
   - Word-level diff in Reset confirmation

### Phase 3 — Seed Actions + Polish

1. Add seed button + confirmation UI to the list page header (managers only)
   - Checkbox confirm for overwrite
2. Update `features/llm-prompts/index.ts` exports
3. Run `fsd-boundary-guard` agent
4. Run `mr-reviewer` agent pre-push
5. Run `design-guardian` on new pages

---

## Key Design Decisions

| Decision                            | Choice                              | Rationale                                                                                                                                     |
| ----------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FSD slice                           | **New `features/llm-prompts/`**     | Distinct backend resource, distinct access model, distinct grouping logic. Co-location in `features/agents/` would be mega-slice antipattern. |
| Edit UI: modal vs full-page         | **Full-page route** `/prompts/[id]` | Prompt textarea can be very large. Modal has limited vertical space. Full-page matches existing agent profile pattern.                        |
| Search/filter: SSR vs CSR           | **Client-side**                     | 31 prompts fit in one request. Debounce at 150ms. Group filter persisted in URL `?group=` param.                                              |
| Placeholder warning: when           | **On Save click**                   | On-keystroke warnings are disruptive. On-blur is confusing. On-Save is consistent with other validation patterns.                             |
| Group list source                   | **Hardcoded constant in types.ts**  | No backend enum. 14 stable groups. No separate file needed.                                                                                   |
| Pagination                          | **Single request** (`limit=50`)     | All 31 prompts fit. No load-more guard needed at current scale.                                                                               |
| Placeholder regex                   | **No `/g` on constant**             | Stateful `lastIndex` causes missed matches in loops. Fresh regex at each call site.                                                           |
| Seed confirmation                   | **Checkbox confirm**                | Admin-only, low-frequency action. Type-to-confirm is consumer UX pattern, overkill here.                                                      |
| Post-save navigation                | **Stay on edit page**               | Reset form to server-returned values immediately via `form.reset(result.data)`.                                                               |
| `cache()` usage                     | **Data helper only**                | `react.cache()` only deduplicates in Server Component render trees. Server Actions are POST calls — `cache()` has no effect there.            |
| `useTransition` vs `useActionState` | **`useTransition`**                 | Project uses react-hook-form with `onSubmit`. `useActionState` conflicts with RHF's controlled submission flow.                               |

---

## Future Backend Metadata

The spec anticipates a `LlmPromptMeta` type with placeholder metadata:

```ts
type LlmPromptMeta = {
  slug: string;
  name: string;
  placeholders: string[]; // e.g. ["user_name", "team_name"]
  group: string;
};
```

When available, add a `PlaceholderChips` component that renders clickable
insertion chips. This is additive — no existing code changes required.

---

## References

### Frontend

- Tab navigation pattern: `features/agents/ui/agents-tabs-nav.tsx`
- Form pattern (react-hook-form + Zod + useTransition):
  `features/agents/ui/agent-profile-form.tsx`
- DataTable component: `shared/ui/table/DataTable.tsx`
- Textarea component: `shared/ui/input/textarea.tsx`
- Server Actions pattern: `features/agents/api/agent-profiles.ts`
- Access guard (existing pattern): `features/agents/lib/access.ts`
- httpClient utilities: `shared/lib/httpClient.ts`
- ActionResult type: `shared/types/server-action.ts`
- EmptyState component: `shared/ui/feedback/empty-state.tsx`

### Backend

- Controller: `App\Http\Controllers\API\v1\OrganizationLlmPromptController`
- Resource: `App\Http\Resources\API\v1\LlmPromptResource`
- Request: `App\Http\Requests\API\v1\LlmPromptRequest`
- Routes: `routes/api.php` — prefix `/organizations/{organization}/llm-prompts`

### External Research

- Mirror div technique:
  [Highlight Text Inside a Textarea — Coder's Block](https://codersblock.com/blog/highlight-text-inside-a-textarea/)
- Destructive action UX:
  [Destructive actions — Pajamas Design System](https://design.gitlab.com/patterns/destructive-actions/)
- Prompt editor UX:
  [Prompt Augmentation UX Design Patterns](https://www.uxtigers.com/post/prompt-augmentation)
- Word-level diff: `diff-match-patch` (Google, 12 KB, no deps)
- Empty state design:
  [Empty State UX Examples — Eleken](https://www.eleken.co/blog-posts/empty-state-ux)
