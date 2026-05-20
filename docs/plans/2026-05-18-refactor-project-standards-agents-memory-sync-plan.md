---
title: 'refactor: Project Standards, Agents & Memory Sync'
type: refactor
status: completed
date: 2026-05-18
deepened: 2026-05-18
---

# refactor: Project Standards, Agents & Memory Sync

## Enhancement Summary

**Deepened on:** 2026-05-18 **Research agents used:** 10 parallel agents
(architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer,
security-sentinel, pattern-recognition-specialist, best-practices-researcher,
git-history-analyzer, feasibility-reviewer, scope-guardian-reviewer,
solutions-learning-check)

### Key Improvements Over Original Plan

1. **`task_summary` is NOT a simple rename** — git history confirms it was a
   frontend invention never backed by the backend. `methodology_criteria` was
   deliberately removed from the frontend (PR #92, 2026-05-07). This is a **full
   replacement**: the data shapes are architecturally different (stat counters
   vs `blocks: Block[]` polymorphic structure).

2. **Two additional type mismatches discovered** — `ChartType` has `'area'`
   (frontend-only) instead of `'pie'` (backend enum value); `PeopleListArtifact`
   missing `profile_id` field and `user_id` is non-nullable when backend allows
   null.

3. **Phase 3 removed entirely** — three reviewers independently flagged all
   speculative TypeScript types as YAGNI. The plan's own prose already forbids
   speculative typing.

4. **`backend-sync` skill removed** — the 9-step checklist is word-for-word
   identical to CLAUDE.md's "Adding a new API feature" section. Creating a third
   copy would fragment the source of truth. Use `wanda-backend-navigator`.

5. **`artifact-sync` agent itself is stale** — its mapping table lists only 6
   types (omits `decision_log`), and its workflow incorrectly references
   `features/chat/ui/artifact-panel.tsx` as the dispatch location (dispatch is
   now in `entities/artifact/ui/artifact-card.tsx`).

6. **Raw `fetch` violation in `entities/artifact/api/artifacts.ts`** — uses
   `getAuthHeaders` + raw `fetch` instead of `httpClient`. This is the
   foundational API file for the entire artifact domain.

7. **Security findings outside original scope** — three issues found that are
   independent of this refactor but warrant immediate attention (see Security
   Addendum).

8. **`ArtifactType` derivation pattern** — derive `ArtifactType` from
   `Artifact['type']` rather than maintaining it manually; eliminates the drift
   vector entirely.

9. **`@typescript-eslint/switch-exhaustiveness-check`** — enabling this ESLint
   rule would have caught the original mismatch at build time.

---

## Overview

Audit of the current project state (2026-05-18) revealed a dead artifact
renderer, stale memory entries pointing to deleted features, a convention
conflict that could cause code review failures, and several type mismatches
across the artifact domain. This plan tracks the work needed to bring the
project tooling, memory, and type contracts into a consistent, reliable state.

**Scope discipline:** This is a cleanup PR. It fixes proven bugs and removes
false state. No new features, no speculative types, no new skills that duplicate
existing documentation.

---

## Problems Found

### 🔴 Critical — Artifact Domain Type Mismatches

#### 1. `task_summary` is a frontend invention — `methodology_criteria` needs a full replacement

**Git history (commit `ff0be04`, 2026-04-30):** `task_summary` was added to the
frontend without updating the backend. The planning document for that commit
explicitly recommended Option A (reuse `chart` type) but the implementation
chose Option B without following through. The backend PHP enum has never
contained `task_summary`.

**Simultaneously (`cda7d2d`, 2026-05-07):** `methodology_criteria` was
deliberately removed from the frontend during the methodology feature deletion
(PR #92). The backend still has `ArtifactType::MethodologyCriteria` and the AI
agent still creates these artifacts.

**Current state:**

- `methodology_criteria` → backend emits it, frontend has no renderer → **silent
  rendering failure**
- `task_summary` → frontend has a renderer, backend never emits it → **dead
  code**

**This is NOT a rename.** The data shapes are architecturally different:

```typescript
// Current (wrong) — TaskSummaryArtifact.data
{
  total: number;
  in_progress: number;
  completed: number;
  overdue: number;
  delta_week: number;
  delta_today: number | null;
  period_label: string | null;
}

// Required — MethodologyCriteriaArtifact.data (from ArtifactSchema.php)
{
  blocks: MethodologyCriteriaBlock[];
}

// Where MethodologyCriteriaBlock is a discriminated union:
type MethodologyCriteriaBlock =
  | { type: 'header'; text: string }
  | { type: 'scoring_table'; columns: string[]; rows: (string | number)[][] }
  | { type: 'progress_summary'; items: { label: string; value: number; max: number | null }[] }
  | { type: 'scale'; title: string; items: { score: number; label: string }[] }
  | { type: 'text_list'; title: string; items: string[] };
```

**Files to replace (not rename):**

| File                                             | Action                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `entities/artifact/model/types.ts`               | Replace `TaskSummaryArtifact` with `MethodologyCriteriaArtifact`       |
| `entities/artifact/ui/task-summary-artifact.tsx` | Delete; write `methodology-criteria-artifact.tsx`                      |
| `entities/artifact/ui/artifact-card.tsx`         | Replace `task_summary` entries in `TYPE_META` and `ARTIFACT_RENDERERS` |
| `entities/artifact/index.ts`                     | Replace `TaskSummaryArtifact`/`TaskSummaryArtifactView` exports        |

#### 2. `ChartType` has `'area'` — backend has `'pie'`

**Location:** `entities/artifact/model/types.ts:71`

```typescript
// Current (wrong)
export type ChartType = 'bar' | 'line' | 'area';

// Required (from ArtifactSchema.php dataDescription)
export type ChartType = 'bar' | 'line' | 'pie';
```

`'area'` is a frontend invention; `'pie'` is a backend enum value. Charts
rendered as `pie` silently fall through to the `bar` renderer. The chart
renderer at `entities/artifact/ui/chart-artifact.tsx` must add a `PieChart`
branch and remove the dead `area` branch.

#### 3. `PeopleListArtifact` missing `profile_id`, `user_id` wrong nullability

**Location:** `entities/artifact/model/types.ts:49-58`

```typescript
// Current (wrong)
members: {
  name: string;
  role: string;
  user_id: number;
}
[];

// Required (from ArtifactSchema.php)
members: {
  name: string;
  role: string | null;
  profile_id: number | null;
  user_id: number | null;
}
[];
```

`user_id` is used as a React `key` prop in `people-list.tsx`. When the backend
sends `null` (which is allowed), the key becomes `key={null}` — a silent React
degradation. `profile_id` is missing entirely.

#### 4. Raw `fetch` violation in `entities/artifact/api/artifacts.ts`

This file uses `getAuthHeaders()` and raw `fetch` instead of `httpClient`. This
violates API Layer Rule 2 (CLAUDE.md) and introduces the exact HTML-response
JSON-parse failure class documented in
`docs/solutions/integration-issues/server-action-html-response-json-parse.md`.
Migrate to `httpClient`/`httpClientList` as part of this cleanup.

---

### 🔴 Critical — Stale Memory Entries

#### 5. MEMORY.md references two deleted features

Git history confirms both features were created and then deleted:

- `features/main-dashboard/` — lived 2026-03-25 to 2026-04-22, then deleted in
  commit `177a99b`. The MEMORY.md entry still references it as current.
- `features/debug-logs/` — lived 2026-03-23 to 2026-04-13, then deleted in
  commit `90c983a`. The MEMORY.md entry still references it as current.

Neither route constant exists in `shared/lib/routes.ts`. Remove both entries.

#### 6. MEMORY.md artifact type list is triply wrong

The MEMORY.md index states: "7 types: task_table, meeting_card, people_list,
insight_card, chart, transcript_view, methodology_criteria". The actual
`entities/artifact/model/types.ts` has 8 types, and `methodology_criteria` has
been replaced by `task_summary` (which is itself wrong). Three-way split:
backend → code → memory are all different.

Update after the artifact fix to read: "8 types: task_table, meeting_card,
people_list, insight_card, chart, transcript_view, decision_log,
methodology_criteria — source of truth: `entities/artifact/model/types.ts`."

#### 7. MEMORY.md ROUTES section references non-existent constants

`ROUTES.DASHBOARD` stale entries in memory: `DEBUG_LOGS`, `MAIN`,
`AGENT_TASKS_NEW`, `TELEGRAM_CHATS` — none of these exist in
`shared/lib/routes.ts`. Remove or correct.

---

### 🔴 Critical — `artifact-sync` Agent is Stale

The `artifact-sync` agent (`.claude/agents/artifact-sync.md`) has two stale
entries that will cause it to make wrong decisions:

1. **Wrong dispatch location:** its workflow reads
   `features/chat/ui/artifact-panel.tsx` as "type dispatch / routing" — but
   dispatch now lives in `entities/artifact/ui/artifact-card.tsx`. The agent
   following its own instructions would audit the wrong file.

2. **Wrong type count in description:** agent description says "all 7 artifact
   types" — actual count is 8 (after fix: `task_table`, `meeting_card`,
   `people_list`, `insight_card`, `chart`, `transcript_view`, `decision_log`,
   `methodology_criteria`). The agent's file listing also omits
   `decision-log.tsx`.

Update `artifact-sync.md`: fix the dispatch file path, fix the type count and
listing, add `decision-log.tsx` to the renderer inventory.

---

### 🟡 Warning — Convention Conflict in Memory

#### 8. `reporting-convention.md` "Code Style" section contradicts CLAUDE.md

The memory file at `~/.claude/projects/.../memory/reporting-convention.md`
(lines 12–19) instructs writing "maximally documented code" with comments on
every block, function, and type, and explicitly says "generate more code" as a
productivity metric.

This directly contradicts CLAUDE.md: "Default to writing no comments. Only add
one when the WHY is non-obvious."

Evidence that this conflict causes real problems: `artifact-card.tsx` already
contains JSDoc on simple components (`ArtifactContent`, `ArtifactCard`) as a
result of this convention, and `mr-reviewer.md` line 332 references a
`jsdoc/require-jsdoc` ESLint rule that does not exist in `eslint.config.mjs` — a
phantom rule caused by the memory convention bleeding into agent knowledge.

**Fix:** Remove only the "Code Style" section (lines 12–19) from
`reporting-convention.md`. Keep changelog format, line-counting, and tone
sections — those are genuinely local and do not affect code output.

Additionally: remove the phantom JSDoc stubs from `artifact-card.tsx` lines
110–115 (`ArtifactContent` JSDoc) and lines 133–136 (`ArtifactCard` JSDoc) as
part of the cleanup.

---

## Acceptance Criteria

### Phase 1 — Artifact Domain (do first — highest impact)

- [ ] **Read `ArtifactSchema.php`** via `wanda-backend-navigator` to get the
      exact `methodology_criteria` block structure before writing any TypeScript
- [ ] **Delete** `entities/artifact/ui/task-summary-artifact.tsx`
- [ ] **Write** `entities/artifact/ui/methodology-criteria-artifact.tsx` with a
      block dispatcher for all 5 block types (header, scoring_table,
      progress_summary, scale, text_list)
- [ ] **Replace** `TaskSummaryArtifact` with `MethodologyCriteriaArtifact` in
      `entities/artifact/model/types.ts`
- [ ] **Derive** `ArtifactType` from the union:
      `export type ArtifactType = Artifact['type']` (eliminates the separate
      manually-maintained union)
- [ ] **Fix** `ChartType`: `'area'` → `'pie'`; update `chart-artifact.tsx` to
      render `PieChart` and remove dead `area` branch
- [ ] **Fix** `PeopleListArtifact`: add `profile_id: number | null`, make
      `user_id: number | null`, make `role: string | null`; update
      `people-list.tsx` key prop fallback
- [ ] **Update** `artifact-card.tsx` `TYPE_META` and `ARTIFACT_RENDERERS`:
      replace `task_summary` entries with `methodology_criteria`
- [ ] **Update** `entities/artifact/index.ts`: replace stale exports
- [ ] **Migrate** `entities/artifact/api/artifacts.ts` from raw `fetch` to
      `httpClient`
- [ ] **Run** `backend-contract-validator` on `entities/artifact/` → zero
      mismatches
- [ ] **Run** `npm run lint` → zero new errors
- [ ] **Run** `npm test` → no regressions

### Phase 2 — Memory and Agent Cleanup

- [ ] **Update** MEMORY.md: remove `features/main-dashboard/` and
      `features/debug-logs/` entries (confirmed deleted in git history)
- [ ] **Update** MEMORY.md: fix artifact type section — correct list of 8 types,
      add "source of truth: `entities/artifact/model/types.ts`"
- [ ] **Update** MEMORY.md: remove stale route constants (`DEBUG_LOGS`, `MAIN`,
      `AGENT_TASKS_NEW`, `TELEGRAM_CHATS`)
- [ ] **Edit** `reporting-convention.md`: remove the "Code Style" section (lines
      12–19) that prescribes verbose comments
- [ ] **Update** `.claude/agents/artifact-sync.md`: - Fix dispatch location:
      `artifact-card.tsx` in `entities/artifact/ui/` - Fix description: "all 8
      artifact types" - Add `decision-log.tsx` to the renderer file listing

### Phase 3 — ESLint Hardening (optional but high-value)

- [ ] **Add** `'@typescript-eslint/switch-exhaustiveness-check': 'error'` to
      `eslint.config.mjs` — catches future discriminated union drift at lint
      time
- [ ] **Decide on JSDoc** — either add `jsdoc/require-jsdoc` to ESLint config
      (make it real) or remove all existing JSDoc stubs from `artifact-card.tsx`
      (lines 110–115, 133–136) and remove the phantom rule from `mr-reviewer.md`
      line 332 and `frontend-architect` agent memory

---

## Implementation Notes

### Methodology Criteria renderer structure

The backend schema (from `ArtifactSchema.php`) defines exactly this data shape:

```typescript
export interface MethodologyCriteriaArtifact extends ArtifactBase {
  type: 'methodology_criteria';
  data: {
    blocks: MethodologyCriteriaBlock[];
  };
}

export type MethodologyCriteriaBlock =
  | { type: 'header'; text: string }
  | {
      type: 'scoring_table';
      columns: string[];
      rows: (string | number)[][];
    }
  | {
      type: 'progress_summary';
      items: { label: string; value: number; max: number | null }[];
    }
  | { type: 'scale'; title: string; items: { score: number; label: string }[] }
  | { type: 'text_list'; title: string; items: string[] };
```

The renderer needs a switch over `block.type` for all 5 variants. Use
`assertNever` in the default branch for exhaustiveness.

### `ArtifactType` derivation — eliminates drift

```typescript
// Instead of maintaining ArtifactType manually (current — drifts):
export type ArtifactType =
  | 'task_table'
  | 'methodology_criteria'
  | ...;

// Derive from the union (correct — can never drift):
export type Artifact =
  | TaskTableArtifact
  | MeetingCardArtifact
  | ...
  | MethodologyCriteriaArtifact;

export type ArtifactType = Artifact['type'];
```

When a new interface is added to `Artifact`, `ArtifactType` updates
automatically. Any missing renderer in `TYPE_META` (typed as
`Record<ArtifactType, ...>`) becomes a compile error immediately.

### ARTIFACT_RENDERERS exhaustiveness

Change the renderer map type from optional to required to get compile errors on
missing entries:

```typescript
// Current (optional — misses drift):
const ARTIFACT_RENDERERS: {
  [K in ArtifactType]?: (artifact: Extract<Artifact, { type: K }>) => React.ReactNode;
} = { ... };

// Better (required — compile error on missing variant):
const ARTIFACT_RENDERERS: {
  [K in ArtifactType]: (artifact: Extract<Artifact, { type: K }>) => React.ReactNode;
} = { ... };
```

### `entities/artifact/api/artifacts.ts` migration

```typescript
// Before (wrong — violates Rule 2)
const authHeaders = await getAuthHeaders();
const res = await fetch(`${API_URL}/...`, { headers: authHeaders });

// After (correct)
import { httpClient } from '@/shared/lib/httpClient';
const { data } = await httpClient<ArtifactsResponse>(`${API_URL}/...`);
```

### PeopleList key prop fix

```typescript
// Before (wrong — key={null} when user_id is null)
{members.map((m) => <div key={m.user_id}>...)}

// After (stable fallback)
{members.map((m) => <div key={m.user_id ?? m.profile_id ?? m.name}>...)}
```

### PHP → TypeScript mapping table (complete, including missing edge cases)

| PHP                         | TypeScript                                      |
| --------------------------- | ----------------------------------------------- |
| `int` / `integer`           | `number`                                        |
| `float` / `double`          | `number`                                        |
| `?int`                      | `number \| null`                                |
| `string`                    | `string`                                        |
| `?string`                   | `string \| null`                                |
| `bool`                      | `boolean`                                       |
| `Carbon` / timestamp        | `string` (ISO 8601)                             |
| `?Carbon`                   | `string \| null`                                |
| `array` (indexed)           | `T[]`                                           |
| `Collection<T>`             | `T[]`                                           |
| `array` (assoc / toArray()) | `Record<string, unknown>` or specific interface |
| Backed enum                 | string union: `'value1' \| 'value2'`            |
| `?BackedEnum`               | `'value1' \| 'value2' \| null`                  |
| `mixed`                     | `unknown` (never `any`)                         |
| Untyped `array`             | inspect method body — could be either form      |

---

## Security Addendum — Issues Found Outside Plan Scope

These were discovered during the security audit and are independent of this
refactor. They require immediate attention but separate PRs.

### 🔴 High — SSRF via image remote patterns wildcard

**Location:** `next.config.ts:36`

`hostname: '**'` in `images.remotePatterns` allows the Next.js image proxy
(`/_next/image?url=...`) to make outgoing requests to any HTTPS host, including
internal cloud metadata endpoints. Restrict to specific domains used for avatars
and thumbnails.

### 🔴 High — No Content-Security-Policy header

**Location:** `next.config.ts` security headers section

The security headers configure `X-Frame-Options`, `X-Content-Type-Options`, etc.
but omit `Content-Security-Policy` entirely. Given that `HtmlContent` uses
DOMPurify (which has a history of bypasses), a CSP providing `script-src 'self'`
would prevent injected scripts from loading external payloads even if DOMPurify
is bypassed.

### 🟡 Medium — DOMPurify missing `FORBID_TAGS` for form injection

**Location:** `features/chat/ui/chat-message-content.tsx:127`

Default DOMPurify strips `<script>` but permits `<form>`, `<input>`, `<button>`.
AI-generated HTML artifacts could include form injection. Add:
`FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'style', 'meta']`

### 🟡 Medium — `SendMessageSchema` missing `.max()` on `content`

**Location:** `features/chat/model/schemas.ts:12`

Only validates `.min(1)` — no upper bound. Check `StoreMessageRequest.php` for
the backend's `max:` rule and mirror it in the Zod schema.

---

## Future Prevention (not in scope of this PR)

The research identified tooling that would catch future artifact type drift
automatically. Document here for future consideration:

### `@typescript-eslint/switch-exhaustiveness-check`

Add to `eslint.config.mjs` (Phase 3 above). Catches any `switch` over a
discriminated union with missing cases. Would have caught the `task_summary`
mismatch at lint time.

### `spatie/laravel-typescript-transformer` (backend)

Install in the backend, annotate PHP backed enums and Resource classes with
`#[TypeScript]`, run `php artisan typescript:transform && git diff --exit-code`
in backend CI. Generated TypeScript is committed; frontend CI runs
`tsc --noEmit` against it. Breaking enum changes become compile errors.
([spatie/laravel-typescript-transformer](https://github.com/spatie/laravel-typescript-transformer))

### Compile-time contract test for `ArtifactType`

Add to `entities/artifact/__tests__/artifact-type-contract.test.ts`:

```typescript
const BACKEND_ARTIFACT_TYPES = [
  'task_table',
  'meeting_card',
  'people_list',
  'insight_card',
  'chart',
  'transcript_view',
  'decision_log',
  'methodology_criteria',
] as const satisfies ArtifactType[];

// Type-level assertion: both sets must be identical
type _ExhaustiveCheck =
  (typeof BACKEND_ARTIFACT_TYPES)[number] extends ArtifactType
    ? ArtifactType extends (typeof BACKEND_ARTIFACT_TYPES)[number]
      ? true
      : never
    : never;
const _: _ExhaustiveCheck = true;
```

This fails `tsc --noEmit` if either the backend snapshot or the frontend union
gains a member the other does not have.

---

## References

### Internal — Files to Modify

- `entities/artifact/model/types.ts` — primary type fix
- `entities/artifact/ui/artifact-card.tsx` — renderer map and TYPE_META
- `entities/artifact/ui/task-summary-artifact.tsx` — delete
- `entities/artifact/ui/chart-artifact.tsx` — add pie, remove area
- `entities/artifact/ui/people-list.tsx` — fix key prop and null handling
- `entities/artifact/api/artifacts.ts` — migrate to httpClient
- `entities/artifact/index.ts` — update exports
- `.claude/agents/artifact-sync.md` — fix stale dispatch location and type count
- `~/.claude/projects/.../memory/MEMORY.md` — remove stale entries
- `~/.claude/projects/.../memory/reporting-convention.md` — remove Code Style
  section

### Internal — Ground Truth (read-only)

- `/Users/slavapopov/Documents/WandaAsk_backend/app/Enums/ArtifactType.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Services/Artifact/ArtifactSchema.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Services/Agent/Tools/CreateArtifactTool.php`

### External — Research Sources

- [spatie/laravel-typescript-transformer](https://github.com/spatie/laravel-typescript-transformer)
  — auto-generate TS from PHP enums
- [@typescript-eslint/switch-exhaustiveness-check](https://typescript-eslint.io/rules/switch-exhaustiveness-check/)
  — ESLint rule for union exhaustiveness
- [Laravel Wayfinder](https://laravel.com/blog/laravel-wayfinder-end-to-end-type-safety-for-php-and-typescript)
  — official Laravel cross-repo type sync (monitor for stable release)
- [Scramble — Laravel OpenAPI Generator](https://scramble.dedoc.co/) —
  auto-generate OpenAPI spec from Laravel
