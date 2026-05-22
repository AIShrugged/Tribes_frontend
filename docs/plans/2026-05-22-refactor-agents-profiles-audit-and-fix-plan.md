---
title: "refactor: Agent Profiles — backend contract sync, design fix, and bug triage"
type: refactor
status: active
date: 2026-05-22
deepened: 2026-05-22
---

# refactor: Agent Profiles — backend contract sync, design fix, and bug triage

## Enhancement Summary

**Deepened on:** 2026-05-22  
**Research agents used:** architecture-strategist, kieran-typescript-reviewer, best-practices-researcher, security-sentinel, code-simplicity-reviewer, performance-oracle, julik-frontend-races-reviewer, design-guardian, pattern-recognition-specialist, adversarial API contract & feasibility reviewer

### Key Improvements Over Original Plan

1. **Phase 4 restructuring is more complex than stated** — adding `layout.tsx` to `[id]/` requires the existing `page.tsx` to move to `[id]/overview/page.tsx` and the original `[id]/page.tsx` become a redirect; adding ROUTES constants for sub-routes is mandatory
2. **`actionAgentApi` removal has a behavioral gap** — `httpClient` does NOT soft-return 403/422 as `ActionResult`; it throws. All 5 callers need a try/catch wrapper or a new `httpClientAction` helper in `shared/lib/`
3. **`config` field should be removed from `AgentProfile`** — it is NOT returned by `AgentProfileResource`; it was never valid
4. **`getAgentProfile` must be wrapped in `react.cache()`** before Phase 4 to prevent double-fetching when layout.tsx is introduced
5. **`getAgentTasksMeta` and `getAgentTools` calls must be removed from `profiles/page.tsx`** entirely in Phase 5, not just the UI boxes
6. **Security: `isOrganizationManager` grants employees full write access** — this must be explicitly documented or aligned with backend semantics
7. **Security: `allowed_outbound_hosts` needs per-entry hostname validation** (SSRF enablement risk)
8. **Race condition: `AgentTaskActions` delete can fire twice** due to render-frame gap between click and button becoming disabled — confirmed critical
9. **Form should use two separate `useTransition` hooks** (save vs validate) not one shared one
10. **Zod schema should use `z.enum(AGENT_EXECUTION_MODES)` not `z.string()`** to match backend constraint
11. **`api/agents.ts` should be split** into `api/agent-profiles.ts` + `api/agent-tasks.ts` per CLAUDE.md Rule 4
12. **Memories: add `<Suspense>` + explicit `limit=50`** to avoid blocking the tab shell render and unbounded list loading

---

## Overview

A full audit of `features/agents/` (scoped to the Profiles flow) comparing
the TypeScript types and form payloads against the live backend contracts
(`AgentProfileResource`, `AgentProfileRequest`), fixing design-system
violations, and patching discovered bugs/edge-cases.

The investigation found **critical contract mismatches** (missing fields, wrong
field names, a ghost `config` field that never existed in the backend), a
**CLAUDE.md violation** (raw `fetch` instead of `httpClient` in `actionAgentApi`
with a behavioral gap in the replacement), **missing features** (profile
memories tab, `key`/`enabled`/`execution_mode`/`allowed_outbound_hosts` fields),
and several **edge-case bugs** including a double-delete race condition.

---

## Problem Statement

### 1 — TypeScript ↔ Backend Contract Mismatches (AgentProfileResource)

Backend `AgentProfileResource::toArray()` returns:

| Backend field            | Current TS type field | Status    |
|--------------------------|-----------------------|-----------|
| `key`                    | ❌ missing             | **BUG**   |
| `execution_mode`         | ❌ missing             | **BUG**   |
| `allowed_outbound_hosts` | ❌ missing             | **BUG**   |
| `default_model`          | ❌ wrong name (`model` used instead) | **WRONG NAME** |
| `enabled`                | ❌ missing             | **BUG**   |
| `config`                 | ✅ present in TS, ❌ NOT in Resource | **GHOST FIELD** |
| `config_schema`          | ✅ present (but `?` optional, should be `\| null`) | should fix |
| `task_payload_schema`    | ✅ present (same optionality issue) | should fix |
| `metadata`               | ✅ present (same optionality issue) | should fix |
| `sandbox_profile`        | ✅ present             | ok        |
| `allowed_tools`          | ✅ present             | ok        |

The frontend currently uses `profile.model` (optional) but the backend returns
`default_model`. This means the Model column is always `undefined` at runtime.

The `config` field in the current TS interface does NOT appear in
`AgentProfileResource::toArray()` — it was never a real backend field and
should be removed entirely from the TypeScript type.

### 2 — AgentProfilePayload Mismatches (Store/Update request)

Backend `AgentProfileRequest::storeRules()` requires these fields the frontend
never sends:

| Backend field            | Frontend sends | Impact                           |
|--------------------------|----------------|----------------------------------|
| `key`                    | ❌ never sent  | 422 error on every create attempt |
| `execution_mode`         | ❌ never sent  | Silently defaults to `inline`    |
| `allowed_outbound_hosts` | ❌ never sent  | Cannot configure sandbox network |
| `enabled`                | ❌ never sent  | Profile always enabled; cannot disable on create |
| `default_model` (not `model`) | ❌ wrong name | Field never applied            |
| `config_schema`          | ❌ never sent  | Cannot define task payload UI    |
| `task_payload_schema`    | ❌ never sent  | Cannot define validation schema  |

### 3 — CLAUDE.md Rule Violation — Raw `fetch` + Behavioral Gap in Replacement

`features/agents/api/agents.ts` defines `actionAgentApi()` (lines 25–72) which
calls `fetch(...)` directly — a CLAUDE.md Rule 2 violation.

**Critical: `httpClient` does NOT behave the same on 403/422.** `actionAgentApi`
returns `ActionResult` (soft error) for 403/422; `httpClient` **throws
`ServerError`** for all non-2xx statuses. A naive replacement would break
inline form field errors — the form's `result.error !== null` branch would
never execute; instead errors reach the error boundary.

The fix requires either:
- A new `httpClientAction<T>` helper in `shared/lib/httpClient.ts` that wraps
  `httpClient` and catches 403/422 ServerErrors into `ActionResult`
- Or per-action try/catch following the pattern already used by
  `deleteAgentProfile` (lines 123–141 of `agents.ts`)

### 4 — Missing Backend Features Not Exposed in UI

The backend exposes:
- `GET /api/v1/agent-profiles/{id}/memories` — agent memory list for a profile
- `GET /api/v1/agent-memories` — all agent memories
- `GET /api/v1/agent-memories/{id}` — single memory

The frontend has no UI for agent memories at all.

### 5 — Design Issues

- Form has no client-side validation at all (no Zod resolver — `onBlur` mode
  with no `zodResolver`, no minimum length enforcement on `name`)
- Detail page Overview panel duplicates form fields as raw `<p>` text
- `AgentProfilesList` table has 8 columns — too wide; `system_prompt` column
  is unreadable
- Debug info boxes on list page are not user-facing content

### 6 — Edge-Case Bugs

- `getAgentProfile()` casts `data as AgentProfile` without null guard
- **Double-delete race in `AgentTaskActions`**: `useState<boolean>` for loading
  creates a render-frame gap; a rapid double-click on "Confirm delete" fires two
  `deleteAgentTask()` calls. Result: success toast + "Failed to delete" error
  toast simultaneously after the second call gets 404
- Single `useTransition` shared between save and validate — both transitions run
  concurrently; save can `router.push()` away while validate `setError()` fires
  on an unmounted component (ghost toast on destination page)
- `router.push()` + `router.refresh()` race after save — `router.refresh()`
  may refresh the wrong route; should be dropped (server action's
  `revalidatePath` is sufficient)
- `normalizeAllowedTools` object key-fallback branch is unreachable (PHP always
  encodes indexed arrays as JSON arrays, not objects)
- `isOrganizationManager` returns `true` for 'employee' — diverges from
  backend's `UserRole::MANAGER` check; not documented

---

## Proposed Solution

### Phase 1 — Type Contract Fix + File Split + Cache Fix

**Files:** `features/agents/model/types.ts`, `features/agents/api/agents.ts`
→ split into `features/agents/api/agent-profiles.ts` + `features/agents/api/agent-tasks.ts`

#### 1a. Fix `AgentProfile` and `AgentProfilePayload`

```ts
// features/agents/model/types.ts

export const AGENT_EXECUTION_MODES = ['inline', 'isolated', 'paperclip'] as const;
export type AgentExecutionMode = typeof AGENT_EXECUTION_MODES[number];

export interface AgentProfile {
  id: number;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;    // non-optional: always in Resource
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;        // PHP enum ?->value
  sandbox_profile: string | null;
  allowed_tools: string[] | null;
  allowed_outbound_hosts: string[] | null;
  default_model: string | null;                     // was wrongly named `model`
  enabled: boolean;
  metadata: Record<string, unknown> | null;         // non-optional: always in Resource
  created_at: string;
  updated_at: string;
  // NOTE: `config` field removed — NOT in AgentProfileResource::toArray()
}

export interface AgentProfilePayload {
  key: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;
  sandbox_profile: string | null;
  allowed_tools: string[];
  allowed_outbound_hosts: string[];
  default_model: string | null;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
}

// New type from AgentMemoryResource::toArray()
export interface AgentMemory {
  id: number;
  agent_profile_id: number;
  profile: { id: number; key: string; name: string } | null;
  scope_type: string | null;
  scope_key: string | null;
  kind: string | null;
  priority: number | null;
  active: boolean;
  content: string | null;
  last_seen_at: string | null;
  source_task_id: number | null;
  source_run_id: number | null;
  metadata: Record<string, unknown>;  // always array{} from Resource
  created_at: string;
  updated_at: string;
}
```

Also align `AgentTask.execution_mode` to `AgentExecutionMode | null` (same enum
governs it — currently typed as `string | null` which is inconsistent).

#### 1b. Split `api/agents.ts` into two files

Per CLAUDE.md Rule 4 (split when 3+ distinct resources). With `api/memories.ts`
being added, this file now covers 3 resource groups.

- `features/agents/api/agent-profiles.ts` — all `/agent-profiles` actions
- `features/agents/api/agent-tasks.ts` — all `/agent-tasks` actions
- Update `features/agents/api/__tests__/agents.test.ts` import paths
- Update `features/agents/index.ts` re-exports

#### 1c. Remove `actionAgentApi` — replace using `httpClientAction` pattern

Add a new helper to `shared/lib/httpClient.ts`:

```ts
// shared/lib/httpClient.ts — new export
// Add to imports: import type { ActionResult } from '@/shared/types/server-action';
export async function httpClientAction<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<ActionResult<T>> {
  try {
    const { data } = await httpClient<T>(url, init);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', fallbackMessage);
      // Soft-return for validation/permission errors (403, 422) AND for
      // business-logic rejections where httpClient throws a statusless ServerError
      // (HTTP 200 with json.success === false). error.status is undefined in that
      // case, so we catch it here rather than re-throwing to the error boundary.
      if (
        error.status === 422 ||
        error.status === 403 ||
        error.status === undefined
      ) {
        return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
      }
    }
    throw error;
  }
}
```

Then all 5 mutations in `agent-profiles.ts` use `httpClientAction` + call
`revalidatePath` when `result.error === null`.

#### 1d. Wrap `getAgentProfile` in `react.cache()`

```ts
// features/agents/api/agent-profiles.ts
export const getAgentProfile = cache(async (id: number) => {
  const { data } = await httpClient<AgentProfile>(
    `${API_URL}/agent-profiles/${id}`,
  );
  if (!data) throw new ServerError('Not found', { status: 404, url: `${API_URL}/agent-profiles/${id}` });
  return data;
});
```

Also wrap `getAgentTasksMeta` and `getAgentTools` in `cache()` — they are
zero-argument functions that return static reference data and are called from
multiple pages per session.

#### 1e. Add ROUTES constants for profile sub-routes

```ts
// shared/lib/routes.ts — add to ROUTES.DASHBOARD
AGENT_PROFILE_OVERVIEW: (id: number) => `/dashboard/agents/profiles/${id}/overview`,
AGENT_PROFILE_MEMORIES: (id: number) => `/dashboard/agents/profiles/${id}/memories`,
```

**Research insights:**
- PHP backed enums with `?->value` → TypeScript `T | null` (nullsafe operator means null when column is null)
- Always-present Resource fields → non-optional TypeScript (`T | null`, not `T?`)
- `z.discriminatedUnion` or two separate schemas for create vs edit — not `.superRefine` (deprecated in Zod v4)
- Zod v4 + react-hook-form: standard `zodResolver` from `@hookform/resolvers/zod` handles flat discriminated unions correctly
- The `AgentProfileFormValues` hand-written type must be DELETED and replaced with `z.infer<typeof schema>`

---

### Phase 2 — Form Fix (agent-profile-form.tsx + model/schemas.ts)

**Files:** `features/agents/ui/agent-profile-form.tsx`, `features/agents/model/schemas.ts`

#### 2a. Add Zod schemas (two separate schemas for create vs edit)

```ts
// features/agents/model/schemas.ts (additions)
import { AGENT_EXECUTION_MODES } from './types';

const agentProfileBase = z.object({
  name: z.string().min(2, 'At least 2 characters').max(255),
  description: z.string(),
  system_prompt: z.string().max(32_000),
  sandbox_profile: z.string(),
  allowed_tools: z.array(z.string()),
  allowed_outbound_hosts: z.string(),   // textarea: newline-separated, validated on submit
  execution_mode: z.enum(AGENT_EXECUTION_MODES).nullable().optional(),
  default_model: z.string().max(120),
  enabled: z.boolean(),
  config_schema: jsonStringSchema,
  task_payload_schema: jsonStringSchema,
  metadata: jsonStringSchema,
  // validation_payload is NOT in the schema — stays in useForm but NOT submitted
});

export const agentProfileCreateSchema = agentProfileBase.extend({
  key: z.string()
    .min(2, 'Key must be at least 2 characters')
    .max(255)
    .regex(/^[a-z0-9_-]+$/, 'Lowercase letters, digits, underscores, hyphens only'),
});

export const agentProfileEditSchema = agentProfileBase;

export type AgentProfileCreateValues = z.infer<typeof agentProfileCreateSchema>;
export type AgentProfileEditValues = z.infer<typeof agentProfileEditSchema>;
```

Delete the hand-written `interface AgentProfileFormValues` — use
`z.infer<typeof schema>` instead.

#### 2b. Add missing form fields

**Field organization (4 labeled sections):**

```
Section 1 — Identity (grid 2 cols)
  [name] [key — create only; read-only display on edit]

Section 2 — Behavior (mixed layout)
  [description — full width]
  [system_prompt — full width]
  [execution_mode dropdown] [default_model text] (grid 2 cols)
  [enabled — checkbox with label]

Section 3 — Access & Tools
  [sandbox_profile dropdown] [allowed_tools multi-dropdown] (grid 2 cols)
  [allowed_outbound_hosts — textarea, one host per line, full width]

Section 4 — Schemas & Metadata (wrapped in border)
  [config_schema JSON textarea]
  [task_payload_schema JSON textarea]
  [metadata JSON textarea]
```

Use `<div className='border-t border-border pt-4'>` between sections — not
nested cards.

**`key` field UX:**
- On create: editable `<Input>` with auto-slugification from `name` (stops when user manually edits)
- On edit: read-only `<code className='font-mono text-xs'>` outside the form fields — NOT a registered input (prevents sending `key` in PATCH)

```tsx
// Auto-slug in create mode
const nameValue = watch('name');
// NOTE: isDirty lives under fieldState, not at the top level of useController's return
const { fieldState: { isDirty: isKeyDirty } } = useController({ name: 'key', control });
useEffect(() => {
  if (!isEdit && !isKeyDirty) {
    setValue('key', nameValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
  }
}, [nameValue, isEdit, isKeyDirty, setValue]);
```

**`allowed_outbound_hosts` validation** (security — SSRF enablement risk):

```ts
// On submit, before sending to backend:
const hostsRaw = values.allowed_outbound_hosts;
const hosts = hostsRaw
  .split('\n')
  .map(h => h.trim())
  .filter(Boolean);
// Validate each entry — reject full URLs, IPs, CIDR
const hostnameRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const invalid = hosts.filter(h => !hostnameRegex.test(h));
if (invalid.length > 0) {
  setError('allowed_outbound_hosts', { message: `Invalid hostnames: ${invalid.join(', ')}` });
  return;
}
```

#### 2c. Fix concurrent transitions

```tsx
// Two separate transitions — not one shared
const [isSavePending, startSave] = useTransition();
const [isValidatePending, startValidate] = useTransition();

// Guard: don't save while validate is in flight
const onSubmit = (values) => {
  if (isValidatePending) return;
  startSave(async () => { ... });
};

// Drop router.refresh() after router.push() — revalidatePath in action is sufficient
```

Add an `AbortController` ref to prevent ghost toasts after navigation:

```tsx
const abortRef = useRef<AbortController | null>(null);
useEffect(() => () => { abortRef.current?.abort(); }, []);

// Inside startSave:
const ac = new AbortController();
abortRef.current = ac;
const result = await (isEdit ? updateAgentProfile(...) : createAgentProfile(...));
if (ac.signal.aborted) return;
// ... rest of result handling
```

**Research insights:**
- Zod v4 `z.enum()` takes a `const` array: `z.enum(AGENT_EXECUTION_MODES)` — derive the union type from the same constant
- `useTransition` marks state urgent-interruption correctly; raw `.then()` does not — concurrent mode guarantee difference
- `router.refresh()` after `router.push()` races against navigation — the `revalidatePath` in the server action is the correct invalidation mechanism
- AbortController pattern prevents ghost toasts when navigating away during a pending save
- `validation_payload` should NOT be in the Zod schema (never submitted to backend); keep it in `useForm` defaultValues only

---

### Phase 3 — Detail Page Cleanup ([id]/page.tsx → [id]/overview/page.tsx)

> **Note from architecture review:** The existing `[id]/page.tsx` must become a
> redirect to `/overview` when the layout is added. Its content moves to
> `[id]/overview/page.tsx`.

1. **Remove duplicate Overview panel** — the `<div>` at lines 127–145 containing
   `Name:`, `Description:`, `Metadata:`, etc. is redundant next to the form.
   Replace with just `<AgentJsonPreview title='Raw Profile JSON' value={profile} />`

2. **Remove nested scroll** — delete `<div className='h-full overflow-y-auto'>`;
   the Card layout already handles scroll

3. **Show `profile.key`, `profile.enabled`, `profile.execution_mode`** in the header
   (see Phase 4 for header structure)

4. **Remove `getAgentAccessContext()` call from the page** after the layout is
   added — the layout owns the shared access guard

**Design guidelines (from design-guardian):**

- `enabled` badge: `<Badge variant={profile.enabled ? 'success' : 'warning'}>` — green for enabled, amber for disabled
- `execution_mode` badge: `<Badge>` with default/neutral variant — no color-coding between modes
- `key` display: `<code className='font-mono text-xs text-muted-foreground'>key: {profile.key}</code>` in the metadata text line, not a Badge
- Combine badges in `flex flex-wrap items-center gap-2`

---

### Phase 4 — Agent Profiles Detail Sub-Tab Routing

> **Critical architecture finding:** Adding `layout.tsx` to `[id]/` converts the
> existing page into a layout child. The current `[id]/page.tsx` content must
> move to `[id]/overview/page.tsx`. The `[id]/page.tsx` becomes a redirect.
> This is the exact pattern used by `app/dashboard/agents/tasks/[id]/`.

**New file structure:**

```
app/dashboard/agents/profiles/[id]/
  layout.tsx          ← NEW: Card, PageHeader, badges, AgentProfileTabsNav, {children}
  page.tsx            ← CHANGED: becomes redirect to /overview
  overview/
    page.tsx          ← MOVED from [id]/page.tsx (form + JSON preview panels)
    loading.tsx       ← NEW
  memories/
    page.tsx          ← NEW: memories list
    loading.tsx       ← NEW
```

#### `[id]/layout.tsx`

```tsx
// Fetches profile once (cache() ensures deduplication with overview/page.tsx)
// Renders: Card, PageHeader, badges row, AgentProfileTabsNav, {children}
```

The layout fetches `getAgentProfile(profileId)` — deduplicated via `cache()`.
Access guard lives here (not in sub-pages). Profile metadata header (enabled
badge, execution_mode badge, key display, tools badges) lives here.

#### `[id]/page.tsx` (redirect)

```tsx
import { redirect } from 'next/navigation';
export default async function AgentProfilePage({ params }) {
  const { id } = await params;
  redirect(`/dashboard/agents/profiles/${id}/overview`);
}
```

#### Tab strip — inline in `layout.tsx` (no separate component)

Per the existing `tasks/[id]/layout.tsx` pattern: the `TABS` array uses a dynamic `id` so
it cannot be a static module-level `as const`. Build it inline in the layout:

```tsx
// Inside [id]/layout.tsx
const base = `${ROUTES.DASHBOARD.AGENT_PROFILES}/${profile.id}`;
const TABS = [
  { href: `${base}/overview`, label: 'Overview' },
  { href: `${base}/memories`, label: 'Memories' },
] as const;
// Then: <PageTabsNav tabs={TABS} variant="segmented" />
```

Use `variant="segmented"` (CLAUDE.md rule: in-page detail view tabs).
Do NOT create a separate `AgentProfileTabsNav` component — no precedent in the codebase
for extracting detail-level tab nav; task layout builds it inline and profiles should match.

#### `[id]/memories/page.tsx`

Use `<Suspense>` to stream the shell while memories load:

```tsx
import { Suspense } from 'react';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

export default function MemoriesPage({ params }) {
  return (
    <Suspense fallback={<SkeletonList rows={5} />}>
      <MemoriesContent params={params} />
    </Suspense>
  );
}

async function MemoriesContent({ params }) {
  const { id } = await params;
  const { data, totalCount } = await getProfileMemories(Number(id));
  return <AgentMemoriesList memories={data} totalCount={totalCount} />;
}
```

#### `getProfileMemories` — add to `agent-profiles.ts`, follow `activity.ts` structure

> **Simplicity finding:** `getProfileMemories` is GET-only and scoped to profiles.
> CLAUDE.md Rule 4 triggers on "3+ distinct resources with their own CRUD."
> One GET-only function does not warrant its own file — add to `agent-profiles.ts`.

Follow the exact `api/activity.ts` pattern (module-level limit constants, `PaginatedResult`
return type annotation, `hasMore` calculation, no try/catch for reads):

```ts
// In agent-profiles.ts

const DEFAULT_MEMORIES_LIMIT = 50;
const MAX_MEMORIES_LIMIT = 200;

export async function getProfileMemories(
  profileId: number,
  offset = 0,
  limit = DEFAULT_MEMORIES_LIMIT,
): Promise<PaginatedResult<AgentMemory>> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_MEMORIES_LIMIT);
  const safeOffset = Math.max(offset, 0);
  const params = new URLSearchParams({
    offset: String(safeOffset),
    limit: String(safeLimit),
  });
  const { data, totalCount } = await httpClientList<AgentMemory>(
    `${API_URL}/agent-profiles/${profileId}/memories?${params}`,
  );
  return {
    data,
    totalCount,
    hasMore: safeOffset + data.length < totalCount,
  };
}
```

Do NOT use a separate `api/memories.ts` file for a single read-only function.
Do NOT add try/catch — reads throw and let the error boundary handle them.

#### `features/agents/ui/agent-memories-list.tsx`

Table columns (7 total — one removed from original plan to fit 1280px):

| Column | Type | Notes |
|--------|------|-------|
| Scope | text | `scope_type / scope_key` combined |
| Kind | Badge (neutral) | categorical label |
| Priority | number | text-muted-foreground |
| Active | Badge | `success` = Active, `neutral` = Inactive |
| Content | line-clamp-2 + expand icon | chevron-down button for full text |
| Last seen | text (formatDateTime) | |
| Created | text (formatDateTime) | Drop if too wide |

**Content column expand pattern:**

```tsx
// Inline expand within table row — no modal needed
renderCell: (memory) => (
  <MemoryContentCell content={memory.content} />
)

// MemoryContentCell: client component with useState(false) for expanded state
// Collapsed: <p className='line-clamp-2 text-sm'>
// Expanded: <p className='text-sm whitespace-pre-wrap'>
// Toggle: <button aria-label="Expand content"><ChevronDown /></button>
```

**Research insights:**
- App Router: `layout.tsx` + `page.tsx` at same level works — `page.tsx` is `{children}` of layout. BUT: existing full-page content in `page.tsx` renders inside the layout, not replacing it. Moving content to `overview/page.tsx` + redirect is the clean solution (matches existing `tasks/[id]/` pattern exactly)
- `cache()` deduplicates per request-scope — safe for RSC trees; not a shared cache across users
- `<Suspense>` around async inner component enables streaming HTML — shell (header, tabs) renders before memories API call completes
- Priority field type: check backend enum — if numeric (1-10), show as number; if categorical, map to Badge

---

### Phase 5 — List Page Cleanup (profiles/page.tsx)

1. **Remove the entire `Promise.all` block** including `getAgentTasksMeta()`,
   `getAgentTools()`, and all associated variables from `profiles/page.tsx`.
   The list page needs ONLY `getAgentProfiles()`. This eliminates 2 wasted HTTP
   calls on every list render.

2. **Remove the two debug info boxes** from the JSX (sandbox profiles meta +
   tool catalog)

3. **Remove now-unused import statements** from `profiles/page.tsx` — after steps
   1 and 2, these five symbols are unreferenced and will fail `tsc --noEmit` and
   `npm run lint`:
   - `getAgentTasksMeta` (import from `@/features/agents`)
   - `getAgentTools` (import from `@/features/agents`)
   - `normalizeMetaOptions` (import from `@/features/agents`)
   - `normalizeToolOptions` (import from `@/features/agents`)
   - `AgentTasksMeta` (type import from `@/features/agents`)

3. **Simplify `AgentProfilesList` columns** — remove `system_prompt`; add
   combined `Status` cell with enabled + execution_mode badges (single column,
   `flex flex-wrap gap-1.5`):

   Final columns: Name, Description, Status (enabled + execution_mode), Allowed Tools, Sandbox, Updated

4. **Soften empty-state guard** on `new/page.tsx` when `toolOptions.length === 0`
   — the `allowed_tools` field is nullable on backend; profile creation works
   without tools. Replace the hard EmptyState block with an inline warning
   (`toast.info` or a notice banner) above the form, but still render the form.
   Do NOT remove entirely until verifying `AgentProfileForm` handles `toolOptions=[]`
   without crashing (check the multi-select dropdown empty state).

**Research insight:** Removing the `getAgentTasksMeta` + `getAgentTools` calls
is mandatory, not optional. The plan previously said "remove info boxes" without
explicitly removing their data fetches — leaving wasted round-trips every render.

---

### Phase 6 — Bug Fixes

1. **`getAgentProfile()` null guard** — already incorporated into Phase 1d with
   `cache()` wrapping:
   ```ts
   if (!data) throw new ServerError('Not found', { status: 404, url: ... });
   ```

2. **`AgentTaskActions` delete race condition** — replace `useState<boolean>` +
   raw `.then()` with `useTransition`:
   ```tsx
   const [isDeletePending, startDelete] = useTransition();
   
   onClick={() => {
     if (!isConfirmingDelete) { setIsConfirmingDelete(true); return; }
     startDelete(async () => {
       const result = await deleteAgentTask(id);
       if (result.error) { toast.error(result.error); setIsConfirmingDelete(false); return; }
       toast.success('Agent task deleted');
       router.push(backHref);
     });
   }}
   ```
   With `useTransition`, `isDeletePending` becomes `true` synchronously before
   the next click event is processed — prevents the double-fire race.

3. **`isOrganizationManager` in `lib/access.ts`** — rename to `canManageAgents`
   and add a comment explaining the deliberate policy divergence from the backend's
   `UserRole::MANAGER` role (employees are intentionally granted write access):
   ```ts
   // Intentionally broader than backend's UserRole::MANAGER check.
   // Employees are granted agent management access by product decision.
   // If this changes, also update AgentProfileController::assertUserCanManageProfiles().
   export function canManageAgents(role: string | null | undefined) { ... }
   ```

4. **Verify `/api/auth/logout` route exists** before `actionAgentApi` removal.
   The `httpClient` 401 path calls `redirect('/api/auth/logout')` — if this
   route doesn't exist, the 401 path produces a broken redirect. Check
   `app/api/auth/logout/route.ts` exists and clears both cookies.

5. **Remove unreachable branch** from `normalizeAllowedTools` — the object
   key-fallback (lines 149–168) is unreachable since PHP encodes indexed arrays
   as JSON arrays (`[...]`), not objects (`{"0":"tool"}`).

---

## Security Notes

> From security-sentinel review — items to address or explicitly accept.

### High: `allowed_outbound_hosts` — SSRF enablement risk

The field controls which external hosts an AI sandbox can reach. Without hostname
format validation, an admin can submit:
- Full URLs with schemes (`https://evil.com` — may bypass sandbox networking layer)
- Private/loopback IPs (`127.0.0.1`, `169.254.169.254` AWS metadata endpoint)
- CIDR notation (`192.168.0.0/8`)

**Action:** Add per-entry hostname regex validation in the form submit handler
(already included in Phase 2c above). Backend should add matching `regex` rule
to `allowed_outbound_hosts.*` in `AgentProfileRequest`.

### High: `isOrganizationManager` grants employees full write access

Backend `assertUserCanManageProfiles` only checks org membership, not role.
Frontend `isOrganizationManager` includes 'employee'. Combined: any org member
can create/edit/delete agent profiles and set system prompts.

**Action:** Rename to `canManageAgents`, add documenting comment (Phase 6 item 3).
If employee write access is unintended, align backend check with `UserRole::MANAGER`.

### Medium: `system_prompt` has no maximum length

No constraint on backend. A 100k-char prompt is a storage/LLM-context DoS.

**Action:** Add `z.string().max(32_000)` to the Zod schema (Phase 2a — already included).
Backend should also add `max:32000` to `AgentProfileRequest`.

### Medium: `config_schema` / `task_payload_schema` — JSON Schema bombs / external `$ref`

The backend uses `opis/json-schema`. Deeply nested schemas can exhaust memory.
External `$ref` (`{"$ref": "https://attacker.com/schema.json"}`) may trigger
SSRF from the Laravel server.

**Action (backend):** Configure the Opis resolver to reject external URIs.
**Action (frontend):** Add a JSON depth check before submitting (optional, advisory).

---

## Performance Notes

> From performance-oracle review — concrete improvements.

### Must fix before Phase 4

1. **`cache()` on `getAgentProfile`** — without it, layout + overview page each
   make a separate HTTP call to `/agent-profiles/{id}`. Fix is in Phase 1d.

2. **Remove `getAgentTasksMeta` + `getAgentTools` calls from `profiles/page.tsx`**
   — after Phase 5 removes the debug boxes, these become pure waste. Fix
   explicitly in Phase 5.

3. **`cache()` on `getAgentTasksMeta` + `getAgentTools`** — zero-argument
   reference data called from 3+ pages per session. Apply in Phase 1.

### Should add

4. **`<Suspense>` around memories list** — enables streaming HTML: shell renders
   immediately while memories load. Pattern in Phase 4 above.

5. **Explicit `limit=50` on `getProfileMemories`** — do not ship unbounded.
   Show `totalCount` in the UI for observability. Pagination deferred to follow-up.

---

## Acceptance Criteria

### Functional

- [ ] `AgentProfile` TypeScript interface exactly matches `AgentProfileResource::toArray()` (verified field-by-field)
- [ ] `config` field removed from `AgentProfile` — was never in Resource
- [ ] `AgentProfilePayload` matches `AgentProfileRequest::storeRules()` — `key`, `default_model`, `allowed_outbound_hosts`, `execution_mode`, `enabled`, `config_schema`, `task_payload_schema` all present
- [ ] `api/agents.ts` split into `api/agent-profiles.ts` + `api/agent-tasks.ts`; `__tests__/agents.test.ts` import paths updated
- [ ] No raw `fetch` calls in `features/agents/api/`; all mutations use `httpClient` or `httpClientAction`
- [ ] Create-profile form sends `key` — no more 422 on every create attempt
- [ ] `AgentMemory` type and `getProfileMemories()` exist
- [ ] `/dashboard/agents/profiles/[id]/` redirects to `/overview`
- [ ] `/dashboard/agents/profiles/[id]/memories` shows memory list with `<Suspense>`
- [ ] List page makes only ONE API call (`getAgentProfiles`) — no `getAgentTasksMeta`/`getAgentTools`
- [ ] `getAgentProfile` is wrapped in `react.cache()`

### Design

- [ ] Form uses `zodResolver` — empty `name` (< 2 chars) shows inline error
- [ ] `key` field shows on create as editable input; shows on edit as read-only `<code>` display
- [ ] `enabled` shows as success/warning badge in header and list
- [ ] `execution_mode` shows as neutral badge in header and list
- [ ] Detail sub-tabs use `variant="segmented"` (`PageTabsNav`)
- [ ] Memories table `content` column uses `line-clamp-2` with expand icon
- [ ] List table columns fit on 1280px without horizontal scroll

### Quality

- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] ESLint clean (`npm run lint`)
- [ ] `mr-reviewer` passes before commit
- [ ] `fsd-boundary-guard` passes
- [ ] Verify `/app/api/auth/logout/route.ts` exists before removing `actionAgentApi`

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| `key` may be auto-generated by backend from `name` on existing profiles | Check actual DB — if profiles were created without `key`, the backend may have populated it. Auto-slug the `key` from `name` in the create form to guide users |
| `httpClient` 401 path differs from `clearSession()` | Verify `/api/auth/logout` route before migration; document the intentional behavior change |
| `actionAgentApi` removal requires 5 callers to add try/catch | `httpClientAction` helper avoids per-caller boilerplate; add it to `shared/lib/httpClient.ts` once |
| Phase 4 route restructuring changes the URL of the detail page | `[id]/page.tsx` becomes a redirect so existing links work; `overview/page.tsx` is the new home for form content |
| `api/agents.ts` split requires updating test import paths | Update `__tests__/agents.test.ts` in the same commit — it's a simple import path change |
| Memories endpoint may be slow under high memory counts | `limit=50` default; defer pagination UI to follow-up once real volumes are known |

---

## Technical Notes

### `httpClientAction` — the correct replacement for `actionAgentApi`

```ts
// shared/lib/httpClient.ts — add this export
export async function httpClientAction<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<ActionResult<T>> {
  try {
    const { data } = await httpClient<T>(url, init);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', fallbackMessage);
      if (error.status === 422 || error.status === 403) {
        return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
      }
    }
    throw error; // 5xx, network errors → error boundary
  }
}
```

### Zod enum from const array pattern (Zod v4)

```ts
export const AGENT_EXECUTION_MODES = ['inline', 'isolated', 'paperclip'] as const;
export type AgentExecutionMode = typeof AGENT_EXECUTION_MODES[number];

// In schema:
execution_mode: z.enum(AGENT_EXECUTION_MODES).nullable().optional(),
```

This ensures the TypeScript union type and the Zod runtime validator stay in sync from a single source of truth.

### `AgentTask.execution_mode` alignment

While fixing `AgentProfile`, also change `AgentTask.execution_mode: string | null` to
`AgentTask.execution_mode: AgentExecutionMode | null` — same backend enum governs both.

---

## Implementation Order

1. **`model/types.ts`** — fix `AgentProfile`, `AgentProfilePayload`, add `AgentMemory`, add `AgentExecutionMode` const + type; align `AgentTask.execution_mode`
2. **`shared/lib/httpClient.ts`** — add `httpClientAction<T>` export
3. **`shared/lib/routes.ts`** — add `AGENT_PROFILE_OVERVIEW`, `AGENT_PROFILE_MEMORIES` function constants
4. **`api/agents.ts` → split** into `api/agent-profiles.ts` + `api/agent-tasks.ts`; apply `cache()` to `getAgentProfile`, `getAgentTasksMeta`, `getAgentTools`; add `getProfileMemories` to `agent-profiles.ts`; remove `actionAgentApi`; update `index.ts`; update `__tests__/agents.test.ts`
5. **`model/schemas.ts`** — add `agentProfileCreateSchema` + `agentProfileEditSchema`
6. **`ui/agent-profile-form.tsx`** — add all missing fields, zodResolver, two transitions, auto-slug, `allowed_outbound_hosts` validation, fix payload, remove `router.refresh()` after push, add AbortController
7. **`ui/agent-profiles-list.tsx`** — simplify columns, combined Status cell
8. **`profiles/page.tsx`** — remove `Promise.all`, remove meta/tools fetches and their import statements, remove debug boxes
9. **`profiles/new/page.tsx`** — soften the empty-state guard (replace `EmptyState` with an inline warning banner above the form, keep the form rendered); keep the `getAgentTools()` call — it populates `AgentProfileForm`'s `toolOptions` multi-select dropdown and is still needed; do NOT drop the fetch
10. **`profiles/[id]/` → route restructure** — create `layout.tsx` (with TABS inline, no separate component — see Phase 4), convert `page.tsx` to redirect, create `overview/page.tsx` + `loading.tsx`, move existing detail content; also remove `getAgentTasksMeta`/`getAgentTools` calls that travel with the moved content into `overview/page.tsx`
11. **`ui/agent-memories-list.tsx`** — new table component with expand pattern
12. **`memories/page.tsx` + `loading.tsx`** — new sub-route with Suspense streaming
13. **Bug fixes** — rename `isOrganizationManager` → `canManageAgents`, fix `normalizeAllowedTools` dead branch, fix `AgentTaskActions` delete race

---

## References

### Internal

- `features/agents/model/types.ts` — current (incorrect) types
- `features/agents/api/agents.ts:25-72` — `actionAgentApi` CLAUDE.md violation + behavioral gap
- `features/agents/ui/agent-profile-form.tsx:27-37` — `AgentProfileFormValues` missing fields; hand-written type must be replaced
- `features/agents/ui/agent-task-actions.tsx:149-178` — delete race condition (raw `.then()` vs `useTransition`)
- `app/dashboard/agents/profiles/[id]/page.tsx:127-145` — duplicate Overview panel to remove
- `app/dashboard/agents/profiles/page.tsx:84-108` — debug boxes + wasted fetches to remove
- `app/dashboard/agents/tasks/[id]/layout.tsx` — reference pattern for profile layout + tab strip
- `app/dashboard/agents/tasks/[id]/overview/page.tsx` — reference pattern for sub-route page
- `shared/lib/httpClient.ts` — where `httpClientAction` will be added

### Backend

- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Resources/API/v1/AgentProfileResource.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Resources/API/v1/AgentMemoryResource.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Requests/API/v1/AgentProfileRequest.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/routes/api.php:315-339` — agent profile/memory routes

### Institutional Learnings Applied

- `docs/solutions/integration-issues/server-action-html-response-json-parse.md` — confirms that
  Server Actions must not call `.json()` directly; `httpClient` already handles this via the
  safe two-step parse. This learning validates the `httpClient` migration direction and confirms
  the `actionAgentApi` raw-fetch approach is also vulnerable to this bug when the backend returns HTML.
