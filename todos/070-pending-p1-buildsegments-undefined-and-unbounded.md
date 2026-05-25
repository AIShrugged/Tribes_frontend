---
status: pending
priority: p1
issue_id: "070"
tags: [code-review, typescript, llm-prompts, performance]
dependencies: [069]
---

# Define `buildSegments()` function with complexity cap for placeholder highlighting

## Problem Statement

The LLM prompts plan calls `buildSegments(debouncedValue, PLACEHOLDER_PATTERN)` inside `HighlightedTextarea` but never defines this function. For a 100k-character prompt, a naive implementation (splitting by regex + mapping to React elements) can produce thousands of React elements, causing slow reconciliation on every debounce tick. The plan must specify the algorithm, define a segment count cap, and document behavior above the cap.

## Findings

- `buildSegments` is called in the plan's implementation sketch but has no definition anywhere
- For 100k chars with 50 placeholder tokens: produces ~101 segments — manageable
- For 100k chars with 1000 placeholder tokens (pathological): produces ~2001 segments — potentially slow
- React reconciliation of 2000+ small `<span>`/`<mark>` elements: benchmarks suggest 10–50ms per render at this scale on mid-range hardware
- The debounce (to be added at 250ms per performance review finding) mitigates keystroke frequency but not per-render cost

## Proposed Solutions

### Option 1: Split-based segments with cap (Recommended)

**Approach:** Build segments by splitting text around regex matches. Cap at 500 segments; above the cap, fall back to unstyled display:

```ts
// features/llm-prompts/lib/placeholders.ts
export interface TextSegment {
  text: string;
  isToken: boolean;
}

const MAX_SEGMENTS = 500;

export function buildSegments(text: string, pattern: RegExp): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(pattern, 'g');
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = re.exec(text)) !== null) {
    if (count >= MAX_SEGMENTS) {
      // Too many tokens — return remainder as plain text
      segments.push({ text: text.slice(lastIndex), isToken: false });
      return segments;
    }
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isToken: false });
      count++;
    }
    segments.push({ text: match[0], isToken: true });
    count++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isToken: false });
  }
  return segments;
}
```

**Pros:** Bounded output; correct for all real prompts; no library needed
**Cons:** Cap is arbitrary (500 segments = ~250 tokens max); above cap, highlighting is disabled
**Effort:** 1 hour
**Risk:** Low

---

### Option 2: Virtualized segments (over-engineered for this use case)

**Approach:** Only render segments that are currently visible in the textarea viewport.

**Pros:** O(viewport) not O(n) rendering
**Cons:** Complex scroll tracking; 4–8 hours implementation; not needed for 31 prompts with reasonable content
**Effort:** Large
**Risk:** Medium

---

### Option 3: CSS Custom Highlight API (future-compatible)

**Approach:** Use `CSS.highlights` API to style ranges directly without DOM nodes. Zero React elements for highlighting.

**Pros:** Zero additional React elements; native performance
**Cons:** Not supported in Firefox < 117; doesn't work on `<textarea>` elements (only `contenteditable` / regular DOM)
**Effort:** Not viable for textarea
**Risk:** High (incompatible with textarea)

## Recommended Action

Option 1 — implement `buildSegments` in `features/llm-prompts/lib/placeholders.ts` with a 500-segment cap. Document the cap with a comment explaining the fallback behavior.

## Technical Details

**Affected files:**
- `features/llm-prompts/lib/placeholders.ts` — add `buildSegments` and `TextSegment` type
- `features/llm-prompts/ui/llm-prompt-form.tsx` — import and use `buildSegments`
- Plan document — update placeholder highlighting section with algorithm definition

**Related:** Depends on #069 (`useDebounce`) for the debounce wrapping the `buildSegments` call.

## Acceptance Criteria

- [ ] `buildSegments(text, pattern)` exported from `features/llm-prompts/lib/placeholders.ts`
- [ ] Returns `TextSegment[]` with `{ text: string; isToken: boolean }` shape
- [ ] Caps at 500 segments; remainder rendered as unstyled plain text above cap
- [ ] No `innerHTML` usage — segments are React children only
- [ ] Unit tests cover: empty string, no tokens, single token, multiple tokens, cap exceeded, pathological input
- [ ] Debounce delay set to 250ms (not 100ms)

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**
- Identified `buildSegments` as undefined in the plan
- Analyzed complexity implications for large prompts
- Proposed capped split-based algorithm

---
