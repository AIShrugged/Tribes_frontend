---
status: pending
priority: p2
issue_id: '077'
tags: [code-review, simplicity, llm-prompts, dependencies]
dependencies: []
---

# Remove `diff-match-patch` dependency — word-level diff for Reset is over-engineering

## Problem Statement

The deepened plan recommends adding `diff-match-patch` (12 KB) to show a
word-level diff of what will change when resetting a prompt to its system
default. This is unnecessary: the Reset action simply replaces the current value
with the system default. The manager can see the current value in the textarea.
Rather than a dependency + complex diff UI, a simple two-panel "current vs.
default" preview (or even just a standard two-step confirmation) achieves the
same goal with zero added complexity.

## Findings

- Plan: "Show diff: word-level additions in green, deletions in red" using
  `diff-match-patch`
- The reset action fires `POST /llm-prompts/{id}/reset` which returns the system
  default value
- The current value is already visible in the form textarea
- The "default" value can be fetched in advance or shown after reset
- `diff-match-patch` adds 12 KB to the client bundle for a rarely-used admin
  feature
- This is an admin-only page used by org managers — they are power users who
  don't need a visual diff to understand a reset operation

## Proposed Solutions

### Option 1: Two-step confirm with plain text preview (Recommended)

**Approach:** Remove all diff logic. Replace with:

```
"Reset this prompt to its system default?
This will overwrite your current customizations."
[Confirm Reset]  [Cancel]
```

After reset, the form repopulates with the server-returned default. The manager
can see what changed by comparing the before/after states.

**Pros:** Zero dependencies; simple; appropriate for the use case **Cons:** No
inline visual of what changed before confirming **Effort:** 0 (no additional
work) **Risk:** Low

---

### Option 2: Show default value as read-only preview (no diff)

**Approach:** Fetch the system default text (via a backend endpoint that returns
the compiled default, if available) and show it in a read-only `<pre>` block
below the confirmation:

```
"System default:"
[read-only prompt text displayed here]
[Confirm Reset]  [Cancel]
```

**Pros:** Manager can see the default before confirming; no diff complexity
**Cons:** Requires an additional backend endpoint or pre-loading the default at
page load **Effort:** Medium (backend coordination) **Risk:** Low

## Recommended Action

Option 1 — remove the diff entirely. Use a standard two-step inline confirmation
(already in the plan). Do not add `diff-match-patch`. If a diff view is ever
requested explicitly by users, add it then.

## Technical Details

**Affected files:**

- Plan document — update Reset to Default section
- `features/llm-prompts/ui/llm-prompt-form.tsx` — no diff import
- `package.json` — do NOT add `diff-match-patch`

## Acceptance Criteria

- [ ] No `diff-match-patch` in `package.json`
- [ ] Reset confirmation is a simple two-step inline confirm (no diff rendering)
- [ ] After reset, form repopulates with server-returned default values

## Work Log

### 2026-05-25 - Discovered during plan simplicity review

**By:** Claude Code

**Actions:**

- Identified diff-match-patch as over-engineering for admin reset UX
- Proposed plain confirmation as sufficient

---
