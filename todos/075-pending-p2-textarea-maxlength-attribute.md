---
status: pending
priority: p2
issue_id: "075"
tags: [code-review, security, llm-prompts, forms]
dependencies: []
---

# Add `maxLength={100_000}` to prompt textarea as native HTML enforcement

## Problem Statement

The Zod schema enforces `.max(100_000)` on the `prompt` field, but validation only fires on form submit. The textarea itself has no `maxLength` attribute. A user (or programmatic submit bypass) can silently type beyond the limit without feedback. Adding `maxLength` as a native HTML attribute provides a second enforcement layer that the browser handles before Zod runs, and gives immediate user feedback at the character limit.

## Findings

- Plan's Zod schema: `z.string().min(1).max(100_000)` — correct
- Plan's `HighlightedTextarea` sketch: `<textarea ... />` — no `maxLength` prop
- Native `maxLength` prevents input beyond the limit in real-time (no keypress beyond cap)
- Provides a first line of defense that doesn't require JavaScript to run

## Proposed Solutions

### Option 1: Add `maxLength` prop to `HighlightedTextarea` (Recommended)

```tsx
<textarea
  ref={textareaRef}
  value={value}
  onChange={onChange}
  disabled={disabled}
  maxLength={100_000}
  className="..."
/>
```

Also consider showing a character count near the limit:
```tsx
{value.length > 90_000 && (
  <span className="text-xs text-amber-400">
    {value.length.toLocaleString()} / 100,000 characters
  </span>
)}
```

**Pros:** Browser enforces before Zod; one-line fix; standard HTML practice
**Cons:** None
**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

Option 1 — add `maxLength={100_000}` to the textarea element. Optionally add a near-limit character counter for UX.

## Technical Details

**Affected files:**
- `features/llm-prompts/ui/llm-prompt-form.tsx` — `HighlightedTextarea` component

## Acceptance Criteria

- [ ] `<textarea maxLength={100_000}>` in `HighlightedTextarea`
- [ ] Browser prevents input beyond 100,000 characters
- [ ] Near-limit indicator shown when `value.length > 90_000`

## Work Log

### 2026-05-25 - Discovered during plan security review

**By:** Claude Code

**Actions:**
- Identified missing `maxLength` enforcement at textarea level
- One-line fix identified

---
