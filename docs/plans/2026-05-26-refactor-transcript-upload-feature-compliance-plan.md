---
title: refactor: Bring transcript-upload feature into full project compliance
type: refactor
status: active
date: 2026-05-26
---

# refactor: Bring transcript-upload feature into full project compliance

## Overview

The `features/transcript-upload/` feature was built with several violations of
project conventions: all UI text is in Russian, it has FSD cross-feature import
violations (modal imports Server Actions from `features/meetings` and
`features/teams`), a `PropsWithChildren` ESLint error, props extraction
warnings, and excess WHAT-comments. This plan covers all required changes.

> **Technical review applied (2026-05-26):** Three reviewers (DHH lens, Kieran
> TypeScript, Simplicity) reviewed the original draft. Key revisions:
>
> - Phase 2 now uses entity-layer re-export approach (not RSC eager-prefetch) to
>   preserve lazy-on-open behavior
> - Phase 5 (complexity reduction) dropped — `max-statements` warnings don't
>   justify added indirection
> - Phase 4 (comment cleanup) merged into Phase 3 as a note
> - `CalendarEventListItem` migration: move definition to `entities/event/`,
>   re-export from `features/meetings/model/types.ts` (not the reverse —
>   `entities` must not re-export from `features`)

## Problem Statement

| Violation category                         | Severity                      | Count         |
| ------------------------------------------ | ----------------------------- | ------------- |
| Russian UI text in JSX/validation messages | **Critical** (CLAUDE.md rule) | 30+ strings   |
| FSD cross-feature imports in modal         | **Error** (architecture rule) | 3 imports     |
| `prefer-props-with-children` ESLint error  | **Error** (ESLint)            | 1 interface   |
| `props-extraction-threshold` warnings      | Warning (ESLint)              | 3 components  |
| WHAT-comments                              | Style (CLAUDE.md)             | ~8 blocks     |
| `ru-RU` locale in `toLocaleString`         | Warning (CLAUDE.md rule)      | 2 occurrences |

_Note: `max-statements` / `complexity` warnings in `upload-transcript.ts` are
intentionally excluded — the function is already clear; extracting a
one-call-site helper would add indirection without value._

---

## Phase 1 — English-only UI text (mechanical, low risk)

Translate every user-visible string. This covers JSX labels, Zod validation
messages, toast strings, aria-labels, and API fallback error messages.

### `features/transcript-upload/model/schema.ts`

Replace all Russian Zod validation messages and `ERROR_CODE_MESSAGES`:

```ts
// File schema messages
z.instanceof(File, { error: 'Select a transcript file' })
  .refine((f) => f.size > 0, { message: 'File is empty' })
  .refine((f) => f.size <= MAX_FILE_SIZE_BYTES, { message: 'File exceeds 5 MB' })

// Existing meeting schema
z.number({ error: 'Select a meeting' })

// New meeting schema
z.string({ error: 'Enter a meeting title' })
  .min(1, 'Enter a meeting title')
  .max(255, 'Title is too long')
z.string({ error: 'Enter a start time' }).min(1, 'Enter a start time')
z.string({ error: 'Enter an end time' }).min(1, 'Enter an end time')
// cross-field refine:
{ message: 'End time must not be before start time', path: ['ends_at'] }

// ERROR_CODE_MESSAGES
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  NO_SOURCE: 'Connect your calendar to upload transcripts.',
  TRANSCRIPT_PARSE_FAILED:
    'Could not parse the file. Check the format: JSON Recall, TXT, VTT, or SRT.',
  TOO_MANY_ENTRIES: `The transcript has too many entries (limit: ${MAX_ENTRIES.toLocaleString('en-US')}).`,
  UNSUPPORTED_FORMAT: 'File format is not supported.',
};
```

Also fix `ru-RU` locale on the `TOO_MANY_ENTRIES` line → `'en-US'`.

### `features/transcript-upload/api/upload-transcript.ts`

Lines 54, 66:

```ts
return { data: null, error: 'Server returned an empty response' };
parseApiError(error.responseBody ?? '', 'Failed to upload transcript');
```

### `features/transcript-upload/ui/transcript-upload-button.tsx`

```tsx
Upload transcript   {/* was: Загрузить транскрипт */}
```

### `features/transcript-upload/ui/transcript-upload-modal.tsx`

| Location           | Russian                                              | English                                    |
| ------------------ | ---------------------------------------------------- | ------------------------------------------ |
| Line 80 (error)    | `'Не удалось загрузить данные. Попробуйте ещё раз.'` | `'Failed to load data. Please try again.'` |
| Line 95 (title)    | `'Загрузить транскрипт'`                             | `'Upload transcript'`                      |
| Line 100 (loading) | `Загрузка…`                                          | `Loading…`                                 |

### `features/transcript-upload/ui/transcript-upload-form.tsx`

| Location                       | Russian                                                       | English                                                             |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Line 132 (success toast)       | `'Транскрипт загружен. Саммари появится через 1-2 минуты.'`   | `'Transcript uploaded. Summary will appear in 1–2 minutes.'`        |
| Line 153 (toast error)         | `'Файл больше 5 МБ'`                                          | `'File exceeds 5 MB'`                                               |
| Line 163 (locale)              | `'ru-RU'`                                                     | remove / use `'en-US'`                                              |
| Line 178 (aria-label)          | `'Режим загрузки'`                                            | `'Upload mode'`                                                     |
| Line 190 (tab)                 | `К существующей встрече`                                      | `Attach to existing meeting`                                        |
| Line 207 (tab)                 | `Создать новую`                                               | `Create new meeting`                                                |
| Lines 196–198 (tooltip)        | `'Создайте команду, чтобы загружать транскрипты без встречи'` | `'Create a team to upload transcripts without an existing meeting'` |
| Line 222 (label)               | `Встреча`                                                     | `Meeting`                                                           |
| Line 231 (placeholder — empty) | `'У вас нет прошедших встреч'`                                | `'No past meetings'`                                                |
| Line 232 (placeholder)         | `'Выберите встречу'`                                          | `'Select a meeting'`                                                |
| Line 254 (label)               | `Название встречи`                                            | `Meeting title`                                                     |
| Line 262 (placeholder)         | `'Например: Tribes техсинк'`                                  | `'e.g. Tribes tech sync'`                                           |
| Line 275 (label)               | `Начало`                                                      | `Start`                                                             |
| Line 297 (label)               | `Окончание`                                                   | `End`                                                               |
| Line 318 (label)               | `Команда`                                                     | `Team`                                                              |
| Line 329 (placeholder)         | `'Выберите команду'`                                          | `'Select a team'`                                                   |
| Line 351 (label)               | `Файл транскрипта`                                            | `Transcript file`                                                   |
| Line 353 (hint)                | `JSON, TXT, VTT или SRT · до 5 МБ`                            | `JSON, TXT, VTT, or SRT · up to 5 MB`                               |
| Line 368 (size unit)           | `КБ`                                                          | `KB`                                                                |
| Line 387 (button)              | `Отмена`                                                      | `Cancel`                                                            |
| Line 390 (submit)              | `'Загрузка…' / 'Загрузить'`                                   | `'Uploading…' / 'Upload'`                                           |

### `features/transcript-upload/ui/__tests__/transcript-upload-form.test.tsx`

Update all `getByText`, `findByText`, `toHaveBeenCalledWith` assertions to match
the new English strings. Affected lines: 83, 87, 91, 103, 118–123, 141, 175–177,
181, 216.

---

## Phase 2 — Fix FSD cross-feature imports (keep lazy-fetch behavior)

**Why the original RSC-wrapper approach was rejected:** Pre-fetching meetings +
teams at page load time would mean every visitor to the meetings list page pays
for two extra API calls even if they never open the upload modal. The current
lazy-on-first-open behavior is a deliberate performance decision and must be
preserved.

**Correct fix:** Move the shared fetch logic into the `entities/` layer so
`features/transcript-upload` can import it without touching another feature.

### Step 2a — Promote `CalendarEventListItem` to `entities/event/`

`CalendarEventListItem` is currently only defined in
`features/meetings/model/types.ts`. It is a domain entity (a calendar event)
that belongs in `entities/event/`.

1. Add `CalendarEventListItem` to `entities/event/model/types.ts` (move the
   definition there).
2. In `features/meetings/model/types.ts`, replace the definition with a
   re-export:
   ```ts
   export type { CalendarEventListItem } from '@/entities/event';
   ```
   This is zero-breaking for all 11 existing usages inside `features/meetings/`
   since TypeScript re-exports are structurally equivalent.
3. Update `entities/event/index.ts` to export `CalendarEventListItem` in its
   public API.

> **Critical direction rule:** `entities/` must NOT re-export from `features/`.
> The definition goes in `entities/event/`, and `features/meetings` re-exports
> from there — never the reverse.

### Step 2b — Move `getMeetingsList` (transcript variant) to `entities/event/api/`

Create `entities/event/api/calendar-events-picker.ts`:

```ts
'use server';

import { httpClientList } from '@/shared/lib/httpClient';
import { API_URL } from '@/shared/lib/config';
import type { CalendarEventListItem } from '@/entities/event/model/types';

/**
 * Fetches past meetings for picker UIs (e.g. transcript upload modal).
 * Backend caps limit at 50.
 */
export async function getPastMeetingsForPicker(limit = 50) {
  return httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events?scope=past&limit=${limit}`,
  );
}
```

> Verify the actual query string params against
> `features/meetings/api/meetings.ts` — the current call passes `scope: 'past'`,
> `team_id: null`, `user_id: null`, `offset: 0`, `limit: 50`. Match those
> exactly.

### Step 2c — Move `getTeams` (for picker) to `entities/team/api/`

`entities/team/` already exists. Check if `entities/team/api/` exists; if not,
create `entities/team/api/teams.ts`:

```ts
'use server';

import { httpClientList } from '@/shared/lib/httpClient';
import { API_URL } from '@/shared/lib/config';
import type { TeamProps } from '@/entities/team';

export async function getTeamsByOrg(organizationId: string) {
  return httpClientList<TeamProps>(
    `${API_URL}/organizations/${organizationId}/teams`,
  );
}
```

> Verify this matches the actual endpoint used in `features/teams/api/team.ts`.
> Do not duplicate the full CRUD — only the picker-specific fetch.

### Step 2d — Update `transcript-upload-modal.tsx`

Replace cross-feature imports:

```ts
// ❌ Remove
import { getMeetingsList } from '@/features/meetings/api/meetings';
import { getTeams } from '@/features/teams/api/team';
import type { CalendarEventListItem } from '@/features/meetings/model/types';

// ✅ Add
import { getPastMeetingsForPicker } from '@/entities/event/api/calendar-events-picker';
import { getTeamsByOrg } from '@/entities/team/api/teams';
import type { CalendarEventListItem } from '@/entities/event';
```

Update the `useEffect` to use these new imports. Preserve the `organizationId`
null guard:

```ts
organizationId
  ? getTeamsByOrg(organizationId)
  : Promise.resolve({ data: [] as TeamProps[], totalCount: 0, hasMore: false });
```

### Step 2e — Update `transcript-upload-form.tsx`

```ts
// ❌ Remove
import type { CalendarEventListItem } from '@/features/meetings/model/types';

// ✅ Add
import type { CalendarEventListItem } from '@/entities/event';
```

---

## Phase 3 — ESLint violations + comment cleanup

### `prefer-props-with-children` — `ModeTabButtonProps` (form.tsx:397)

```tsx
// ❌ BEFORE
interface ModeTabButtonProps {
  isActive: boolean;
  disabled?: boolean;
  tooltip?: string;
  onActivate: () => void;
  onArrow: () => void;
  children: React.ReactNode;   // ← violation
}

// ✅ AFTER
import { type PropsWithChildren } from 'react';  // add to existing react import line

interface ModeTabButtonProps {
  isActive: boolean;
  disabled?: boolean;
  tooltip?: string;
  onActivate: () => void;
  onArrow: () => void;
}

function ModeTabButton({
  isActive,
  disabled,
  tooltip,
  onActivate,
  onArrow,
  children,
}: PropsWithChildren<ModeTabButtonProps>) {
```

Add `PropsWithChildren` to the **existing**
`import { useMemo, useState, useTransition } from 'react'` line — do not add a
second React import.

### `props-extraction-threshold` — inline ≤3 props

**`transcript-upload-button.tsx`** (1 prop → inline):

```tsx
export function TranscriptUploadButton({ organizationId }: { organizationId: string | null }) {
```

Remove the `interface Props` block.

**`transcript-upload-form.tsx`** (3 props → inline):

```tsx
export function TranscriptUploadForm({
  meetings,
  teams,
  onClose,
}: {
  meetings: CalendarEventListItem[];
  teams: TeamProps[];
  onClose: () => void;
}) {
```

Remove the `interface Props` block.

**`transcript-upload-modal.tsx`** — after Phase 2, props are `isOpen`,
`onClose`, `meetings`, `teams` (4 props) → keep as named `interface Props` (>3,
extraction is correct).

### `unicorn/no-useless-undefined` — form.tsx line 148

```tsx
// ❌ BEFORE
onChange(undefined);

// ✅ AFTER — RHF's onChange is (...event: unknown[]) => void, safe to call without arg
onChange();
```

### Comment cleanup (merged from original Phase 4)

Remove these WHAT-comments:

**`upload-transcript.ts`**:

- Lines 17–19: Remove opening sentence of JSDoc ("Upload a transcript file...").
  Keep the error codes block (lines 23–28) — it's non-obvious WHY context.
- Line 57: Remove
  `// Invalidate cached list views so new/updated meeting is reflected.`

**`transcript-upload-form.tsx`**:

- Line 52: Shorten to just
  `// Computed once so re-renders don't reset user's input.`
- Line 108: Remove `// Distribute Laravel-style field errors when present.`
- Lines 175, 213, 244, 340: Remove JSX section label comments
  (`{/* Mode tabs */}`, etc.)

**`transcript-upload-button.tsx`**:

- Lines 15–21: Remove component-level JSDoc entirely.

---

## Acceptance Criteria

### Phase 1 — English text

- [ ] Zero Cyrillic characters in any `.tsx` or `.ts` file under
      `features/transcript-upload/` (code comments excepted)
- [ ] All Zod validation messages in English
- [ ] `ERROR_CODE_MESSAGES` values in English
- [ ] API error fallback strings in English
- [ ] `toLocaleString` calls use `'en-US'` (not `'ru-RU'`)
- [ ] Test assertions updated to match new English strings; all tests pass

### Phase 2 — FSD compliance

- [ ] `transcript-upload-modal.tsx` imports zero symbols from
      `features/meetings` or `features/teams`
- [ ] `transcript-upload-form.tsx` imports `CalendarEventListItem` from
      `@/entities/event`
- [ ] `CalendarEventListItem` defined in `entities/event/model/types.ts`,
      re-exported from `features/meetings/model/types.ts`
- [ ] Lazy-on-first-open fetch behavior unchanged
- [ ] `organizationId` null guard preserved in modal `useEffect`
- [ ] `fsd-boundary-guard` agent reports zero violations in
      `features/transcript-upload/`

### Phase 3 — ESLint

- [ ] `npm run lint` on `features/transcript-upload/` files: zero errors, zero
      warnings
- [ ] `prefer-props-with-children` error resolved
- [ ] `props-extraction-threshold` warnings resolved (button: 1 prop inlined;
      form: 3 props inlined; modal: 4 props → named interface kept)
- [ ] `unicorn/no-useless-undefined` resolved

### Overall

- [ ] `npm test` — all tests pass
- [ ] `mr-reviewer` agent confirms no regressions

---

## Dependencies & Risks

| Risk                                                                                                   | Mitigation                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `getPastMeetingsForPicker` query params must exactly match current `getMeetingsList` call              | Before writing entity api, read `features/meetings/api/meetings.ts` to copy the exact query string params             |
| `getTeamsByOrg` endpoint — verify it matches what `features/teams/api/team.ts` calls for this use case | Read `features/teams/api/team.ts` before writing entity api; may be able to re-export rather than rewrite             |
| `entities/team/api/` may already exist with `getTeamsByOrg`                                            | Check before creating; if it exists, import from there directly                                                       |
| Test file assertions in Russian — easy to miss some                                                    | Run `grep -n '[А-Яа-я]' features/transcript-upload/ui/__tests__/` after Phase 1 to verify zero Cyrillic               |
| `CalendarEventListItem` has 11 import sites in `features/meetings/`                                    | All preserved via re-export from `features/meetings/model/types.ts`; no file other than the definition needs touching |

## References

### Internal files

- `features/transcript-upload/api/upload-transcript.ts`
- `features/transcript-upload/model/schema.ts`
- `features/transcript-upload/model/types.ts`
- `features/transcript-upload/ui/transcript-upload-button.tsx`
- `features/transcript-upload/ui/transcript-upload-modal.tsx`
- `features/transcript-upload/ui/transcript-upload-form.tsx`
- `features/transcript-upload/ui/__tests__/transcript-upload-form.test.tsx`
- `features/meetings/model/types.ts` — source of `CalendarEventListItem` (will
  become re-export)
- `features/meetings/api/meetings.ts` — reference for query params
- `features/teams/api/team.ts` — reference for teams endpoint
- `entities/event/model/types.ts` — target for `CalendarEventListItem`
  definition
- `entities/event/index.ts` — needs updated public export
- `entities/team/` — check for existing api/ before creating
- `todos/010-pending-p1-resolve-fsd-cross-feature-import-for-attach-calendar-button.md`
  — prior approved FSD fix pattern

### CLAUDE.md conventions applied

- "All UI text must be in English"
- FSD: `features/A` must NOT import from `features/B`
- `entities/` must NOT import from `features/`
- `props-extraction-threshold` and `prefer-props-with-children` ESLint rules
- "Default to writing no comments. Only add one when the WHY is non-obvious."
