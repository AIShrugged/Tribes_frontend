---
status: pending
priority: p2
issue_id: '012'
tags: [code-review, typescript, safety, calendar]
dependencies: []
---

# Replace unsafe non-null assertion data!.redirect with safe access

## Problem Statement

The plan proposes `return data!.redirect` in the updated `attachCalendar`
action. While the non-null assertion is logically safe (httpClient throws on
failure, so data is always defined on the success path), it relies on a runtime
invariant that TypeScript cannot verify. This will emit a lint warning and is
against strict TypeScript best practices.

## Findings

`shared/types/common.ts`:

```ts
export interface ApiResponse<T> {
  data?: T; // ← optional, TypeScript sees it as T | undefined
}
```

`shared/lib/httpClient.ts:61`:

```ts
return { data: json.data }; // returns ApiResponse<T>, data is T | undefined at type level
```

Plan proposed code:

```ts
const { data } = await httpClient<{ redirect: string }>(...);
return data!.redirect;  // ← non-null assertion
```

The `!` assertion bypasses the type system. If the backend ever returns
`{ success: true, data: null }`, this would throw a runtime
`TypeError: Cannot read property 'redirect' of null`.

## Proposed Solutions

### Option 1: Nullish coalesce with throw (Recommended)

```ts
const { data } = await httpClient<{ redirect: string }>(url, options);
if (!data?.redirect) {
  throw new Error('Failed to connect Google Calendar. Please try again.');
}
return data.redirect;
```

**Pros:** Type-safe, explicit error on unexpected null, no `!`.  
**Effort:** Trivial  
**Risk:** None

---

### Option 2: Non-null assertion with eslint-disable comment

Keep `data!.redirect` with an explanatory comment. Still relies on runtime
invariant.

**Cons:** Bypasses type system. Bad practice in strict TypeScript project.

---

### Option 3: Update httpClient return type

Change `httpClient` to return `{ data: T }` (non-optional) and throw if data is
null.

This is a larger refactor touching shared code — out of scope for this bug fix.

## Recommended Action

Option 1 — explicit null check with throw. Three lines instead of one, but fully
type-safe.

## Technical Details

**Affected file:**

- `features/calendar/api/calendar.ts` — inside `attachCalendar()` success path

## Acceptance Criteria

- [ ] No `!` non-null assertion in `attachCalendar`
- [ ] TypeScript strict mode passes without `@ts-ignore` or `!`
- [ ] Explicit error thrown if `data` or `data.redirect` is unexpectedly null

## Work Log

### 2026-05-18 - Found during plan review

**By:** Claude Code  
**Actions:** Read ApiResponse type (data is optional). Identified non-null
assertion in plan code. Proposed safe alternative.
