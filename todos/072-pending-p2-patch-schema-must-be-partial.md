---
status: pending
priority: p2
issue_id: '072'
tags: [code-review, typescript, zod, llm-prompts]
dependencies: []
---

# Fix `llmPromptUpdateSchema` — PATCH endpoint requires partial fields

## Problem Statement

The plan defines `llmPromptUpdateSchema` with both `name` and `prompt` as
required fields (`.min(1)`). But the backend PATCH endpoint accepts either field
as optional (partial update). Deriving
`LlmPromptUpdatePayload = z.infer<typeof llmPromptUpdateSchema>` produces a type
where both fields are required — this misrepresents the API contract and forces
the form to always provide both fields, even if only one changed.

## Findings

- Backend `LlmPromptRequest` validation: `name?: string` (optional),
  `prompt?: string` (optional)
- Backend controller uses `array_filter` to apply only provided fields
- Plan schema:
  `z.object({ name: z.string().min(1)..., prompt: z.string().min(1)... })` —
  both required
- `z.infer<>` of this schema produces `{ name: string; prompt: string }` — no
  optionality
- The edit form always sends both fields (since both inputs are present), so
  this doesn't break the form UX — but it's a type contract lie that matters if
  partial updates are ever sent programmatically

## Proposed Solutions

### Option 1: Keep schema as-is for form use, add a separate partial type (Recommended)

**Approach:** The form always sends both fields anyway (both inputs rendered).
Keep the form schema strict for validation. Define a separate type for the API
payload:

```ts
// For form validation (both fields always present in the form)
export const llmPromptUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Max 255 characters'),
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(100_000, 'Prompt too long'),
});

// For the API call (matches backend PATCH semantics)
export type LlmPromptUpdatePayload = Partial<
  z.infer<typeof llmPromptUpdateSchema>
>;
```

**Pros:** Form validation remains strict; API type is accurate **Cons:** Two
types for related concepts **Effort:** 15 minutes **Risk:** Low

---

### Option 2: Use `.partial()` on the schema

**Approach:**

```ts
export const llmPromptUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    prompt: z.string().min(1).max(100_000).optional(),
  })
  .refine((d) => d.name !== undefined || d.prompt !== undefined, {
    message: 'At least one field must be provided',
  });
export type LlmPromptUpdatePayload = z.infer<typeof llmPromptUpdateSchema>;
```

**Pros:** Single schema; derives accurate type; prevents empty submits **Cons:**
Adds a `.refine()` that adds complexity for a form that always has both fields
**Effort:** 20 minutes **Risk:** Low

## Recommended Action

Option 1 for simplicity — form schema stays strict (both fields always present),
API payload type is `Partial<...>` which accurately reflects the backend
contract.

## Technical Details

**Affected files:**

- `features/llm-prompts/model/schemas.ts`

## Acceptance Criteria

- [ ] `LlmPromptUpdatePayload` allows optional `name` and optional `prompt`
- [ ] Form validation still requires both fields when both are rendered
- [ ] TypeScript does not flag the `updateLlmPrompt(payload)` call as incorrect

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**

- Verified backend accepts partial fields
- Identified type mismatch between form schema and API contract

---
