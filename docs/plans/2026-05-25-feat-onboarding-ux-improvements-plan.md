---
title: "feat: Onboarding UX Improvements — Header Button, Multi-file Upload, Size Limit, Optional Description, Hide Tasks"
type: feat
status: active
date: 2026-05-25
deepened: 2026-05-25
---

# Onboarding UX Improvements

Five focused improvements to the onboarding wizard covering placement, file
upload, validation, and preview output. Each item is independent and can be
implemented in a single commit.

---

## Enhancement Summary

**Deepened on:** 2026-05-25
**Agents used:** julik-frontend-races-reviewer, kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer, security-sentinel, performance-oracle, pattern-recognition-specialist, best-practices-researcher, framework-docs-researcher

### Key Improvements Added

1. **Item 1 — Architecture changed**: Do NOT create `features/organization/ui/onboarding-cta.tsx`. Inline the CTA directly into `app/dashboard/layout.tsx`, reusing the already-computed `org?.onboarded_at` result. FSD violation identified: a component under `features/organization/` must not read `onboarding_skipped` cookie (owned by `features/onboarding/`).
2. **Item 1 — `<a>` → `<Link>`**: Must use `next/link` for internal navigation. Raw `<a>` triggers a full-page reload, bypasses client-side router, Router Cache, and prefetching.
3. **Item 1 — Error handling**: `getOrganization()` can throw — must wrap in try/catch returning `null` to prevent layout crashes.
4. **Item 2 — `multiple` attribute is required**: Without adding `multiple` to the `<input>`, the multi-file loop is dead code.
5. **Item 2 — `.catch` guard missing**: The `.catch()` callback is outside `isMountedRef.current` guard — ghost toasts appear after component unmount.
6. **Item 2 — Upload progress UX**: Industry standard is `"Uploading X / Y..."` counter in button label, not just `"Uploading..."`. Track completed count via separate state.
7. **Item 4 — Simpler fix**: Just remove `|| !state.description.trim()` from disabled. Do NOT add the conditional spread — it adds complexity with no functional gain since the backend accepts empty string and the button gate is sufficient.
8. **Item 4 — Guard for truly empty submit**: Security agent flagged AI quota waste. Add `hasAnyInput` guard instead of pure `isSubmitting || hasFilePending`.
9. **Security**: `onboarding.ts` cookies missing `NEXT_PUBLIC_APP_ENV` check for `secure` flag — staging environments send cookies over HTTP.

### New Considerations

- `getOrganization` uses React `cache()` — second call in same render is free (deduplicated per request)
- Fire-and-forget Server Action calls (no `startTransition`) do not surface errors to Error Boundaries — the existing try/catch pattern is correct
- `cookies()` is request-scoped and NOT re-parsed on each call — safe to call in both layout and nested component
- `PendingAttachmentUploader` (issues feature) has a side-effect-in-updater bug (`onPendingChange` called inside `setPendingOps` updater) — pre-existing debt, separate issue

---

## Overview

| # | Item | Files touched | Complexity |
|---|------|---------------|------------|
| 1 | Move Onboarding entry point to Header | `app/dashboard/layout.tsx` only (inline, no new file) | Low |
| 2 | Multi-file upload (parallel fan-out, same `upload_token`) | `features/onboarding/ui/onboarding-file-upload.tsx` | Low |
| 3 | Fix file size toast message to use `formatSize()` | `features/onboarding/ui/onboarding-file-upload.tsx` | Trivial |
| 4 | Make Description optional in Generate Structure | `features/onboarding/ui/onboarding-input-step.tsx` | Trivial |
| 5 | Hide Tasks nested under Goals in Preview step | `features/onboarding/ui/onboarding-goal-card.tsx` | Trivial |

---

## Item 1 — Move "Onboarding" entry point out of Profile tabs into the Header

### Problem

The Onboarding tab lives inside `app/dashboard/profile/` tabs, visible only to
users who navigate to their Profile page. Organizations that haven't completed
onboarding get a full-page redirect to `/onboarding` on first login, but if they
skip, the only re-entry is buried under Profile → Onboarding.

### Analysis

`app/dashboard/layout.tsx` already:
- reads `isOnboarded` / `hasSkipped` cookies (lines 27–32)
- calls `getOrganization(orgIdFromCookie)` for the redirect check (line 34)
- performs the mandatory redirect to `ROUTES.ONBOARDING` if not onboarded & not skipped
- renders the `<header>` bar with `OrganizationSelector` and `User` components

The profile layout (`app/dashboard/profile/layout.tsx`) conditionally renders
the Onboarding tab via `showOnboarding: !org?.onboarded_at`. That tab remains
unchanged — this plan only adds a second, more visible entry point.

### Recommendation — Inline CTA into `app/dashboard/layout.tsx`

**Do NOT create a new `features/organization/ui/onboarding-cta.tsx` file.**

Reasons (from architecture and simplicity reviews):
1. **FSD violation**: A `features/organization/` component must not read the `onboarding_skipped` cookie — that cookie is owned by `features/onboarding/`. Placing cross-feature cookie logic in `features/organization/` creates hidden coupling.
2. **Duplication**: The layout already reads all 3 relevant cookies and calls `getOrganization()`. A new Server Component with its own cookie reads + `getOrganization()` call duplicates logic that already exists in the same file.
3. **Pattern match**: The `ProfileLayout` → `ProfileTabsNav` precedent shows the correct approach — derive the flag at the layout level, pass it as a prop to a presentational component (or inline the conditional).
4. **`getOrganization` is `cache()`-wrapped** — a second call in the same render tree is deduplicated, so no extra network request, but a new file is still unnecessary.

**Correct implementation**: extend the existing redirect logic in `app/dashboard/layout.tsx` to also derive `showOnboardingCta`, then render an inline conditional `<Link>` in the header:

```tsx
// app/dashboard/layout.tsx
// In the existing block (lines 33-39) that already calls getOrganization:
const shouldShowCta = !isOnboarded && hasSkipped && orgIdFromCookie;
let org: OrganizationProps | null = null;

if (!isOnboarded && !hasSkipped && orgIdFromCookie) {
  const { data: fetchedOrg } = await getOrganization(orgIdFromCookie).catch(() => ({ data: null }));
  org = fetchedOrg;
  if (!org?.onboarded_at) {
    redirect(ROUTES.ONBOARDING);
  }
}

// For CTA: if user has skipped, we still need to check onboarded_at
let showOnboardingCta = false;
if (shouldShowCta) {
  try {
    const { data: ctaOrg } = await getOrganization(orgIdFromCookie!);
    showOnboardingCta = !ctaOrg?.onboarded_at;
  } catch {
    // silently skip CTA on error — do not break layout
  }
}
```

Then in the header JSX, right-side actions slot:

```tsx
// app/dashboard/layout.tsx — header right slot
<div className='flex items-center gap-2 flex-shrink-0'>
  {showOnboardingCta && (
    <Link
      href={ROUTES.DASHBOARD.PROFILE_ONBOARDING}
      className='inline-flex items-center gap-1.5 rounded-[var(--radius-button)]
                 border border-violet-500/50 bg-violet-500/10 px-2.5 py-1
                 text-xs font-medium text-violet-400 hover:bg-violet-500/20
                 transition-colors flex-shrink-0'
    >
      Setup org
    </Link>
  )}
  <User />
</div>
```

**Key points:**
- Use `<Link>` from `next/link`, not `<a>` — internal navigation requires client-side routing for Router Cache, prefetching, and shared layout preservation. Raw `<a>` triggers a full page reload.
- The `getOrganization()` call is `cache()`-wrapped — if the redirect branch already called it with the same `orgId`, the CTA branch is free (deduplicated).
- Wrap in try/catch — `getOrganization()` can throw (401, 5xx, network). A thrown error without a catch would break the entire layout server render.
- Keep the Profile Onboarding tab — it guards itself with `showOnboarding` in `ProfileLayout` and disappears once `onboarded_at` is set. No removal needed.

> **Alternative considered:** `features/onboarding/ui/onboarding-cta.tsx`. Valid FSD layer (onboarding logic in onboarding feature), but still creates an unnecessary new file when the layout already has all the data. Prefer inlining.

### Research Insights

**Next.js Fetch Deduplication:**
- `getOrganization` is wrapped with React `cache()` from `react` — confirmed in `features/organization/api/organization.ts`
- Per-request memoization: identical URL + options → single HTTP request, regardless of how many Server Components call it
- Next.js 15/16 change: `fetch` GET responses are NO LONGER cached in Full Route Cache by default (breaking from v14). However, per-request memoization (within one render pass) is unaffected.
- Cookie argument coercion risk: if one call passes `string` and another passes `number`, `cache()` deduplication breaks. Always pass `string` or always `number` — be consistent.

**`<Suspense>` streaming behavior:**
- Wrapping `OnboardingCta` in `<Suspense fallback={null}>` makes it stream independently — the layout shell sends to client immediately.
- However, since we're inlining into the layout, there is no Suspense wrapper. The `showOnboardingCta` boolean is computed inline. If this adds latency, wrap the CTA `<Link>` block in Suspense by extracting to a small async Server Component (only do this if the extra `getOrganization` call is slow — given `cache()` it won't be).
- Bigger streaming opportunity: `OrganizationSelector` and `User` in the header are unwrapped async Server Components — they block the entire layout HTML. Adding `<Suspense>` wrappers around them would be a more impactful performance improvement (out of scope for this plan, separate refactor).

**`cookies()` behavior:**
- `cookies()` is request-scoped — calls from layout AND nested components return the same store, not re-parsed.
- Cannot call `cookies()` inside a `'use cache'`-annotated function. Since we read cookies outside any cache scope, no issue.

---

## Item 2 — Multi-file upload with a single `upload_token`

### Problem

`<input type="file">` currently handles only one file at a time (`files?.[0]`).
The backend stores each upload independently under the same `upload_token` and
reads **all** of them during generation (see `OnboardingLlmBase.php` line 22:
`IssueAttachment::pending($uploadToken, $userId, $organizationId)->get()`). The
`generate-structure` endpoint accepts **one** `upload_token` (not an array), so
all files must share the same token.

### Backend constraints (from source code)

| Constraint | Source |
|---|---|
| One file per request, field name `file` | `IssueAttachmentController.php:75` / `StoreOrphanAttachmentRequest.php` |
| Max file size: **10 240 KB** | `StoreOrphanAttachmentRequest.php:16` (`'max:10240'`) |
| `upload_token` must be UUID v4 | `StoreOrphanAttachmentRequest.php:25` (regex) |
| Pending files TTL: 24 hours | `IssueAttachment.php:17` (`ORPHAN_TTL_HOURS = 24`) |
| `organization_id` required for org-scoped read | `OnboardingLlmBase.php:22` |
| `generate-structure` takes single `upload_token` | `GenerateOrganizationStructureRequest.php:20` |

### Recommendation — `multiple` attribute + parallel fan-out with corrected guards

The change is entirely in `onboarding-file-upload.tsx`:

1. **Add `multiple` to `<input type="file">`** — without this, `event.target.files` always has at most 1 entry and the loop is dead code. This is the most critical missing piece.
2. In `onChange`, iterate `event.target.files` (all selected files) via `Array.from()`.
3. Validate each file's size individually.
4. Fire `uploadPendingAttachment` for **each** file — they run in parallel (fire-and-forget), all using the same `uploadToken`.
5. Each upload gets its own `opId` in `pendingOps` — the busy-state covers the full fan-out correctly.
6. **Fix the `.catch()` guard** — move the toast inside the `isMountedRef.current` check to prevent ghost toasts after unmount.
7. **Track upload count** for better UX button label.

```tsx
// onboarding-file-upload.tsx — full onChange replacement

// Add to component state:
const [uploadCount, setUploadCount] = useState({ completed: 0, total: 0 });

onChange={(event) => {
  const files = Array.from(event.target.files ?? []);
  event.target.value = '';  // reset once before loop

  if (files.length === 0) return;

  const validFiles = files.filter((file) => {
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`"${file.name}" exceeds ${formatSize(MAX_SIZE_BYTES)} limit`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  setUploadCount((prev) => ({
    completed: prev.completed,
    total: prev.total + validFiles.length,
  }));

  for (const file of validFiles) {
    const opId = crypto.randomUUID();
    const originalName = file.name;
    const originalSize = file.size;

    addOp(opId);
    uploadPendingAttachment(file, uploadToken, organizationId)
      .then((result) => {
        if (!isMountedRef.current) return;
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data) {
          const id = result.data.id;
          setFileNames((prev) => {
            return new Map(prev).set(id, originalName);
          });
          setFileSizes((prev) => {
            return new Map(prev).set(id, originalSize);
          });
          setUploadCount((prev) => ({
            ...prev,
            completed: prev.completed + 1,
          }));
          onUploaded(result.data);
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return;  // guard ghost toasts after unmount
        toast.error('Upload failed. Please try again.');
      })
      .finally(() => {
        removeOp(opId);
      });
  }
}}
```

Input element update:
```tsx
<input
  type='file'
  className='hidden'
  accept='.pdf,.docx,.md,.txt'
  multiple          {/* ← this line is REQUIRED */}
  disabled={isBusy}
  onChange={...}
/>
```

Button label with count:
```tsx
// Replace getSubmitLabel helper to show upload progress:
function getSubmitLabel(
  isSubmitting: boolean,
  hasFilePending: boolean,
  isRefine: boolean,
  uploadCount: { completed: number; total: number },
) {
  if (isSubmitting) return 'Generating...';
  if (hasFilePending) {
    return uploadCount.total > 1
      ? `Uploading ${uploadCount.completed} / ${uploadCount.total}...`
      : 'Uploading...';
  }
  return isRefine ? 'Regenerate' : 'Generate structure';
}
```

> No changes to `wizard-reducer.ts`, `onboarding.ts`, or the backend. The
> `upload_token` in `EMPTY_INPUT` is already a single UUID v4 from
> `crypto.randomUUID()`. The reducer's `ATTACHMENT_UPLOADED` action already
> appends; `ATTACHMENT_DELETED` already filters by `id`. The functional-updater
> pattern (`(prev) => new Map(prev).set(...)`) is required for correctness under
> React 18 automatic batching — all three Map state updates in the `.then()` are
> batched into a single re-render.

### Research Insights

**Race conditions identified (julik-races-reviewer):**

1. **Ghost toasts after unmount** (Medium severity): The `.catch()` callback calls `toast.error()` outside the `isMountedRef.current` guard. If the component unmounts during an in-flight upload (e.g., user navigates away), the catch fires and shows a toast for a component that no longer exists. **Fix:** Add `if (!isMountedRef.current) return;` at the top of `.catch()`.

2. **`multiple` attribute missing** (High — plan correctness): The `<input>` at line 124 does not have `multiple`. The fan-out loop is dead code without it. Adding `multiple` is a prerequisite.

3. **`isMountedRef` initialised as `true` before effect fires** (Low): The ref starts as `true` (line 44), then is reset to `true` in `useEffect`. In React 18 Strict Mode, the component mounts/unmounts/remounts — cleanup sets ref to `false`, re-mount sets it to `true`. Any synchronous resolution (impossible here) would skip the guard. Not a practical bug but an invariant to be aware of.

4. **`pendingOps` Set is opaque** (Design note): The Set tracks both upload and delete ops as UUIDs with no type information. This is sufficient for the current scope — it signals "something is busy." If per-op labelling is ever needed, extend to `Map<string, 'upload' | 'delete'>`.

**UX best practices (best-practices-researcher):**

- **Concurrent limit**: Industry standard is 3 concurrent uploads (matches Google Drive). The browser enforces ~6 TCP connections per origin anyway, so 10+ parallel requests all queue beyond 6 with no progress feedback. For this use case (typical 1-5 files), unlimited concurrency is acceptable since the browser caps it naturally.
- **Button label**: Show `"Uploading X / Y..."` counter for multi-file, plain `"Uploading..."` for single. This is the Cieden design guide standard.
- **Invalid file handling**: Validate all files first, filter invalid ones, toast per-file — do NOT silently skip. The current implementation toasts per oversized file and continues with valid files, which matches best practice.
- **File type hint**: Add static hint text below the dropzone: `PDF, DOCX, MD, TXT · max 10 MB` — always visible, not a tooltip. This prevents confusion before users open the file picker.
- **Empty state UX**: See Item 4.

**React 19 / Server Actions (framework-docs-researcher):**

- `uploadPendingAttachment` is called fire-and-forget (no `startTransition`). React 19 docs say "Server Functions should be called in a Transition" — this is guidance, not a runtime constraint. The system works either way; the limitation is that errors don't surface to Error Boundaries. The existing try/catch in the `.then()` / `.catch()` pattern handles this correctly.
- `useActionState` is for `<form action={...}>` pattern only. For `onChange` event handlers, `startTransition` is the correct primitive if you want React to manage the pending state. The current manual `pendingOps` Set approach is equivalent and works correctly.

---

## Item 3 — Fix file size limit display in toast

### Problem

`MAX_SIZE_BYTES = 10 * 1024 * 1024` (10 MB = 10 485 760 bytes). The backend
validates `'max:10240'` (Laravel KB = 10 485 760 bytes). They are numerically
identical — no functional bug. However, the error toast currently hardcodes the
message instead of using the `formatSize()` function already present in the file.

### Recommendation

One-line change in `onboarding-file-upload.tsx`:

```tsx
// Before (line 136):
toast.error('File exceeds 10 MB limit');

// After (as part of Item 2's per-file loop, already shown above):
toast.error(`"${file.name}" exceeds ${formatSize(MAX_SIZE_BYTES)} limit`);
```

Adding the filename to the message is a UX improvement from the multi-file context — the user needs to know which file was rejected. `formatSize(MAX_SIZE_BYTES)` evaluates to `"10.0 MB"` via the existing helper.

**Pattern note**: The shorter toast format (`'Upload failed'` without "Please try again.") is used in `pending-attachment-uploader.tsx` (issues feature). The onboarding uploader's `'Upload failed. Please try again.'` is an outlier. Aligning to the shorter form matches codebase majority style — but leave as-is to minimize diff scope; this is a trivial item.

---

## Item 4 — Make "Generate structure" button active without Description

### Problem

`onboarding-input-step.tsx` line 214:
```tsx
disabled={isSubmitting || hasFilePending || !state.description.trim()}
```

The `!state.description.trim()` guard blocks generation even when the user has
uploaded files or provided links — both of which give the AI enough context.
The backend already accepts `description` as `nullable` in
`GenerateOrganizationStructureRequest.php` line 19: `['nullable', 'string', 'max:10000']`.

### Recommendation

**The simplest correct fix** (from simplicity reviewer — do NOT add conditional spread):

Replace the `disabled` condition with a guard that requires at least one meaningful input:

```tsx
// onboarding-input-step.tsx
// Derive in component body or pass as prop:
const hasAnyInput =
  state.description.trim().length > 0 ||
  state.attachments.length > 0 ||
  state.links.some(Boolean) ||
  state.template !== null;

// Button:
disabled={isSubmitting || hasFilePending || !hasAnyInput}
```

**Why `hasAnyInput` instead of just removing the guard entirely:**
- Security review identified AI quota waste risk: if description, files, links, and template are all empty, dispatching to the LLM produces nothing useful and wastes API quota.
- Backend will accept the empty request (all fields are nullable) but the LLM will return `needs_more_info` or a useless generic stub.
- This preserves the new UX intent (description is optional IF files/links/template are provided) while preventing truly empty submissions.

**Do NOT change the payload in `onboarding-wizard.tsx`:**
The current `description: currentInput.description.trim()` (always included, may be empty string) is correct. The backend's `nullable` rule treats `""` and `null` identically. Adding a conditional spread `...(currentInput.description.trim() && { description: ... })` is unnecessary complexity — the `hasAnyInput` gate already ensures description is non-empty OR another field is filled. Keep the payload simple.

The `description?: string` optional type on `GenerateStructurePayload` is already correct — no type changes needed.

> **Alternative considered:** Remove `!state.description.trim()` entirely with no replacement guard. Rejected because it allows the user to click "Generate" with nothing filled in, wasting AI API calls.

### Research Insights

**UX guidance for empty form state (best-practices-researcher):**

- **Preferred pattern**: Allow the button click with empty inputs, then show an inline callout explaining what input is needed. Pre-disabling the button with no tooltip violates WCAG 3.3.1 (users cannot discover why the control is inactive).
- **If using disabled**: Render with `aria-disabled="true"` (not `disabled` attribute — which removes it from tab order) with visible helper text below: `"Add a description, file, or link to continue."`
- **The `hasAnyInput` approach** is a middle ground: it prevents truly empty submissions while allowing the button when any meaningful context is provided. This is a pragmatic trade-off between UX idealism and backend quota protection.

---

## Item 5 — Hide Tasks nested under Goals in the Preview step

### Problem

`onboarding-goal-card.tsx` lines 77–95 render a task list under each expanded
goal. The product decision is to hide this list from the UI temporarily (the
data still flows through to `acceptStructure` unchanged).

### Recommendation

Surgical deletion of the task list block in `onboarding-goal-card.tsx`:

```tsx
// REMOVE this entire block (lines 77-95):
{goal.tasks.length > 0 && (
  <div className='flex flex-col gap-1.5'>
    <span className='text-xs font-medium text-muted-foreground'>
      Tasks ({goal.tasks.length})
    </span>
    <ul className='flex flex-col gap-1'>
      {goal.tasks.map((task, i) => (
        <li
          key={i}
          className='text-xs text-foreground/80 pl-3 border-l border-border/60'
        >
          {task.title}
        </li>
      ))}
    </ul>
  </div>
)}
```

No reducer changes, no type changes, no API changes — `tasks` still populate
`previewData.goals[].tasks` and are sent in `acceptStructure` payload (lines
170–177 of `onboarding-wizard.tsx`). The `OnboardingGoalCard` `Props` interface
keeps `goal: EditableGoal` unchanged.

---

## Security Findings

### Finding 1 — Cookie `secure` flag inconsistency in `features/onboarding/api/onboarding.ts`

`skipOnboarding()` and `acceptStructure()` set cookies with:
```ts
secure: process.env.NODE_ENV === 'production',
```

Elsewhere in the codebase (e.g., `setActiveOrganization`) the pattern is:
```ts
secure: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'production',
```

In a staging environment where `NEXT_PUBLIC_APP_ENV=production` but `NODE_ENV=development`, onboarding cookies are sent without the `Secure` flag — transmittable over HTTP.

**Fix** (low priority, separate commit):
```ts
// features/onboarding/api/onboarding.ts — both cookie set calls
secure: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'production',
```

### Finding 2 — Missing MIME type validation (frontend UX layer)

The `accept='.pdf,.docx,.md,.txt'` attribute is bypassable (users can select "All Files"). The backend has an extension blocklist but no MIME type allowlist. Adding a frontend MIME check provides an early UX warning:

```ts
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
]);

if (!ALLOWED_MIME_TYPES.has(file.type)) {
  toast.error(`"${file.name}" is not a supported file type (PDF, DOCX, MD, TXT)`);
  continue;
}
```

Note: `file.type` is browser-assigned from extension and can be spoofed. This is UX only, not a security gate.

---

## Acceptance Criteria

- [ ] **#1** A "Setup org" link is visible in the dashboard header only when the
  organization has not been onboarded AND the user has previously skipped.
  The link uses `<Link>` from `next/link`. It disappears after successful
  onboarding. Profile Onboarding tab still works and is unaffected.
  No new file is created — logic is inlined into `app/dashboard/layout.tsx`.
- [ ] **#2** The `<input type="file">` has `multiple` attribute. Clicking "Add
  file" opens the OS file picker with multi-select enabled. All selected valid
  files are uploaded in parallel under the same `upload_token`. Files exceeding
  the limit show an individual toast with the filename and are skipped. The
  "Uploading..." / `"Uploading X / Y..."` busy state covers all in-flight
  uploads. Ghost toasts do not appear after component unmount.
- [ ] **#3** The file size error toast includes the filename and uses
  `formatSize(MAX_SIZE_BYTES)` rather than a hardcoded string.
- [ ] **#4** The "Generate structure" button is enabled whenever at least one of
  (description, files, links, template) is non-empty AND the form is not busy.
  Completely empty submissions are prevented.
- [ ] **#5** Expanded goal cards in the Preview step show only Title and
  Description fields. The task list is not rendered. The data is still sent to
  the backend on "Confirm and continue".

---

## Implementation Order

Suggested order for a single PR (from lowest to highest risk):

1. **#5** (delete JSX block — zero risk, verify `__tests__/onboarding-team-member-row.test.tsx` still passes)
2. **#3** (update toast string — trivial)
3. **#4** (replace disabled condition — add `hasAnyInput` derived variable)
4. **#2** (add `multiple`, fan-out loop, fix `.catch()` guard, add upload counter state)
5. **#1** (extend layout's redirect logic, add `<Link>` in header — most structural)

---

## Files to Change

| File | Change |
|---|---|
| `features/onboarding/ui/onboarding-goal-card.tsx` | Remove task list block (#5) |
| `features/onboarding/ui/onboarding-input-step.tsx` | Replace disabled with `hasAnyInput` guard (#4); add `hasAnyInput` derivation or receive as prop |
| `features/onboarding/ui/onboarding-file-upload.tsx` | Add `multiple`, fan-out loop, fix `.catch()` guard, upload counter state, toast message (#2, #3) |
| `app/dashboard/layout.tsx` | Extend redirect logic to derive `showOnboardingCta`, add `<Link>` in header right slot (#1) |

**No new files needed.** The previous plan's `features/organization/ui/onboarding-cta.tsx` is eliminated.

---

## References

### Backend
- `OnboardingLlmBase.php` — reads all pending files by token/userId/orgId
- `StoreOrphanAttachmentRequest.php` — `max:10240` (KB), UUID v4 regex
- `GenerateOrganizationStructureRequest.php` — `description` is nullable, all fields nullable
- `IssueAttachment.php` — `ORPHAN_TTL_HOURS = 24`

### Frontend
- `features/onboarding/ui/onboarding-file-upload.tsx` — current single-file upload, `isMountedRef` pattern
- `features/onboarding/ui/onboarding-input-step.tsx` — button disabled logic (line 214)
- `features/onboarding/ui/onboarding-goal-card.tsx` — task list block (lines 77–95)
- `app/dashboard/layout.tsx` — header structure, onboarding redirect logic (lines 27–39)
- `app/dashboard/profile/layout.tsx` — Profile tab `showOnboarding` prop pattern
- `features/organization/api/organization.ts` — `getOrganization` with `cache()` wrapper
- `features/onboarding/api/onboarding.ts` — `skipOnboarding`/`acceptStructure` cookie setting

### Framework Documentation
- [Next.js fetch deduplication](https://nextjs.org/docs/app/api-reference/functions/fetch)
- [Next.js Suspense / Streaming](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js Link vs a](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [React Server Functions](https://react.dev/reference/rsc/server-functions)
- [React cache()](https://react.dev/reference/react/cache)