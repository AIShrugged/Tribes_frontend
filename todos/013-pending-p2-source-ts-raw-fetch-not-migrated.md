---
status: pending
priority: p2
issue_id: '013'
tags: [code-review, httpclient, conventions, calendar, source]
dependencies: []
---

# Migrate source.ts raw fetch calls to httpClient (missed by plan)

## Problem Statement

The plan migrates `attachCalendar` in `calendar.ts` from raw `fetch` to
`httpClient` (per CLAUDE.md Rule 2). However, `features/calendar/api/source.ts`
also uses raw `fetch` for `getSources()`, `detachCalendar()`, and
`detachCalendarFromProfile()`. These are untouched by the plan, creating an
inconsistency in the same feature's api/ directory.

CLAUDE.md Rule 2 is unambiguous: "Do not call `fetch(...)` directly. Use the
clients from `@/shared/lib/httpClient`."

## Findings

`features/calendar/api/source.ts`:

- `getSources()` line 19: `const res = await fetch(...)` — raw fetch, no
  httpClient
- `detachCalendar()` line 43: `const res = await fetch(...)` — raw fetch
- `detachCalendarFromProfile()` line 72: `const res = await fetch(...)` — raw
  fetch

All three also use `getAuthHeaders()` manually, which `httpClient` handles
automatically.

The plan only migrates `calendar.ts` (attachCalendar), leaving `source.ts` in
violation.

## Proposed Solutions

### Option 1: Migrate source.ts in this same PR (Recommended)

Since we're already touching the calendar feature api files, migrating source.ts
is low-risk and creates a clean, consistent state.

```ts
// getSources — migrate to httpClientList (list endpoint)
export async function getSources(): Promise<Source[]> {
  const { data } = await httpClient<Source[]>(`${API_URL}/sources`);
  return data ?? [];
}

// detachCalendar — migrate to httpClient + catch ActionResult pattern
export async function detachCalendar(sourceId: number): Promise<ActionResult> {
  try {
    await httpClient(`${API_URL}/sources/${sourceId}`, { method: 'DELETE' });
    revalidatePath(ROUTES.DASHBOARD.CALENDAR, 'layout');
    revalidatePath(ROUTES.DASHBOARD.PROFILE, 'layout');
    redirect(ROUTES.DASHBOARD.CALENDAR);
  } catch (error) {
    if (error instanceof ServerError) {
      return {
        data: null,
        error: 'Failed to disconnect Google Calendar. Please try again.',
      };
    }
    throw error;
  }
}
```

Note: `redirect()` throws internally (Next.js throws NEXT_REDIRECT). This should
be re-thrown, not caught by ServerError handler. Use `isRedirectError` from
`next/dist/client/components/redirect-error` or restructure.

**Pros:** Consistent. Follows CLAUDE.md. Source.ts tests also need updating.  
**Effort:** Small-Medium (need to handle redirect() carefully)  
**Risk:** Low — same pattern used elsewhere

---

### Option 2: Create separate cleanup PR for source.ts

Defer source.ts migration to a follow-up. This PR only adds `organization_id`.

**Pros:** Smaller diff. Faster to review.  
**Cons:** Leaves known violation. Source.ts and calendar.ts in same feature,
inconsistent patterns.  
**Effort:** None now  
**Risk:** Low (violation already exists)

## Recommended Action

Option 2 is acceptable for a bug-fix PR. Option 1 is preferred for cleanliness.
Decision depends on PR scope vs velocity tradeoff.

If choosing Option 1, add a separate todo for source.ts migration with careful
handling of redirect() vs ServerError.

## Technical Details

**Affected files:**

- `features/calendar/api/source.ts` — getSources, detachCalendar,
  detachCalendarFromProfile
- `features/calendar/api/__tests__/source.test.ts` — update mocks if migrated

**Complexity note:** `detachCalendar` uses `redirect()` which Next.js implements
by throwing a special error internally. When wrapping in try/catch, must either
re-throw redirect errors or restructure to call redirect() outside the try
block.

## Acceptance Criteria

- [ ] All api/ files in `features/calendar/api/` use `httpClient` (or
      `httpClientList`)
- [ ] No direct `fetch()` calls in `features/calendar/api/`
- [ ] Tests updated to mock `httpClient` not `globalThis.fetch`

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Read source.ts. Found 3 raw fetch calls. Noted inconsistency with
plan's migration of calendar.ts. Flagged for decision.
