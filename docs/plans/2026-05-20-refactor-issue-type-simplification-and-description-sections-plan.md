---
title: "refactor: Simplify Issue Types to Epic/Task and Embed Description Sections"
type: refactor
status: active
date: 2026-05-20
---

# refactor: Simplify Issue Types to Epic/Task and Embed Description Sections

## Overview

The issue form currently exposes `development`, `organization`, and `epic` as user-visible type choices, sourced from org-configured issue types. These backend identifiers (execution environments) are not meaningful to end-users. The spec decision: expose only **two types — Epic and Task**. The description field replaces the separate DoD checklist and becomes a structured document with embedded sections.

---

## Problem Statement

### 1. User-facing types are backend execution concepts

`development` (Paperclip) and `organization` (inline) are execution environment identifiers, not product concepts. Users should not choose between them — they choose "Task". The dispatch mechanism (inline vs Paperclip) is determined by the agent profile/dispatch action, not the creation-time type.

### 2. Separate DoD checklist has no backend backing

The `dod` checklist field was added to the frontend form but:
- `IssueResource` does **not** return a `dod` field
- `IssueRequest` does **not** validate or store a `dod` field
- The backend validation config (`config/issue_validation.php`) expects DoD **inside the description** as a `## Definition of Done` heading section
- The frontend checklist is currently silently discarded by the backend

### 3. Description lacks structure guidance

The backend validates that descriptions contain three section headings:
- **Context** — background and motivation
- **Steps** (Points/Items) — ordered action items
- **Definition of Done** — acceptance criteria (tasks only; epics omit DoD)

The current textarea has no placeholder, no template, and no indication these sections are required.

---

## Proposed Solution

### Type simplification
Replace the org-configured type dropdown with a **fixed 2-option toggle**:
- `Task` → sends `type: 'organization'` to backend (default; inline execution)
- `Epic` → sends `type: 'epic'` to backend

**Why `organization` as the default task type?** Paperclip dispatch (`type: 'development'`) is determined by the dispatch action, not at creation time. The `normalizeType()` mapping on the backend already handles existing `'task'` → `'organization'` conversion. Keeping `organization` as the default aligns with the backend's inline execution path.

### Description as structured document
Remove the standalone DoD checklist. The description field becomes a structured textarea pre-populated with a template based on issue type:

**Task template:**
```
## Context


## Steps


## Definition of Done

```

**Epic template:**
```
## Context


## Steps

```

### Epic/Task relationship
Keep existing behavior — no changes needed:
- Epic: shows child task selector (multi-select) and child task list
- Task: shows epic_id dropdown (link to parent epic)

---

## Technical Approach

### Frontend-only changes (no backend coordination needed)

The backend already:
- Accepts `type: 'organization'` and `type: 'epic'` ✅
- Validates description section headings (Context/Steps/DoD) ✅
- Returns the description as-is (no section parsing on read) ✅
- Does NOT store/return a separate `dod` field ✅

So this entire refactor is **frontend-only**.

### Type value mapping

```
User selects "Task"  →  type: 'organization'  (default, inline dispatch)
User selects "Epic"  →  type: 'epic'
```

The frontend `isEpic` check: `issue.type === 'epic'` — unchanged.

For reading existing issues:
- `type === 'epic'` → show as "Epic"
- `type === 'development'` OR `type === 'organization'` → show as "Task"

---

## Implementation Phases

### Phase 1 — Replace type dropdown with Epic/Task toggle in form

#### `features/issues/ui/issue-form.tsx`

**Remove:**
- `issueTypeOptionsFromOrgs` import and `typeOptions` variable
- The `InputDropdown` for type (lines ~349-370)
- The `organizations` prop usage for type options (still needed for org/team selectors)

**Add:** A 2-button segmented toggle matching the `IssueTypeToggle` visual style:

```tsx
// features/issues/ui/issue-form.tsx — replace type InputDropdown

const FORM_TYPE_OPTIONS = [
  { value: 'organization', label: 'Task' },
  { value: 'epic', label: 'Epic' },
] as const;

// In JSX — replace the type InputDropdown:
<div className='flex flex-col gap-1'>
  <span className='text-xs text-muted-foreground'>Type</span>
  <div className='flex rounded-[var(--radius-button)] bg-muted p-0.5 gap-0.5'>
    {FORM_TYPE_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type='button'
        onClick={() => handleTypeChange(opt.value)}
        className={[
          'flex-1 rounded-[var(--radius-button)] px-3 py-1 text-xs font-medium transition-all',
          typeValue === opt.value
            ? 'bg-card border border-white/8 text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

**`handleTypeChange` logic** (update existing `handleEpicType` or equivalent):
```ts
const handleTypeChange = useCallback((newType: string) => {
  const isNowEpic = newType === 'epic';
  const wasEpic = currentTypeValue === 'epic';

  setValue('type', newType);

  if (isNowEpic && !wasEpic) {
    // Switching TO epic: save and clear epic_id, show child task selector
    savedEpicIdRef.current = getValues('epic_id');
    setValue('epic_id', '');
  } else if (!isNowEpic && wasEpic) {
    // Switching FROM epic: restore epic_id
    setValue('epic_id', savedEpicIdRef.current ?? '');
  }
}, [currentTypeValue, getValues, setValue]);
```

**Reading existing issues — display value:**
```ts
// In defaultValues:
const resolvedType =
  issue?.type === 'epic' ? 'epic' : 'organization';
// Map development → organization for display
```

**`IssueFormValues.type`**: Keep as `string` (no change needed to DTO — we just constrain the UI values).

#### `features/issues/model/types.ts`

- Remove `issueTypeOptionsFromOrgs` function — it's no longer used in the form
- Keep `VALID_ISSUE_BACKEND_TYPES` in `entities/issue` (used for URL query building)
- Remove `dod` from `IssueUpsertDTO` (it was never accepted by the backend)
- Remove `dod?: DoDItem[] | null` from `Issue` interface (backend doesn't return it)

> **⚠️ Note on `dod` removal:** The `IssueDodProgress` component on the detail page reads `issue.dod`. Once removed from the type, that component becomes dead code — remove it too, or guard it with `issue.dod` being `undefined`. Since the backend never returned this field, the component was always rendering `null` in production. Safe to remove.

#### `entities/issue/model/types.ts` / `features/issues/ui/issue-dod-progress.tsx`

Remove `IssueDodProgress` component and its render site in `app/dashboard/issues/[id]/page.tsx` — it was based on a field the backend doesn't support.

### Phase 2 — Remove standalone DoD checklist, add structured description template

#### `features/issues/ui/issue-form.tsx`

**Remove:**
- `useFieldArray` for `dod`
- `dodRefs` ref
- `handleDodKeyDown` function
- The entire DoD checklist JSX section (lines ~498-555)
- `DoDItem` from `IssueFormValues`
- `dod` from `defaultValues`
- `dod: values.dod.filter(...)` from submit payload

**Modify description field:**

Add a template-based default value and placeholder. The description template is determined by `type`:

```ts
// In defaultValues computation:
const descriptionTemplate = (existingType: string) => {
  const isEpic = existingType === 'epic';
  if (issue?.description) return issue.description; // existing issue: don't overwrite
  return isEpic
    ? '## Context\n\n\n## Steps\n\n'
    : '## Context\n\n\n## Steps\n\n\n## Definition of Done\n\n';
};
```

When type changes in the form (new issue only), offer to reset description to the template. For **existing issues**, never auto-reset the description.

**Description textarea enhancement:**
- Increase `rows` to a comfortable height (e.g., `rows={12}`)
- Add `placeholder` text: `"## Context\n\nBackground and motivation...\n\n## Steps\n\n1. ...\n\n## Definition of Done\n\n- [ ] ..."`
- Keep as plain `InputTextarea` — no markdown renderer needed

#### `features/issues/model/types.ts`

Remove from `IssueFormValues`:
```ts
// Remove:
dod: DoDItem[];
```

Remove `DoDItem` from `IssueFormValues` (keep the type definition if still referenced elsewhere — but if `dod` is removed from `Issue` interface too, `DoDItem` can be fully removed).

### Phase 3 — Update filter toggle and URL mapping

#### `features/issues/model/build-issues-query.ts`

The `type='task'` → `exclude_type=epic` transform was added for the filter toggle. This **stays as-is** — the filter toggle uses `'task'` as a frontend sentinel (not a backend value), and the query builder correctly maps it.

No changes needed here.

#### `features/issues/ui/issue-type-toggle.tsx`

Already correct: `All` / `Epics` / `Tasks`. No changes needed.

#### `features/issues/model/types.ts` — `isIssueType`

Currently: `export function isIssueType(value: string): boolean { return value.length > 0; }` — this accepts any non-empty string. With only two real types, consider tightening. But since the URL filter uses `'task'` (sentinel), keep accepting any non-empty string.

### Phase 4 — Update `issueTypeOptionsFromOrgs` references

Search for all usages of `issueTypeOptionsFromOrgs` and `typeOptions`:

```bash
grep -r "issueTypeOptionsFromOrgs\|typeOptions" features/ app/ --include="*.tsx" --include="*.ts"
```

If used only in `issue-form.tsx`, remove from `features/issues/model/types.ts` and `features/issues/index.ts`.

If used elsewhere (e.g., filter bar), keep but note it won't be needed in the form.

### Phase 5 — Detail page cleanup

#### `app/dashboard/issues/[id]/page.tsx`

Remove:
```tsx
// Remove this block:
{issue.dod && issue.dod.length > 0 && (
  <Card>
    <CardBody>
      <IssueDodProgress dod={issue.dod} />
    </CardBody>
  </Card>
)}
```

Remove `IssueDodProgress` import.

#### `features/issues/ui/issue-dod-progress.tsx`

Delete this file — it renders a component based on a field the backend never returns.

---

## Acceptance Criteria

### Type simplification
- [ ] Form shows exactly two type options: "Task" and "Epic" (not org-configured labels)
- [ ] Selecting "Task" sends `type: 'organization'` to backend
- [ ] Selecting "Epic" sends `type: 'epic'` to backend
- [ ] Existing issues with `type: 'development'` render as "Task" in the form
- [ ] Existing issues with `type: 'organization'` render as "Task" in the form
- [ ] Existing issues with `type: 'epic'` render as "Epic" in the form
- [ ] Type toggle uses same visual style as `IssueTypeToggle` (segmented pill, `bg-card border border-white/8` active state)
- [ ] Switching to "Epic" clears `epic_id` (task cannot be child of itself)
- [ ] Switching from "Epic" to "Task" restores previously set `epic_id`
- [ ] `issueTypeOptionsFromOrgs` removed from form (can be removed from exports if unused elsewhere)

### Description sections
- [ ] New task form pre-populates description with Context/Steps/DoD template
- [ ] New epic form pre-populates description with Context/Steps template (no DoD)
- [ ] Editing existing issue: description is NOT auto-reset to template
- [ ] Description textarea has sufficient height (min 10 rows) for multi-section content
- [ ] No separate DoD checklist rendered in the form

### DoD checklist removal
- [ ] `useFieldArray` for `dod` removed from `issue-form.tsx`
- [ ] `dod` field removed from `IssueFormValues`
- [ ] `dod` field removed from `IssueUpsertDTO`
- [ ] `dod?: DoDItem[] | null` removed from `Issue` interface
- [ ] `IssueDodProgress` component deleted
- [ ] `issue-dod-progress.tsx` file deleted
- [ ] Detail page `[id]/page.tsx` no longer imports or renders `IssueDodProgress`

### No regressions
- [ ] Epic child task selector still works (no changes to that flow)
- [ ] Task's `epic_id` field still works
- [ ] Filter toggle (`All`/`Epics`/`Tasks`) still works — no changes needed
- [ ] `buildIssuesQuery` task→exclude_type transform still works
- [ ] All existing tests pass

---

## Edge Cases

1. **Existing `type: 'development'` issues** — must display as "Task" in form. On update, the form will send `type: 'organization'`, changing the stored type. This is acceptable — `development` vs `organization` is an execution state, not a permanent attribute. If backward-compat is needed, map display only and don't change stored type (send the original value back if user didn't change type).

   **Safer approach**: Send the resolved display type back (`organization` for both `development` and `organization`). If this breaks Paperclip re-dispatch logic (which checks `last_agent_execution_mode`, not `type`), it's safe.

2. **Org-configured custom issue types** (e.g., a custom `"Bug"` type with `base_type: 'development'`) — these will be hidden from the form. Existing issues with custom type keys will still render as "Task" (since `type !== 'epic'`). If custom org types need to survive, this plan needs a gate — but the user's spec says "remove old types", so we proceed.

3. **Description template on type toggle** — when user switches type in the form (task ↔ epic) for a NEW issue with the default template, should the template update? Simplest approach: only pre-populate on initial render (from `defaultValues`). Don't auto-update on type change — it would clobber user text.

4. **Empty description on existing issues** — some issues may have `description: null` or `""`. The template should only apply to new issues (where `!issue`).

---

## File Index

| File | Action |
|---|---|
| `features/issues/ui/issue-form.tsx` | Replace type dropdown with 2-option toggle; remove DoD checklist; add description template |
| `features/issues/model/types.ts` | Remove `dod` from `IssueUpsertDTO`, `Issue`, `IssueFormValues`; conditionally remove `DoDItem` and `issueTypeOptionsFromOrgs` |
| `features/issues/ui/issue-dod-progress.tsx` | **Delete** |
| `app/dashboard/issues/[id]/page.tsx` | Remove `IssueDodProgress` import and render block |
| `features/issues/index.ts` | Remove `issueTypeOptionsFromOrgs` export if unused elsewhere |
| `entities/issue/model/types.ts` | No changes (keep `VALID_ISSUE_BACKEND_TYPES` as-is) |

---

## References

### Internal Code References
- `features/issues/ui/issue-form.tsx` — type dropdown at lines ~349-370; DoD checklist at lines ~498-555
- `features/issues/ui/issue-type-toggle.tsx:5-9` — reference for toggle visual style
- `features/issues/model/types.ts:25-43` — `issueTypeOptionsFromOrgs` to remove
- `features/issues/model/types.ts:232-245` — `IssueUpsertDTO` (remove `dod`)
- `features/issues/ui/issue-dod-progress.tsx` — file to delete
- `app/dashboard/issues/[id]/page.tsx` — detail page (remove DoD progress block)
- `features/issues/model/build-issues-query.ts` — no changes needed
- `entities/issue/model/types.ts:55` — `VALID_ISSUE_BACKEND_TYPES` stays

### Backend References
- `WandaAsk_backend/app/Models/Issue.php:22-26` — `TYPE_DEVELOPMENT`, `TYPE_ORGANIZATION`, `TYPE_EPIC` constants
- `WandaAsk_backend/app/Models/Issue.php:209-216` — `normalizeType()` maps `'task'` → `'organization'`
- `WandaAsk_backend/config/issue_validation.php` — required description sections per type
- `WandaAsk_backend/app/Http/Resources/API/v1/IssueResource.php` — no `dod` field returned
- `WandaAsk_backend/app/Http/Requests/API/v1/IssueRequest.php:38-56` — accepted `type` values: `['development', 'organization', 'epic']`
- `WandaAsk_backend/app/Services/IssueAgentService.php` — dispatch: execution_mode is independent of stored type