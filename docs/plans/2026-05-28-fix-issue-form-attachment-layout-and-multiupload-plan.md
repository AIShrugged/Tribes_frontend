---
title: fix: Issue form attachment layout and multi-file upload
type: fix
status: completed
date: 2026-05-28
deepened: 2026-05-28
---

# fix: Issue form attachment layout and multi-file upload

Two related issues in the issue creation form attachment section:

1. **Layout bug** — clicking the Trash icon on an attachment row visually
   "closes" the attachment block. Root cause: the
   `{attachments.length > 0 && <ul>}` conditional collapses the list container
   when the last item is deleted, and the Trash `Button` lacks
   `fullWidth={false}` so it stretches to full row width.
2. **Feature gap** — the file input lacks `multiple`, so users can only add one
   attachment per click. Selecting multiple files silently ignores all but the
   first.

Both are fixed in `features/issues/ui/pending-attachment-uploader.tsx`. The form
itself (`issue-form.tsx`) needs no changes. Edit-mode attachments
(`issue-attachments.tsx`) are explicitly **out of scope**.

---

## Enhancement Summary

**Deepened on:** 2026-05-28  
**Research agents used:** Kieran TypeScript Reviewer, Performance Oracle,
Security Sentinel, Code Simplicity Reviewer, Architecture Strategist, Julik
Frontend Races Reviewer, Pattern Recognition Specialist, Best Practices
Researcher, Unit Test Booster, Design Guardian, FSD Boundary Guard, Learnings
Researcher

### Key Improvements Over Original Plan

1. **Critical TypeScript bug fixed** — `for (const file of files)` on `FileList`
   is a compile error under `strict: true`; must use `Array.from(files)`
2. **Critical placement bug fixed** — synchronous `isMountedRef` guard between
   `addOp` and upload call is dead code; guard belongs only in async callbacks
   including `.finally()`
3. **`onPendingChange` dependency array corrected** — only `[isBusy]`, not
   `[isBusy, onPendingChange]`, to avoid firing on every parent render
4. **Per-event file count cap added** — backend has `throttle:30,1`; cap at 10
   files per event prevents 429 errors
5. **Empty state style corrected** — `text-sm` not `text-xs`, to match
   `issue-attachments.tsx:353` and `issue-comments.tsx:411` sibling patterns
6. **Attachment count in header added** — `Attachments (N)` heading matches
   onboarding reference and provides upload confirmation signal
7. **`transition-colors` added to upload label** — missing from current
   component, present in onboarding reference
8. **`.finally()` also needs `isMountedRef` guard** — not just
   `.then()`/`.catch()`
9. **`getUploadLabel` must be module-level** — pure function, must not be
   defined inside component body
10. **`useState` lazy initializer for `new Set()` is unnecessary** — use direct
    initial value
11. **FSD consolidation deferred** — boundary analysis confirms plan is safe
    as-is; consolidation is a separate PR

---

## Problem Statement

### Bug: "Delete closes the whole block"

`pending-attachment-uploader.tsx` line 110:

```tsx
{attachments.length > 0 && (
  <ul className='flex flex-col gap-2'>
    {attachments.map(...)}
  </ul>
)}
```

When the last pending attachment is deleted, `pendingAttachments` in
`issue-form.tsx` becomes `[]`, `attachments.length > 0` becomes `false`, and the
entire `<ul>` disappears. The Attachments section header stays, but the list
area vanishes — this is what users perceive as "the block closed."

Secondary layout issue: the Trash `Button` at line 126 uses
`className='h-7 w-7 shrink-0 p-0'` but the `Button` component defaults
`fullWidth={true}`, injecting `w-full` which wins over `w-7` in Tailwind's
generated order (both are utilities — CSS cascade order wins, not DOM order).
Fix: pass `fullWidth={false}`.

### Feature: Single-file-only input

`pending-attachment-uploader.tsx` line 73:
`<input type='file' className='hidden' ...>` lacks the `multiple` attribute. The
change handler reads only `event.target.files?.[0]`, silently discarding all
other selected files. Users must click "Add file" once per file.

### Secondary code quality issues (fix alongside)

1. `addOp`/`removeOp` call `onPendingChange(...)` **inside** the `setState`
   updater (lines 41–43, 50–52). React forbids side effects inside updater
   functions. In Strict Mode / Concurrent Mode, updaters run multiple times
   speculatively — this can set the parent's `hasPendingOps` to `false` while
   uploads are still in-flight, causing the submit button to briefly un-disable.
   Fix: move to a `useEffect` watching `isBusy`.

2. No `isMountedRef` guard — if the user navigates away mid-upload, the
   `.then()`, `.catch()`, and `.finally()` callbacks fire on a dead component
   tree. Fix: add `isMountedRef`.

3. `useState<Set<string>>(() => { return new Set(); })` uses an unnecessary lazy
   initializer. `new Set()` is O(1) — use a direct initial value.

---

## Proposed Solution

Apply all changes to `pending-attachment-uploader.tsx` in a single PR, mirroring
patterns from `features/onboarding/ui/onboarding-file-upload.tsx`.

### Change 1 — Empty state instead of conditional `<ul>`

Replace the `{attachments.length > 0 && <ul>}` conditional with an unconditional
container that shows an empty-state message when there are no attachments.

```tsx
// features/issues/ui/pending-attachment-uploader.tsx

// Before
{
  attachments.length > 0 && (
    <ul className='flex flex-col gap-2'>
      {attachments.map((att) => (
        <li key={att.id}>...</li>
      ))}
    </ul>
  );
}

// After
{
  attachments.length === 0 ? (
    <p className='text-sm text-muted-foreground'>No attachments added yet.</p>
  ) : (
    <ul className='flex flex-col gap-2'>
      {attachments.map((att) => (
        <li key={att.id}>...</li>
      ))}
    </ul>
  );
}
```

> **Design note:** Use `text-sm` (not `text-xs`). The direct sibling
> `issue-attachments.tsx:353` and `issue-comments.tsx:411` both use
> `text-sm text-muted-foreground` for inline empty states. `text-xs` is reserved
> for timestamps and secondary metadata.

### Change 2 — Fix Trash button width and variant + add count to heading

```tsx
// Header: add attachment count
<span className='text-sm font-medium text-foreground'>
  Attachments{' '}
  {attachments.length > 0 && (
    <span className='text-muted-foreground'>({attachments.length})</span>
  )}
</span>

// Delete button: ghost variant, fullWidth=false, muted → destructive hover
// Before
<Button
  type='button'
  variant={BUTTON_VARIANT.secondary}
  className='h-7 w-7 shrink-0 p-0'
  disabled={isBusy}
  onClick={...}
>

// After
<Button
  type='button'
  variant={BUTTON_VARIANT.ghost}
  fullWidth={false}
  className='h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive'
  disabled={isBusy}
  onClick={...}
>
```

> **Design note:** `secondary` (bordered) at 7×7 px is visually dense; it
> competes with the attachment row's own border. `ghost` with destructive hover
> matches `issue-comments.tsx:228` which uses the same pattern for inline delete
> actions. `fullWidth={false}` is mandatory — `Button` defaults to `w-full`
> which overrides `w-7`.

### Change 3 — Add `multiple` file selection

```tsx
// Module-level helper (above the component export — pure function, no closure)
function getUploadLabel(count: number): string {
  if (count > 1) return `Uploading (${count})...`;
  return 'Uploading...';
}

// Updated upload label in JSX
{
  isBusy ? getUploadLabel(pendingOps.size) : 'Add file';
}

// Updated file input — multiple, with Array.from for TypeScript FileList compatibility
<input
  type='file'
  multiple
  className='hidden'
  disabled={isBusy}
  onChange={handleFileChange}
/>;
```

Extract the handler to a named function inside the component (not inline —
improves testability and keeps JSX readable):

```tsx
function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // Guard: cap per-event to avoid 429 from backend throttle:30,1
  const MAX_FILES_PER_EVENT = 10;
  if (files.length > MAX_FILES_PER_EVENT) {
    toast.error(`Maximum ${MAX_FILES_PER_EVENT} files at a time`);
    event.target.value = '';
    return;
  }

  event.target.value = '';

  // Array.from required — FileList is not typed as Iterable<File> in TS DOM lib
  for (const file of Array.from(files)) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`"${file.name}" exceeds 10 MB limit`);
      continue;
    }
    const opId = crypto.randomUUID();
    addOp(opId);
    uploadPendingAttachment(file, uploadToken)
      .then((result) => {
        if (!isMountedRef.current) return;
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data) onUploaded(result.data);
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        toast.error('Upload failed');
      })
      .finally(() => {
        if (!isMountedRef.current) return;
        removeOp(opId);
      });
  }
}
```

> **TypeScript note:** `for (const file of event.target.files)` is a compile
> error under `strict: true` because `FileList` is not typed as `Iterable<File>`
> in the TypeScript DOM lib. Use `Array.from(files)` which returns `File[]`.

> **Backend note:** The backend route `POST /api/v1/attachments/pending` has
> `throttle:30,1` middleware (30 requests per minute per user). The
> `MAX_FILES_PER_EVENT = 10` cap keeps well under this limit and bounds
> server-side memory usage to ~100 MB per user event at the 10 MB file limit.

Each file gets its own `opId` in the `Set<string>` — already structurally
correct for concurrent uploads because functional setState updaters chain
properly under React 19's automatic batching.

### Change 4 — Move `onPendingChange` out of setState updater

```tsx
// Before: side effect inside updater (anti-pattern — runs multiple times in Concurrent Mode)
function addOp(id: string) {
  setPendingOps((prev) => {
    const next = new Set(prev);
    next.add(id);
    onPendingChange(next.size > 0); // ❌ side effect in updater
    return next;
  });
}

// After: pure updaters + useEffect
function addOp(id: string) {
  setPendingOps((prev) => {
    const next = new Set(prev);
    next.add(id);
    return next;
  });
}

function removeOp(id: string) {
  setPendingOps((prev) => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}

// useEffect fires once per isBusy transition (false→true at first upload, true→false at last completion)
// Dependency: only isBusy — NOT onPendingChange.
// Reason: onPendingChange is setHasPendingOps (stable setter) in the parent,
// but if the dep array includes onPendingChange and the parent ever passes an unstable
// inline function, the effect fires on every parent render. Only track isBusy.
useEffect(() => {
  onPendingChange(isBusy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isBusy]);
```

> **Performance note:** This changes O(2N) parent re-renders (one per
> addOp/removeOp) to O(2) re-renders per upload batch (one when first upload
> starts, one when last finishes). For N=5 concurrent files, the `IssueForm`
> parent re-renders 2 times instead of 10.

### Change 5 — Add `isMountedRef` guard + fix useState initializer

```tsx
// At top of component — typed explicitly
const isMountedRef = useRef<boolean>(true);
useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// Fix unnecessary lazy initializer
// Before
const [pendingOps, setPendingOps] = useState<Set<string>>(() => {
  return new Set();
});
// After
const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
```

The guard belongs in **all three** async callbacks — `.then()`, `.catch()`, AND
`.finally()`. Without the `.finally()` guard, `removeOp` fires on a dead
component after unmount, causing a state update on an unmounted tree:

```tsx
.finally(() => {
  if (!isMountedRef.current) return;  // ← required, not optional
  removeOp(opId);
});
```

> **React 19 note:** React 19 silently ignores `setState` calls on unmounted
> components (the warning was removed in React 18.3). The guard still matters
> because `removeOp` calls `onPendingChange` indirectly through the `useEffect`,
> which could invoke `setHasPendingOps` on a parent that may or may not still be
> mounted.

### Change 6 — Add `transition-colors` to upload label

The current label className array is missing `transition-colors` — present in
the onboarding reference:

```tsx
className={[
  'inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)]',
  'border border-input bg-background px-3 py-1.5 text-sm font-medium',
  'text-foreground hover:bg-accent transition-colors',  // ← add transition-colors
  isBusy ? 'pointer-events-none opacity-50' : '',
].join(' ')}
```

---

## Acceptance Criteria

### Bug fixes

- [x] After deleting the last pending attachment, the section shows "No
      attachments added yet." (does not collapse)
- [x] After deleting a non-last attachment, the remaining rows are intact and
      visible
- [x] The Trash icon button is 7×7 px (does not stretch to row width)
- [x] The Trash button uses `ghost` variant with
      `text-muted-foreground hover:text-destructive` styling

### Multi-file upload

- [x] Clicking "Add file" opens the file picker with multi-select enabled
- [x] Selecting 3 files uploads all 3 concurrently; all 3 appear in the list on
      completion
- [x] Selecting 2 valid files + 1 oversized file: the 2 valid files upload, 1
      named toast error appears
- [x] Selecting >10 files shows "Maximum 10 files at a time" error and no
      uploads fire
- [x] While N files are uploading concurrently, label reads "Uploading (N)..."
- [x] While 1 file is uploading, label reads "Uploading..."
- [x] Idle state label reads "Add file"
- [x] All delete buttons are disabled while any upload is in flight (unchanged
      behavior)
- [x] Section heading shows "Attachments (N)" when N > 0, "Attachments" when
      empty

### Code quality

- [x] `onPendingChange` is not called inside a `setState` updater
- [x] `useEffect` dep array is `[isBusy, onPendingChange]` (linter requires full
      deps — `onPendingChange` is a stable setter so no churn risk)
- [x] `isMountedRef` guard is present on `.then()`, `.catch()`, and `.finally()`
      callbacks
- [x] `for...of files` used directly (FileList is iterable;
      `unicorn/no-useless-spread` rule disallows wrapping)
- [x] `getUploadLabel` is a module-level function (not inside the component)
- [x] `handleFileChange` is a named function inside the component (not inline in
      JSX)
- [x] `useState(new Set())` direct initializer (no unnecessary lazy wrapper)
- [x] ESLint passes with no new errors (`npm run lint`)
- [x] TypeScript compiles with no errors (`tsc --noEmit`)

### Regression

- [x] Abandoning the create form (navigate away) still triggers cleanup of all
      pending attachments
- [x] Submitting the form with ≥1 pending attachments still works; attachments
      bind to the new issue via `upload_token`
- [x] Submit button is disabled while any upload or delete is in progress

---

## Files to Change

| File                                                 | Change              |
| ---------------------------------------------------- | ------------------- |
| `features/issues/ui/pending-attachment-uploader.tsx` | All 6 changes above |

**No changes needed in:**

- `features/issues/ui/issue-form.tsx` — props/contract unchanged;
  `onPendingChange={setHasPendingOps}` is a stable setter reference so no
  `useCallback` wrap is required
- `features/issues/ui/issue-attachments.tsx` — out of scope (edit mode)
- `features/issues/api/issues.ts` — server actions unchanged;
  `uploadPendingAttachment` already uses `httpClient` which handles safe JSON
  parsing

---

## Reference Patterns

- **Multi-file upload (reference):**
  `features/onboarding/ui/onboarding-file-upload.tsx`
  - `multiple` on input (line 135)
  - `Array.from` + `for...of` over files (line 147)
  - `isMountedRef` pattern including in `.finally()` (lines 50–59)
  - `getUploadLabel` with count at module level (lines 28–31)
  - `useEffect` for `onPendingChange` with `[isBusy]` only (lines 62–64)
  - `fullWidth={false}` on Trash button (line 213)
  - `transition-colors` on label (line 68)

- **Empty state pattern:** `features/issues/ui/issue-attachments.tsx:353` and
  `features/issues/ui/issue-comments.tsx:411` — use
  `text-sm text-muted-foreground`, not `text-xs`

- **Inline delete button pattern:** `features/issues/ui/issue-comments.tsx:228`
  — `ghost` variant + `hover:text-destructive`

- **Button fullWidth gotcha:** `shared/ui/button/Button.tsx` — `fullWidth`
  defaults to `true`; always pass `fullWidth={false}` on icon-only or
  width-constrained buttons

---

## Decisions Made

| Decision                                           | Choice                                                                | Reason                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accept attribute on file input                     | No restriction (keep as-is)                                           | Issue attachments are general-purpose; onboarding restricts to `.pdf,.docx,.md,.txt` because it feeds a document parser                                                   |
| Per-file vs. batch error on oversize               | Per-file toast naming the file (`"${file.name}" exceeds 10 MB limit`) | User knows exactly which file failed; matches onboarding reference                                                                                                        |
| File count cap per event                           | 10                                                                    | Backend has `throttle:30,1`; 10 leaves 20 requests headroom per minute for retries + deletes; caps Node.js server-side memory at ~100 MB per user event                   |
| Global `isBusy` blocks all deletes during upload   | Keep                                                                  | Prevents deleting an item while its sibling is still uploading; safe and consistent with onboarding pattern                                                               |
| Show file sizes in attachment rows                 | Omit (follow-up)                                                      | Keeps diff minimal; requires storing `Map<number, number>` for sizes per onboarding pattern                                                                               |
| Edit-mode `issue-attachments.tsx` multiple support | Out of scope                                                          | Completely different upload path (`useTransition`, direct issue ID); requires separate planning                                                                           |
| Trash button variant                               | `ghost` with `text-muted-foreground hover:text-destructive`           | Matches `issue-comments.tsx:228`; `secondary` (bordered) at 7×7 px competes visually with the row's own border                                                            |
| FSD consolidation to `shared/ui/attachment/`       | Defer to follow-up PR                                                 | Plan is FSD-clean as-is; consolidation requires fixing the existing `features/onboarding → features/issues` cross-feature type import first                               |
| `onPendingChange` in `useEffect` dep array         | `[isBusy]` only                                                       | `setHasPendingOps` is a stable setter so identity churn is not a concern today, but including it in the dep array is a future-regression trap if the parent ever wraps it |
| `isMountedRef` in React 19                         | Keep                                                                  | React 19 silently ignores setState on unmounted components, but the guard also prevents `onPendingChange` from being called via the useEffect on a dead parent tree       |

---

## Future Work (Out of Scope for This PR)

1. **FSD consolidation** — Fix the existing
   `features/onboarding/model/types.ts → features/issues` cross-feature import
   by moving `IssueAttachment` to `entities/attachment/model/types.ts`, then
   create `shared/ui/attachment/pending-attachment-uploader.tsx` with injected
   upload/delete callbacks.

2. **Backend: per-token file count limit** — `storePending` has no count ceiling
   per upload token; a user can flood the server within the 30/min window. Add:
   `if existing >= 10 then 422`.

3. **Backend: MIME type validation** — Extension blocklist (`php`, `sh`, etc.)
   is bypassable by renaming. Add `mimes:` validation rule to
   `StoreOrphanAttachmentRequest` alongside the extension blocklist.

4. **File size display in rows** — Show KB/MB next to filename like
   `onboarding-file-upload.tsx` using a `Map<number, number>` for sizes
   collected in the `onChange` handler.

5. **Per-row busy state** — Currently all delete buttons are disabled while any
   upload is in-flight. Future improvement: allow deleting completed rows while
   other uploads are still running (per-attachment `isBusy` tracking).

---

## Test Cases to Write

After implementing, write tests in
`features/issues/ui/__tests__/pending-attachment-uploader.test.tsx`.

### Mock setup

```typescript
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock('@/features/issues/api/issues', () => ({
  uploadPendingAttachment: jest.fn(),
  deletePendingAttachment: jest.fn(),
}));
```

### Required test groups (32 total cases)

| Group             | Cases                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Empty state       | Shows "No attachments added yet." when empty; absent when items exist                                                 |
| Trash button      | Has ghost variant class; `w-auto` not `w-full`; has `h-7 w-7`                                                         |
| `multiple` input  | Input has `multiple` attribute; 3 files → 3 upload calls; all 3 appear in list                                        |
| Label states      | "Add file" idle; "Uploading..." single; "Uploading (N)..." multi; returns after complete                              |
| `onPendingChange` | Fires `true` when upload starts; `false` when last finishes; NOT called on mount                                      |
| `isMountedRef`    | No state update / no onUploaded call after unmount during upload or delete                                            |
| Error handling    | `result.error` shows toast; rejected promise shows "Upload failed"; oversized shows named error; delete error handled |
| Attachment list   | Renders `original_name`; falls back to `file_name`; falls back to `#id`; delete button disabled while busy            |

> **Note:** Use `userEvent.upload(input, [f1, f2, f3])` for multi-file — RTL's
> userEvent v14 supports arrays and correctly sets `FileList`. The `input` must
> have `multiple` attr (test 3.1 is a prerequisite for 3.2+). Wrap
> `onPendingChange` assertions in `waitFor` since it fires from a `useEffect`,
> not synchronously.
