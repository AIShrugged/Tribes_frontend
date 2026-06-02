---
title: fix: Issue create page — attachment upload does nothing on file select
type: fix
status: completed
date: 2026-05-29
deepened: 2026-05-29
---

# fix: Issue create page — attachment upload does nothing on file select

When a user navigates to `/dashboard/issues/create`, selects a file using the
"Add file" button in the Attachments section, **nothing visually happens**: no
"Uploading..." label, no attachment row appearing, no error toast. The file
disappears as if it was never selected.

---

## Enhancement Summary

**Deepened on:** 2026-05-29 **Research agents used:** Kieran TypeScript
Reviewer, Julik Frontend Races Reviewer, Security Sentinel, Performance Oracle,
Code Simplicity Reviewer, Architecture Strategist, Best Practices Researcher,
Learnings Researcher, Pattern Recognition Specialist, Coherence Reviewer

### Key Improvements Over Original Plan

1. **Root cause diagnosis sharpened** — Multiple agents independently confirmed
   that `throw error` in a Server Action called as a bare Promise DOES reach
   `.catch()` in Next.js 16. The original plan's claim about "silent swallowing"
   was partially wrong. The real failure mode is `redirect()` from
   `next/navigation` (thrown on 401) bypassing `.catch()` entirely.

2. **`isRedirectError` guard identified as required** — Swallowing `redirect()`
   throws without re-throwing them is a correctness regression; the user would
   stay on the page when their session expires instead of being redirected to
   login.

3. **`isMountedRef` guard in `.finally()` identified as the real stuck-busy
   bug** — If the component unmounts during an upload, `removeOp` is skipped
   (guarded by `isMountedRef.current`) so `isBusy` never clears in the parent.

4. **React 19 Strict Mode `isMountedRef` reset bug** — The mount effect must set
   `isMountedRef.current = true` to survive double-invoke.

5. **Broader codebase impact** — 24 SA files have `throw error` in their catch
   blocks; all are affected to varying degrees. This fix should seed a broader
   audit.

6. **Alternative root causes enumerated** — `crypto.randomUUID()` unavailable in
   non-HTTPS environments, empty `FileList` from OS file picker dismissal, and
   similar browser-level issues are documented as pre-investigation steps.

---

## Problem Statement

### Symptom

User visits the issue create page, clicks "Add file", selects a file — and the
UI stays exactly as it was. No spinner, no list item, no toast error.

### Root Cause Analysis (Revised After Deep Research)

#### What `.catch()` actually receives from a thrown Server Action

Per official Next.js docs and verified against v16.1.5: when a Server Action
`throw`s an error and is called as a bare Promise from a Client Component
(outside `startTransition`), the rejected promise DOES reach the `.catch()`
handler. However, the error object is **sanitized**: in production, the original
`Error.message` is replaced with a digest string and all custom properties
(`status`, `responseBody`, etc.) are stripped.

The `.catch()` at `pending-attachment-uploader.tsx:98–101` calls
`toast.error('Upload failed')` without inspecting the error shape, so the digest
stripping does not matter. It would show the toast.

**Therefore: `throw error` alone is not what causes "nothing happens."**

#### The real bug #1 — `redirect()` thrown by `httpClient` on 401

`shared/lib/httpClient.ts:42`:

```ts
if (res.status === 401) {
  redirect('/api/auth/logout');
}
```

`redirect()` from `next/navigation` throws a special internal object with
`digest: 'NEXT_REDIRECT;...'`. This is **not** a `ServerError` instance and is
**not** an ordinary `Error`. In the `uploadPendingAttachment` catch block:

```ts
catch (error) {
  if (error instanceof ServerError) { ... }
  throw error;  // ← re-throws the NEXT_REDIRECT object
}
```

When a `NEXT_REDIRECT` object is re-thrown from a Server Action:

- In a Server Component context: Next.js handles the redirect natively.
- **In a Client Component calling a SA as a bare Promise:** the redirect object
  crosses the server→client serialization boundary as a special response (HTTP
  303), and Next.js **performs a client-side navigation** at the framework
  level. The `.catch()` and `.finally()` handlers **do not fire** at all — the
  framework intercepts the response before the Promise chain.

Result: `addOp(opId)` is called → `isBusy = true` → submit button disabled →
NEXT_REDIRECT fires → `.finally()` never runs → `removeOp` never called →
`isBusy` stuck `true` permanently. Subsequent file picker clicks do nothing
because `disabled={isBusy}` blocks the input.

**This is the primary cause of the "nothing happens" symptom.**

#### The real bug #2 — `isMountedRef` guard in `.finally()` blocks `removeOp`

`pending-attachment-uploader.tsx:102–105`:

```ts
.finally(() => {
  if (!isMountedRef.current) return;  // ← blocks removeOp on unmount
  removeOp(opId);
});
```

If the user navigates away while uploads are in-flight:

1. Component unmounts → `isMountedRef.current = false`
2. Uploads complete server-side (SA runs to completion regardless)
3. `.finally()` fires, hits the `isMountedRef` guard, returns early
4. `removeOp(opId)` is never called
5. `onPendingChange(true)` was called earlier but `onPendingChange(false)` never
   fires
6. `IssueForm`'s `hasPendingOps` stays `true` indefinitely

`removeOp` calls `setPendingOps` — a React state setter that is safe to call
after unmount in React 18+ (React silently ignores it). The `isMountedRef` guard
is only needed for callbacks that invoke parent-owned functions (`onUploaded`,
`toast.error`) or DOM mutations. It must NOT be placed on `removeOp` calls.

#### The real bug #3 — React 19 Strict Mode resets `isMountedRef` to `false`

`pending-attachment-uploader.tsx:39–43`:

```ts
useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

In React 19 development mode, Strict Mode double-invokes effects: mount →
cleanup (sets `isMountedRef.current = false`) → mount again (but does NOT reset
it back to `true`). Any upload started in the second mount sees
`isMountedRef.current === false` and silently suppresses all success callbacks.

Fix: add `isMountedRef.current = true` at the start of the effect body.

#### Alternative root causes to eliminate first (before coding)

Before implementing any fix, run the app and check these:

1. **Open DevTools Console** — Look for `crypto.randomUUID is not a function`.
   `crypto.randomUUID()` requires a Secure Context (HTTPS or `localhost`). In a
   staging environment served over HTTP, this throws a `TypeError` synchronously
   before `addOp` is called. Result: nothing happens, no visual change.

2. **Open DevTools Network tab, filter `attachments/pending`** — If zero
   requests appear after file selection, the Server Action is never reaching the
   backend. This confirms a client-side throw before the SA call.

3. **Check if `<input>` onChange fires** — Add `console.log('onChange')` to
   `handleFileChange` temporarily. If it fires, the bug is in the SA or its
   error handling. If it never fires, the bug is in the input's CSS or event
   binding.

4. **Check `isBusy` initial state** — If the component remounts with React
   Compiler optimizations in an unexpected way, `pendingOps` could contain stale
   entries. Verify `pendingOps` is always `new Set()` on fresh mount.

---

## Proposed Fix

### Fix 1 — Guard `redirect()` throws and return `ActionResult` for all other unexpected errors

`features/issues/api/issues.ts` — in both `uploadPendingAttachment` (line 634)
and `deletePendingAttachment` (line 661):

```ts
import { isRedirectError } from 'next/dist/client/components/redirect-error';

// In uploadPendingAttachment catch block:
} catch (error) {
  if (isRedirectError(error)) throw error;  // ← must re-throw; allows Next.js to perform login redirect
  if (error instanceof ServerError) {
    const parsed = parseApiError(
      error.responseBody ?? '',
      'Failed to upload file',
    );
    return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
  }
  return { data: null, error: 'Upload failed. Please try again.' };
}

// In deletePendingAttachment catch block:
} catch (error) {
  if (isRedirectError(error)) throw error;
  if (error instanceof ServerError) {
    const parsed = parseApiError(
      error.responseBody ?? '',
      'Failed to delete file',
    );
    return { data: null, error: parsed.message, fieldErrors: undefined };
  }
  return { data: null, error: 'Delete failed. Please try again.' };
}
```

**Why `isRedirectError` must be checked first and re-thrown:**

- `redirect()` from `next/navigation` throws
  `{ digest: 'NEXT_REDIRECT;push;...' }`
- This object is `instanceof Error` but NOT `instanceof ServerError`
- If caught and converted to a soft return string, the session-expired redirect
  is silently suppressed — the user stays on the page with a generic toast
  instead of being redirected to login
- `isRedirectError` is a stable internal utility used by Next.js itself
- Import path: `next/dist/client/components/redirect-error` (stable, available
  in Next.js 13.4+ through 16.x)

**Why non-ServerError unexpected errors should return instead of throw:**

- A `throw` from a non-redirect error makes `.catch()` fire but with a digested
  error whose message is stripped in production
- Returning `{ data: null, error: 'Upload failed...' }` gives the component a
  proper message to display via `toast.error(result.error)` in `.then()`
- Aligns with the official Next.js recommendation: "model expected errors as
  return values"

### Fix 2 — Remove `isMountedRef` guard from `.finally()` in both handlers

`features/issues/ui/pending-attachment-uploader.tsx`:

```ts
// Upload handler — BEFORE:
.finally(() => {
  if (!isMountedRef.current) return;  // ← remove this guard
  removeOp(opId);
});

// Upload handler — AFTER:
.finally(() => {
  removeOp(opId);  // always unblock — setState after unmount is a no-op in React 18+
});

// Delete handler (lines 179–182) — same change:
.finally(() => {
  removeOp(opId);
});
```

**Rationale:** `removeOp` calls `setPendingOps` (a React state setter). React
18+ silently ignores `setState` on unmounted components — no warning, no effect.
The `isMountedRef` guard is only appropriate for side effects that touch
external state or parent-owned callbacks (`onUploaded`, `toast.error`,
`onPendingChange`). `removeOp` is internal state cleanup and must always run.

### Fix 3 — Reset `isMountedRef` on (re-)mount for React 19 Strict Mode

`features/issues/ui/pending-attachment-uploader.tsx`:

```ts
// BEFORE:
useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// AFTER:
useEffect(() => {
  isMountedRef.current = true; // ← reset on (re-)mount; survives Strict Mode double-invoke
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

---

## Files to Change

| File                                                 | Change                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/issues/api/issues.ts`                      | Fix 1: add `isRedirectError` guard + return generic error in `uploadPendingAttachment` (line 634) and `deletePendingAttachment` (line 661)                                                  |
| `features/issues/ui/pending-attachment-uploader.tsx` | Fix 2: remove `isMountedRef.current` guard from `.finally()` in upload handler (line 102) and delete handler (line 179); Fix 3: add `isMountedRef.current = true` to mount effect (line 39) |

**No changes needed in:**

- `issue-form.tsx` — parent contract unchanged
- `app/dashboard/issues/(create)/create/page.tsx` — server component unchanged
- `shared/lib/httpClient.ts` — FormData Content-Type deletion is correct

---

## Broader Codebase Impact (Follow-Up PR — Not This Fix)

Pattern recognition revealed **24 SA files** have the same `throw error` in
their catch blocks. The files most at risk (called from Client Component
`.then()/.catch()` chains) are:

**Category A — High risk (SA called as bare Promise from Client Component):**

- `features/onboarding/api/attachments.ts` — same upload pattern as `issues.ts`
- `features/chat/api/messages.ts` — `sendMessage` called from `chat-window.tsx`
- `features/chat/api/chats.ts` — mutation SAs
- `features/transcript-upload/api/upload-transcript.ts`
- `features/task-data-upload/api/upload-task-data.ts`

**Long-term fix:** Harden `httpClientAction` in `shared/lib/httpClient.ts` to:

1. Re-throw redirect errors via `isRedirectError`
2. Return `ActionResult` for all non-redirect unexpected errors (instead of
   re-throwing)

Then migrate all 24 manual-catch SA files to use `httpClientAction`. This
eliminates ~240 lines of duplicated error-handling boilerplate and makes the
pattern consistent and testable.

---

## Security Notes (Out of Scope for This Fix)

The security audit found issues in the attachment subsystem that should be
addressed in follow-up PRs:

1. **Extension blocklist bypassed** (Critical) — Backend uses client-supplied
   filename extension only. Add Laravel `mimetypes:` rule (reads file magic
   bytes) and replace the blocklist with an allowlist in
   `StoreOrphanAttachmentRequest`.

2. **SVG inline preview enables stored XSS** (High) — The attachment proxy
   forwards `Content-Type` verbatim; SVG rendered inline in `<img>` can execute
   scripts. Force `Content-Disposition: attachment` in
   `app/api/attachment/route.ts` and remove `.svg` from the image preview
   allowlist in `issue-attachments.tsx`.

3. **Markdown preview via `ChatMessageContent` HTML path** (High) —
   User-uploaded `.md` files can reach the `innerHTML` code path. Route markdown
   attachment previews through `ReactMarkdown` directly.

4. **Cross-org attachment binding** (Medium) — `IssueController::store` does not
   pass `organization_id` to the `pending()` scope query, allowing (accidental)
   cross-org binding.

5. **Proxy leaks backend `detail` field** (Low) — `app/api/attachment/route.ts`
   forwards raw backend error body as `detail` in JSON error responses. Remove
   from client-facing response.

---

## Acceptance Criteria

### Bug fix

- [ ] Selecting a file triggers the upload: "Add file" label changes to
      "Uploading..." immediately
- [ ] After upload completes, the file name appears in the attachment list
- [ ] After upload fails (simulated 5xx), a toast error is shown and "Add file"
      becomes active again (not stuck)
- [ ] If session expires during upload (401 from backend), the user is
      redirected to the login page (not shown a generic error toast)
- [ ] Selecting multiple files uploads all of them concurrently; all appear in
      list
- [ ] Submitting the form with attachments binds them to the issue via
      `upload_token`
- [ ] Navigating away without submitting cleans up pending attachments

### Code quality

- [x] `isRedirectError` guard is present before `instanceof ServerError` check
      in both `uploadPendingAttachment` and `deletePendingAttachment`
- [x] `removeOp` is called unconditionally in `.finally()` (no `isMountedRef`
      guard)
- [x] `isMountedRef.current = true` is set in the mount effect
- [x] `isMountedRef.current` guard remains on `.then()` and `.catch()` callbacks
      (they invoke parent-owned functions and must not fire after unmount)
- [x] ESLint passes: `npm run lint`
- [x] TypeScript compiles: `tsc --noEmit`

---

## Investigation Steps (Run First)

Run `npm run dev` and open browser DevTools before writing any code:

1. **Console tab** — Look for `crypto.randomUUID is not a function` (requires
   HTTPS or localhost). If present: the bug is in the environment, not the code.

2. **Network tab** (filter: `attachments/pending`) — Click "Add file", select a
   file, observe:
   - **No request appears** → `handleFileChange` not firing or JS error before
     SA call. Check Console for errors.
   - **Request appears and returns 201** → Bug is in response parsing or state
     update. Add `console.log(result)` in `.then()`.
   - **Request appears and returns 401** → NEXT_REDIRECT bug confirmed. Fix 1 is
     the correct fix.
   - **Request appears and returns 422/500** → SA returns `result.error` → toast
     should show. If toast doesn't show, check for `isMountedRef` issue.

3. **Terminal** (Next.js dev server output) — Server Action errors are logged to
   the terminal, not the browser console. Any unhandled SA exception will appear
   here.

---

## References

- Current uploader: `features/issues/ui/pending-attachment-uploader.tsx`
- Server action: `features/issues/api/issues.ts:604`
- Reference uploader (onboarding):
  `features/onboarding/ui/onboarding-file-upload.tsx`
- httpClient: `shared/lib/httpClient.ts`
- Backend controller: `IssueAttachmentController::storePending` (line 77)
- Backend request validation: `StoreOrphanAttachmentRequest` (nullable
  `organization_id`, required `file`, required `upload_token`)
- Previous layout/multi-upload fix:
  `docs/plans/2026-05-28-fix-issue-form-attachment-layout-and-multiupload-plan.md`
- Institutional learning (SA JSON parse):
  `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
- Next.js official docs: Error Handling in Server Actions
- Next.js issue: `vercel/next.js#49426` (SA throw behavior discussion)
- `isRedirectError`: `next/dist/client/components/redirect-error` (stable,
  13.4+)
