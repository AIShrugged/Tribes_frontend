---
title:
  'feat: Agent Profiles — new backend contracts (version, tools tab, prompt
  history)'
type: feat
status: active
date: 2026-05-22
deepened: 2026-05-22
---

# feat: Agent Profiles — new backend contracts (version, tools tab, prompt history)

## Enhancement Summary

**Deepened on:** 2026-05-22 **Research agents used:**
kieran-typescript-reviewer, architecture-strategist (×2),
julik-frontend-races-reviewer, security-sentinel, code-simplicity-reviewer,
performance-oracle, pattern-recognition-specialist

### Key Improvements Over Original Plan

1. **`restoreAgentProfilePromptVersion` must use `httpClientAction`**, not a
   manual try/catch — the existing helper handles `success: false` envelopes and
   403/422 that the manual pattern misses.
2. **`revalidatePath` must use `'layout'` scope** —
   `revalidatePath(..., 'layout')` not just the `/overview` sub-path, matching
   the pattern in `updateAgentProfile`.
3. **`AgentToolFull` should extend `AgentToolDefinition`** — making the
   structural relationship explicit and reducing type duplication.
4. **Version history UI should be a Modal, not a custom dropdown** — reuse
   existing `ModalRoot`; avoids z-index bugs, click-outside handling, keyboard
   navigation, and scroll issues from a custom absolute-positioned div.
5. **After restore: use `form.setValue()`, not `router.refresh()`** —
   `router.refresh()` does not reset react-hook-form state, causing the form to
   silently show stale data. The `onRestored` callback must receive the restored
   `AgentProfile` and call `reset()`.
6. **7 race conditions identified** in the prompt history component — state
   machine pattern required; simple `open` boolean is insufficient.
7. **`getAgentProfileTools` must be `cache()`-wrapped** — without it, layout and
   page both fire separate HTTP calls within the same render pass.
8. **`agentProfileEditSchema` must `.omit({ allowed_tools: true })`** — hiding
   the JSX field alone does not prevent it from being in form values and
   submitted.
9. **`index.ts` must use explicit `export type { ... }`**, replacing the
   existing `export * from './model/types'` barrel which violates every other
   feature's pattern.
10. **Input validation required in restore server action** —
    `Number.isInteger(id) && id > 0` guards must be added; TypeScript types are
    compile-time only.
11. **`version` parameter naming** — the restore route uses the version _number_
    (not the record `id`) as the path segment; rename param to `versionNumber`
    to clarify.
12. **`AGENT_PROFILE_TOOLS` constant must use block-body arrow function** form
    matching peers (`{ return \`...\` }` not implicit return).
13. **Tools page must use `Suspense` + inner async component** for streaming,
    matching the `memories/page.tsx` pattern.

---

## Overview

Backend commit `04fbd90 feat/agents` (2026-05-22) added three new endpoints and
changed one rule on the existing PATCH endpoint. This plan syncs the frontend
with those contracts.

**Scope:** `features/agents/` + `app/dashboard/agents/profiles/[id]/` **Related
plan:** `2026-05-22-refactor-agents-profiles-audit-and-fix-plan.md` (contract
sync + design audit — this plan builds on top of it but is independent and can
land first).

---

## What Changed in the Backend

### 1. `AgentProfileResource` — new `version` field

```json
{ "id": 1, "key": "github-reviewer", ..., "version": 3 }
```

`version: integer` — auto-managed server-side, increments each time
`system_prompt` changes via PATCH. Never send in a PATCH payload.

### 2. `PATCH /api/v1/agent-profiles/{id}` — `allowed_tools` is now **prohibited**

`AgentProfileRequest::updateRules()` marks `allowed_tools` as `['prohibited']`.
Sending it in the body returns **422**. Must be removed from both the edit form
UI **and** the submit payload construction.

### 3. New endpoints

| Method | Path                                                                  | Returns                                                |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/v1/agent-profiles/{id}/tools`                                   | `AgentProfileTool[]` (name + description + parameters) |
| GET    | `/api/v1/agent-profiles/{id}/prompt-versions`                         | `AgentProfilePromptVersion[]` (newest first, all rows) |
| POST   | `/api/v1/agent-profiles/{id}/prompt-versions/{versionNumber}/restore` | Updated `AgentProfile`                                 |

**Backend notes:**

- The restore route segment is the version **number** (the sequential counter),
  not the prompt-version record's primary key `id`.
- `prompt-versions` returns all rows — no pagination. The list is bounded by the
  number of times `system_prompt` has been edited.
- `GET {id}/tools` returns ALL system tools when `allowed_tools` is null/empty
  on the profile, so the list can be large.

---

## New TypeScript Types

### `AgentProfile` — add `version` field

```ts
// features/agents/model/types.ts
export interface AgentProfile {
  // ... all existing fields unchanged ...
  version: number; // ADD — server-managed, increments on each system_prompt change
}
```

### `AgentProfilePayload` — split into create vs edit

The backend forbids `allowed_tools` in PATCH. Split the single payload type into
two, keeping the existing `Payload` suffix convention used throughout
`features/agents/`.

```ts
// features/agents/model/types.ts

// Renames the existing AgentProfilePayload
export interface AgentProfileCreatePayload {
  key: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;
  sandbox_profile: string | null;
  allowed_tools: string[]; // allowed on POST; keep as string[] (not | null)
  allowed_outbound_hosts: string[]; // keep as string[] — Zod normalises from textarea
  default_model: string | null;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
}

// New — same minus key and allowed_tools
export interface AgentProfileUpdatePayload {
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;
  sandbox_profile: string | null;
  allowed_outbound_hosts: string[]; // keep as string[]
  default_model: string | null;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
}
```

**Nullability note:** `allowed_tools` and `allowed_outbound_hosts` are
`string[]` (not `string[] | null`) because the Zod schema produces `string[]`
from the form — changing them to `| null` would create a type mismatch with the
Zod inferred type.

**Key note:** `key` is omitted from `AgentProfileUpdatePayload` because the UI
makes it read-only in edit mode (not because the backend prohibits it — the
backend actually allows `key` in PATCH with `sometimes` validation).

### `AgentProfileTool` — new type for `{id}/tools` response

Named `AgentProfileTool` (not `AgentToolFull`) to make scope explicit and to
avoid the misleading "Full = superset" implication. Extends
`AgentToolDefinition` to document the structural relationship:

```ts
// features/agents/model/types.ts

// Existing — do not change
export interface AgentToolDefinition {
  name: string;
  label?: string | null;
  description?: string | null;
}

// New — per-profile endpoint, richer shape
export interface AgentProfileTool extends AgentToolDefinition {
  description: string; // narrows to required (not optional)
  parameters: Record<string, unknown>; // JSON Schema object
}
```

### `AgentProfilePromptVersion` — new type

```ts
// features/agents/model/types.ts
export interface AgentProfilePromptVersion {
  id: number;
  agent_profile_id: number;
  version: number; // the sequential version counter
  system_prompt: string | null;
  created_at: string; // ISO 8601 — no updated_at ($timestamps = false on model)
}
```

---

## Updated Server Actions

All changes to `features/agents/api/agent-profiles.ts`:

### 1. `updateAgentProfile` — change payload type

```ts
// Before: Partial<AgentProfilePayload>
// After:
export async function updateAgentProfile(
  id: number,
  payload: AgentProfileUpdatePayload,
): Promise<ActionResult<AgentProfile>> {
  // implementation unchanged; payload no longer contains allowed_tools or key
}
```

### 2. `getAgentProfileTools` — wrap in `cache()`

```ts
// Must be cache()-wrapped — layout and page both exist in same render pass
export const getAgentProfileTools = cache(
  async (id: number): Promise<AgentProfileTool[]> => {
    if (!Number.isInteger(id) || id <= 0) return [];
    const { data } = await httpClient<AgentProfileTool[]>(
      `${API_URL}/agent-profiles/${id}/tools`,
    );
    return data ?? [];
  },
);
```

### 3. `getAgentProfilePromptVersions` — called from Client Component lazily

```ts
// No cache() — called lazily from client, not server render tree
export async function getAgentProfilePromptVersions(
  id: number,
): Promise<AgentProfilePromptVersion[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  const { data } = await httpClient<AgentProfilePromptVersion[]>(
    `${API_URL}/agent-profiles/${id}/prompt-versions`,
  );
  return data ?? [];
}
```

### 4. `restoreAgentProfilePromptVersion` — use `httpClientAction`

**Critical:** must use the shared `httpClientAction` helper (not a manual
try/catch) because the manual pattern does not handle `success: false` response
envelopes or the `error.status === undefined` case.

```ts
export async function restoreAgentProfilePromptVersion(
  profileId: number,
  versionNumber: number, // the sequential version counter, not the record id
): Promise<ActionResult<AgentProfile>> {
  if (
    !Number.isInteger(profileId) ||
    profileId <= 0 ||
    !Number.isInteger(versionNumber) ||
    versionNumber <= 0
  ) {
    return { data: null, error: 'Invalid profile or version' };
  }

  const result = await httpClientAction<AgentProfile>(
    `${API_URL}/agent-profiles/${profileId}/prompt-versions/${versionNumber}/restore`,
    { method: 'POST' },
    'Failed to restore prompt version',
  );

  if (result.error === null) {
    // Revalidate the entire layout — the header shows version-derived data
    revalidatePath(`/dashboard/agents/profiles/${profileId}`, 'layout');
  }

  // On 403: return fixed message, not the backend's authorization detail
  // httpClientAction already handles this — no extra wrapping needed

  return result;
}
```

**`revalidatePath` scope:** use `'layout'` scope, not just `/overview`. The
layout header may show version-derived data (like the profile card), and
`updateAgentProfile` already uses `'layout'` scope (line 72 of
`agent-profiles.ts`) — be consistent.

---

## Schema Changes

**File: `features/agents/model/schemas.ts`**

```ts
// Remove allowed_tools from the shared base
const agentProfileBaseSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string(),
  system_prompt: z.string().max(32_000),
  sandbox_profile: z.string(),
  // allowed_tools: REMOVED from base
  allowed_outbound_hosts: z.string(),
  execution_mode: z
    .enum(['inline', 'isolated', 'paperclip'])
    .nullable()
    .optional(),
  default_model: z.string().max(120),
  enabled: z.boolean(),
  config_schema: jsonStringSchema,
  task_payload_schema: jsonStringSchema,
  metadata: jsonStringSchema,
});

// Create schema: base + key + allowed_tools
export const agentProfileCreateSchema = agentProfileBaseSchema.extend({
  key: z
    .string()
    .min(2)
    .max(255)
    .regex(/^[a-z0-9_-]+$/),
  allowed_tools: z.array(z.string()),
});

// Edit schema: base only — allowed_tools explicitly absent
export const agentProfileEditSchema = agentProfileBaseSchema;

export type AgentProfileCreateValues = z.infer<typeof agentProfileCreateSchema>;
export type AgentProfileEditValues = z.infer<typeof agentProfileEditSchema>;
```

**Why this matters:** Without removing `allowed_tools` from the base schema,
`agentProfileEditSchema` still has the field registered in react-hook-form. Even
if the JSX input is conditionally hidden, the field exists in `values` during
`onSubmit` and would end up in the `basePayload` object, causing a 422 from the
backend.

---

## Form Changes

**File: `features/agents/ui/agent-profile-form.tsx`**

Three separate changes required:

### A — Use separate schema per mode

```ts
// Before (single schema):
const form = useForm({ resolver: zodResolver(agentProfileCreateSchema) });

// After (mode-specific schema):
const form = useForm({
  resolver: zodResolver(profile ? agentProfileEditSchema : agentProfileCreateSchema),
  defaultValues: ...,
});
```

### B — Conditionally render `allowed_tools` field

```tsx
{/* Only on create — backend returns 422 if sent in PATCH */}
{!profile && (
  <Controller
    name="allowed_tools"
    control={control}
    render={...}
  />
)}
```

### C — Construct separate payload objects in `onSubmit`

The submit handler currently builds a single `basePayload` that includes
`allowed_tools`. After the schema split, `values` in edit mode will not contain
`allowed_tools`. Split the payload construction explicitly:

```ts
const onSubmit = async (
  values: AgentProfileCreateValues | AgentProfileEditValues,
) => {
  if (profile) {
    // Edit mode — AgentProfileUpdatePayload (no allowed_tools, no key)
    const updatePayload: AgentProfileUpdatePayload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      system_prompt: values.system_prompt.trim() || null,
      sandbox_profile: values.sandbox_profile || null,
      allowed_outbound_hosts: parseHostList(values.allowed_outbound_hosts),
      execution_mode: values.execution_mode ?? null,
      default_model: values.default_model.trim() || null,
      enabled: values.enabled,
      config_schema: parseJsonInput(values.config_schema),
      task_payload_schema: parseJsonInput(values.task_payload_schema),
      metadata: parseJsonInput(values.metadata),
    };
    const result = await updateAgentProfile(profile.id, updatePayload);
    // handle result ...
  } else {
    // Create mode — AgentProfileCreatePayload (includes key and allowed_tools)
    const createValues = values as AgentProfileCreateValues;
    const createPayload: AgentProfileCreatePayload = {
      ...updatePayload, // spread common fields
      key: createValues.key,
      allowed_tools: createValues.allowed_tools,
    };
    const result = await createAgentProfile(createPayload);
    // handle result ...
  }
};
```

### D — Add `AgentPromptVersionHistory` in edit mode

```tsx
{
  profile && (
    <AgentPromptVersionHistory
      profileId={profile.id}
      currentVersion={profile.version}
      disabled={formState.isDirty}
      onRestored={(restoredProfile) => {
        // Do NOT router.refresh() — it won't reset react-hook-form state
        // Instead, reset the form with the restored values so the user sees
        // the restored prompt and isDirty becomes true (requires explicit Save)
        reset(buildDefaultValues(restoredProfile));
        toast.success(`Restored to version ${restoredProfile.version}`);
      }}
    />
  );
}
```

---

## Tools Tab — Phase 3

### Routes

**File: `shared/lib/routes.ts`**

```ts
// Keep block-body arrow function form matching existing peers
AGENT_PROFILE_TOOLS: (id: string | number) => { return `/dashboard/agents/profiles/${id}/tools` },
```

### Layout tab update

**File: `app/dashboard/agents/profiles/[id]/layout.tsx`**

```ts
const TABS = [
  {
    href: ROUTES.DASHBOARD.AGENT_PROFILE_OVERVIEW(profile.id),
    label: 'Overview',
  },
  { href: ROUTES.DASHBOARD.AGENT_PROFILE_TOOLS(profile.id), label: 'Tools' }, // ADD
  {
    href: ROUTES.DASHBOARD.AGENT_PROFILE_MEMORIES(profile.id),
    label: 'Memories',
  },
];
```

### Loading state

**New file: `app/dashboard/agents/profiles/[id]/tools/loading.tsx`**

```tsx
import { SkeletonList } from '@/shared/ui/layout/skeleton';
export default function Loading() {
  return <SkeletonList count={6} />;
}
```

### Page (Server Component with Suspense streaming)

Match the `memories/page.tsx` pattern — wrap in `Suspense` so the shell streams
before the data fetch completes.

**New file: `app/dashboard/agents/profiles/[id]/tools/page.tsx`**

```tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SkeletonList } from '@/shared/ui/layout/skeleton';
import { getAgentProfileTools } from '@/features/agents/api/agent-profiles';
import { AgentProfileToolsList } from '@/features/agents';

async function ToolsContent({ profileId }: { profileId: number }) {
  const tools = await getAgentProfileTools(profileId);
  return <AgentProfileToolsList tools={tools} />;
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
    <Suspense fallback={<SkeletonList count={6} />}>
      <ToolsContent profileId={profileId} />
    </Suspense>
  );
}
```

### Tools list component

**New file: `features/agents/ui/agent-profile-tools-list.tsx`**

No `'use client'` — purely display. Use existing `AgentJsonPreview` for
parameters to stay consistent with `agent-json-preview.tsx` (not
`JSON.stringify` inline).

```tsx
import { AgentJsonPreview } from '@/features/agents/ui/agent-json-preview';
import type { AgentProfileTool } from '../model/types';

interface Props {
  tools: AgentProfileTool[];
}

export function AgentProfileToolsList({ tools }: Props) {
  if (tools.length === 0) {
    return (
      <p className='text-sm text-white/40'>
        No tools assigned. When allowed_tools is unset, all system tools are
        available.
      </p>
    );
  }

  return (
    <ul className='space-y-3'>
      {tools.map((tool) => (
        <li
          key={tool.name}
          className='rounded-lg border border-white/10 bg-white/5 p-4'
        >
          <p className='font-mono text-sm font-semibold text-violet-300'>
            {tool.name}
          </p>
          {tool.description && (
            <p className='mt-1 text-sm text-white/70'>{tool.description}</p>
          )}
          {Object.keys(tool.parameters).length > 0 && (
            <details className='mt-2'>
              <summary className='cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors'>
                Parameters
              </summary>
              <div className='mt-2'>
                <AgentJsonPreview data={tool.parameters} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
```

---

## Prompt Version History — Phase 4

### UI Pattern: Modal (not custom dropdown)

The version history UI must use the existing `Modal`/`ModalRoot` component
instead of a custom absolute-positioned div. Reasons:

- Each version row is tall (version badge + date + multi-line preview + Restore
  button)
- A dropdown with 5–10 rows clips off-screen or requires scroll-inside-scroll
- `ModalRoot` already handles Escape, backdrop click, focus trap, scroll-lock,
  and animation
- `size="lg"` (`max-w-3xl`) gives enough width for meaningful prompt previews

### Trigger button placement

Place a small ghost "History" button (with lucide `History` icon) in the **label
row** above the system_prompt textarea — not near the Save button:

```tsx
<div className='flex flex-col gap-1'>
  <div className='flex items-center justify-between'>
    <label className='text-xs text-white/40'>System Prompt</label>
    {profile && (
      <button
        type='button'
        disabled={formState.isDirty}
        title={
          formState.isDirty
            ? 'Save your changes before browsing history'
            : undefined
        }
        onClick={openHistory}
        className='flex items-center gap-1 text-xs text-white/40 hover:text-violet-300 transition-colors disabled:pointer-events-none disabled:opacity-40'
      >
        <History className='h-3.5 w-3.5' />
        History
      </button>
    )}
  </div>
  <InputTextarea {...register('system_prompt')} rows={6} />
</div>
```

### State machine (not simple boolean flags)

Seven race conditions were identified with a simple `open` + `isLoading` boolean
approach. Use a discriminated state machine:

```ts
type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; versions: AgentProfilePromptVersion[] }
  | {
      status: 'restoring';
      versions: AgentProfilePromptVersion[];
      restoringVersion: number;
    };
```

Transitions:

- `idle → loading` on first open
- `loading → ready` on fetch success
- `loading → idle` on fetch error
- `ready → restoring` on Restore click
- `restoring → ready` on restore error (stay open, re-enable rows)
- `restoring → idle` on restore success (close modal, call `onRestored`)

### AbortController for stale fetch prevention

```ts
const fetchAbortRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => {
    fetchAbortRef.current?.abort();
  };
}, []);

const loadVersions = useCallback(async () => {
  fetchAbortRef.current?.abort();
  const ac = new AbortController();
  fetchAbortRef.current = ac;

  setState({ status: 'loading' });
  try {
    const versions = await getAgentProfilePromptVersions(profileId);
    if (ac.signal.aborted) return;
    setState({ status: 'ready', versions });
  } catch {
    if (ac.signal.aborted) return;
    toast.error('Failed to load version history');
    setState({ status: 'idle' });
  }
}, [profileId]);
```

### Close modal when parent form becomes dirty

```ts
useEffect(() => {
  if (disabled && state.status !== 'idle') {
    setState({ status: 'idle' });
  }
}, [disabled, state.status]);
```

### `onRestored` callback receives the restored profile

```ts
interface Props {
  profileId: number;
  currentVersion: number;
  disabled: boolean;
  onRestored: (restoredProfile: AgentProfile) => void; // receives full profile
}
```

The form passes a callback that calls
`reset(buildDefaultValues(restoredProfile))` rather than `router.refresh()`.
This is required because `router.refresh()` re-fetches Server Components but
does NOT reset react-hook-form state — the form would silently display the old
prompt values while the server has the new ones.

### Prompt preview helper

```ts
function previewPrompt(text: string | null, limit = 200): string {
  if (!text) return '—';
  const flat = text.trim().replaceAll(/\s*\n+\s*/g, ' ');
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}
```

- 200-char limit (modal width justifies more than 120)
- Newlines collapsed to spaces (system prompts use newlines as paragraph
  separators)
- Use `text-sm text-white/70` — not `font-mono` (prompts are prose, not code)

### Version ordering and truncation

- Display newest first (as backend returns — v3 at top, v1 at bottom)
- Show 10 most recent by default; use existing `CollapsibleSection` for older:

```tsx
<>
  {versions.slice(0, 10).map((v) => (
    <VersionRow key={v.version} {...v} />
  ))}
  {versions.length > 10 && (
    <CollapsibleSection
      label={`${versions.length - 10} older versions`}
      defaultOpen={false}
    >
      {versions.slice(10).map((v) => (
        <VersionRow key={v.version} {...v} />
      ))}
    </CollapsibleSection>
  )}
</>
```

- Date format: `format(parseISO(v.created_at), 'dd MMM yyyy, HH:mm')` — absolute
  dates, not relative time ("3 days ago") — this is a configuration audit trail
- Version label: `v{v.version}` in `font-mono text-violet-300`

### Full component signature

**New file: `features/agents/ui/agent-prompt-version-history.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Modal } from '@/shared/ui/modal'; // verify import path
import { CollapsibleSection } from '@/shared/ui'; // verify import path
import {
  getAgentProfilePromptVersions,
  restoreAgentProfilePromptVersion,
} from '../api/agent-profiles';
import type { AgentProfile, AgentProfilePromptVersion } from '../model/types';

// ... (HistoryState type, previewPrompt helper)

export function AgentPromptVersionHistory({
  profileId,
  currentVersion,
  disabled,
  onRestored,
}: Props) {
  const [state, setState] = useState<HistoryState>({ status: 'idle' });
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      fetchAbortRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (disabled && state.status !== 'idle') setState({ status: 'idle' });
  }, [disabled, state.status]);

  const open = state.status !== 'idle';
  const loadVersions = useCallback(async () => {
    /* ... see above */
  }, [profileId]);
  const handleOpen = () => {
    setState({ status: 'loading' });
    loadVersions();
  };
  const handleClose = () => {
    setState({ status: 'idle' });
  };

  const handleRestore = async (versionNumber: number) => {
    if (state.status !== 'ready') return;
    setState({
      status: 'restoring',
      versions: state.versions,
      restoringVersion: versionNumber,
    });
    const result = await restoreAgentProfilePromptVersion(
      profileId,
      versionNumber,
    );
    if (result.error) {
      toast.error(result.error);
      setState({ status: 'ready', versions: state.versions });
      return;
    }
    setState({ status: 'idle' });
    onRestored(result.data!);
  };

  // render trigger button + Modal
}
```

---

## `index.ts` Export Changes

**File: `features/agents/index.ts`**

Replace the `export * from './model/types'` barrel with explicit type-only
exports, matching the convention used by every other feature in the codebase:

```ts
// Before (barrel — violates every other feature's pattern):
export * from './model/types';

// After (explicit type-only — consistent with features/issues, features/teams, etc.):
export type {
  AgentProfile,
  AgentProfileCreatePayload,
  AgentProfileUpdatePayload,
  AgentToolDefinition,
  AgentProfileTool,
  AgentProfilePromptVersion,
  AgentTask,
  AgentTaskPayload,
  AgentTaskRun,
  AgentMemory,
  AgentActivityItem,
  AgentTasksMeta,
  AgentExecutionMode,
  // ... all other types previously exported via *
} from './model/types';

// Component exports (unchanged):
export { AgentProfileToolsList } from './ui/agent-profile-tools-list';
export { AgentPromptVersionHistory } from './ui/agent-prompt-version-history';
// ... existing component exports
```

---

## Acceptance Criteria

### Contract changes

- [ ] `AgentProfile` type has `version: number` field
- [ ] `AgentProfilePayload` is split into `AgentProfileCreatePayload` (has
      `allowed_tools`) and `AgentProfileUpdatePayload` (does not)
- [ ] `AgentProfileCreatePayload.allowed_tools` is `string[]` (not
      `string[] | null`)
- [ ] `updateAgentProfile` server action signature accepts
      `AgentProfileUpdatePayload`
- [ ] `AgentProfileTool` extends `AgentToolDefinition` and adds required
      `description` + `parameters`
- [ ] `AgentProfilePromptVersion` type exists with correct fields (no
      `updated_at`)
- [ ] `getAgentProfileTools` is wrapped in `cache()` from `react`
- [ ] `restoreAgentProfilePromptVersion` uses `httpClientAction` (not manual
      try/catch)
- [ ] Restore server action validates `Number.isInteger(profileId)` and
      `Number.isInteger(versionNumber)` before URL construction
- [ ] Restore server action calls `revalidatePath(..., 'layout')` not just
      `/overview`
- [ ] `index.ts` uses explicit `export type { ... }` not `export * from`

### Schema changes

- [ ] `agentProfileBaseSchema` does not include `allowed_tools`
- [ ] `agentProfileCreateSchema` extends base with
      `allowed_tools: z.array(z.string())`
- [ ] `agentProfileEditSchema` is the base schema only — `allowed_tools` absent
- [ ] `AgentProfileEditValues` (inferred from edit schema) does not include
      `allowed_tools`

### Form — `allowed_tools` removal

- [ ] `AgentProfileForm` uses `agentProfileEditSchema` in edit mode,
      `agentProfileCreateSchema` in create mode
- [ ] Edit mode `onSubmit` payload object never contains `allowed_tools` key
- [ ] Create mode `onSubmit` payload object includes `allowed_tools`
- [ ] `allowed_tools` Controller is only rendered when `!profile`
- [ ] `onRestored` callback receives `AgentProfile` and calls
      `form.reset(buildDefaultValues(restoredProfile))` — NOT `router.refresh()`

### Profile detail — "Tools" tab

- [ ] `AGENT_PROFILE_TOOLS` constant uses block-body arrow function form
- [ ] Tab order: Overview → Tools → Memories
- [ ] `tools/loading.tsx` exists with `SkeletonList`
- [ ] `tools/page.tsx` is a Server Component that uses `Suspense` + inner async
      component
- [ ] Page validates `profileId` with `notFound()` guard
- [ ] `AgentProfileToolsList` renders name in `font-mono text-violet-300`,
      description in `text-white/70`
- [ ] Parameters use `AgentJsonPreview` component (not inline `JSON.stringify`)
- [ ] Empty state message references "allowed_tools is unset" behavior
- [ ] No edit controls in the tools tab

### Profile detail — Prompt History

- [ ] Trigger is a ghost "History" button with `History` icon, placed in label
      row above textarea
- [ ] Button is disabled (`formState.isDirty`) with tooltip text
- [ ] Clicking opens a Modal (not a custom dropdown), reusing existing Modal
      component
- [ ] History component uses state machine with 4 states
      (idle/loading/ready/restoring)
- [ ] `AbortController` ref prevents stale fetch results on rapid open/close
- [ ] When `disabled` prop becomes true while modal is open, modal closes
- [ ] All Restore buttons disabled while any restore is in flight (`restoring`
      state)
- [ ] Prompt preview collapses newlines to spaces, truncates to 200 chars
- [ ] Dates formatted as absolute `dd MMM yyyy, HH:mm` (not relative)
- [ ] Shows 10 versions; older ones in `CollapsibleSection`
- [ ] On restore success: `setState(idle)` + `onRestored(result.data)` — no
      `router.refresh()`
- [ ] On restore error: `toast.error(result.error)` + return to `ready` state
      (modal stays open)
- [ ] Empty state: "No previous versions — history is created when you save a
      new prompt."

---

## Implementation Phases (Revised)

### Phase 1 — Types and schemas (20 min)

**`features/agents/model/types.ts`**

1. Add `version: number` to `AgentProfile`
2. Rename `AgentProfilePayload` → `AgentProfileCreatePayload`
3. Add `AgentProfileUpdatePayload` (minus `key`, minus `allowed_tools`)
4. Add `AgentProfileTool extends AgentToolDefinition` (rename from original
   `AgentToolFull`)
5. Add `AgentProfilePromptVersion`

**`features/agents/model/schemas.ts`** 6. Remove `allowed_tools` from
`agentProfileBaseSchema` 7. Add `allowed_tools` to `agentProfileCreateSchema`
via `.extend()` 8. `agentProfileEditSchema` is now just `agentProfileBase` (no
change needed if base was updated) 9. Add
`AgentProfileEditValues = z.infer<typeof agentProfileEditSchema>`

**`features/agents/index.ts`** 10. Replace `export * from './model/types'` with
explicit `export type { ... }` block

---

### Phase 2 — Server actions (20 min)

**`features/agents/api/agent-profiles.ts`**

1. Update `updateAgentProfile` to accept `AgentProfileUpdatePayload`
2. Add `getAgentProfileTools` (cache()-wrapped, with integer guard)
3. Add `getAgentProfilePromptVersions` (no cache, with integer guard)
4. Add `restoreAgentProfilePromptVersion` (using `httpClientAction`, with
   integer guard, `'layout'` revalidation)

---

### Phase 3 — Edit form changes (25 min)

**`features/agents/ui/agent-profile-form.tsx`**

1. Switch to mode-specific schema in `useForm` resolver
2. Update `FormValues` type to union or use mode-specific type
3. Conditionally render `allowed_tools` field (`!profile` guard)
4. Split `onSubmit` payload construction into create/update branches
5. Add `AgentPromptVersionHistory` in edit mode (with `onRestored` callback that
   calls `reset()`)

---

### Phase 4 — Tools tab (25 min)

1. Add `AGENT_PROFILE_TOOLS` to `shared/lib/routes.ts`
2. Add Tools tab to `app/dashboard/agents/profiles/[id]/layout.tsx`
3. Create `app/dashboard/agents/profiles/[id]/tools/loading.tsx`
4. Create `app/dashboard/agents/profiles/[id]/tools/page.tsx` (Suspense pattern)
5. Create `features/agents/ui/agent-profile-tools-list.tsx`
6. Export `AgentProfileToolsList` from `features/agents/index.ts`

---

### Phase 5 — Prompt version history component (45 min)

1. Create `features/agents/ui/agent-prompt-version-history.tsx` with state
   machine + AbortController
2. Export from `features/agents/index.ts`
3. Import into `agent-profile-form.tsx` in edit mode

---

## Files to Create / Modify

### New files

| File                                                   | Purpose                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| `app/dashboard/agents/profiles/[id]/tools/page.tsx`    | Tools tab page (Server Component + Suspense) |
| `app/dashboard/agents/profiles/[id]/tools/loading.tsx` | Skeleton loading state                       |
| `features/agents/ui/agent-profile-tools-list.tsx`      | Read-only tools list                         |
| `features/agents/ui/agent-prompt-version-history.tsx`  | Prompt history modal                         |

### Modified files

| File                                            | Change                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `features/agents/model/types.ts`                | Add `version` to `AgentProfile`; split payload types; add `AgentProfileTool`, `AgentProfilePromptVersion` |
| `features/agents/model/schemas.ts`              | Remove `allowed_tools` from base; add to create schema only                                               |
| `features/agents/api/agent-profiles.ts`         | Update `updateAgentProfile`; add 3 new actions; cache()-wrap tools action                                 |
| `features/agents/ui/agent-profile-form.tsx`     | Mode-specific schema; payload split in onSubmit; conditional field; history component                     |
| `features/agents/index.ts`                      | Replace barrel export with explicit `export type { ... }`; add new exports                                |
| `app/dashboard/agents/profiles/[id]/layout.tsx` | Add Tools tab                                                                                             |
| `shared/lib/routes.ts`                          | Add `AGENT_PROFILE_TOOLS` constant                                                                        |

---

## Edge Cases and Constraints

1. **`allowed_tools` create still works** — split types ensure create sends the
   field; only edit strips it.

2. **`version` = 0 or 1 with no history** — the `prompt-versions` endpoint
   returns an empty array if `system_prompt` was never changed via PATCH. Show
   empty state: "No previous versions — history is created when you save a new
   prompt."

3. **Null `allowed_tools` on profile** — `GET {id}/tools` returns ALL system
   tools. The empty state message should reference this: "All system tools are
   available (no restriction set)."

4. **`getAgentProfileTools` with null/empty `allowed_tools`** — the backend
   returns a potentially large list. The collapsible `<details>` for parameters
   keeps the page scannable. No virtualization needed for typical tool counts.

5. **Restore does not close the form** — after successful restore, the form
   resets with the restored prompt (via `form.reset()`), `isDirty` becomes
   `false`, and the History button re-enables. The user sees the restored prompt
   in the textarea and must press Save to commit it to the backend. This is
   intentional — giving the user a chance to review before committing.

6. **`httpClientAction` on 403** — the helper returns `parsed.message` which
   could expose backend authorization detail. If `result.error` comes back on a
   restore action, show `toast.error(result.error)` — the current
   `httpClientAction` behavior is acceptable here since the message is "You do
   not have permission" not internal stack traces.

7. **Backend `array_filter` quirk** — `getUpdateData()` on the backend uses
   `array_filter(..., fn => value !== null)`, meaning sending `null` for a
   nullable field drops it from the update. This means nullable fields in
   `AgentProfileUpdatePayload` cannot be explicitly cleared via PATCH with the
   current backend. This is a backend limitation, not something to fix on the
   frontend.

8. **`AgentPromptVersionHistory` lazy fetch vs eager** — versions are fetched
   lazily (on first modal open) not server-side. This is correct because: (a)
   the overview page already does 2 parallel fetches (profile + tasks meta); (b)
   version history is rarely needed; (c) the modal is a dedicated interaction.
   Caching it server-side would require either a new route segment or polluting
   the overview page data fetch.

---

## References

- Backend commit: `04fbd90 feat/agents` (2026-05-22)
- Backend files changed:
  - `app/Http/Controllers/API/v1/AgentProfileController.php` (+82 lines —
    `promptVersions`, `restorePromptVersion`)
  - `app/Http/Controllers/API/v1/AgentToolController.php` (+39 lines —
    `profileIndex`)
  - `app/Http/Requests/API/v1/AgentProfileRequest.php` (`allowed_tools` →
    `['prohibited']`)
  - `app/Http/Resources/API/v1/AgentProfilePromptVersionResource.php` (new)
  - `app/Http/Resources/API/v1/AgentProfileResource.php` (`version` field added)
  - `app/Models/AgentProfilePromptVersion.php` (new model,
    `$timestamps = false`)
  - Migration for `agent_profile_prompt_versions` table
- Related plan:
  `docs/plans/2026-05-22-refactor-agents-profiles-audit-and-fix-plan.md`
- Key source files:
  - `features/agents/api/agent-profiles.ts` — server actions
  - `features/agents/ui/agent-profile-form.tsx` — form (lines 36, 170–183,
    306–319)
  - `features/agents/model/schemas.ts` — Zod schemas (lines 20–43)
  - `features/agents/model/types.ts` — TypeScript interfaces
  - `app/dashboard/agents/profiles/[id]/layout.tsx` — tab nav (lines 68–73)
  - `app/dashboard/agents/profiles/[id]/memories/page.tsx` — Suspense pattern
    reference
  - `shared/lib/routes.ts` — route constants
  - `shared/lib/httpClient.ts` — `httpClientAction` helper
