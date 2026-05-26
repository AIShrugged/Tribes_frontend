---
status: pending
priority: p2
issue_id: '074'
tags: [code-review, security, mcp, llm-prompts]
dependencies: []
---

# Restrict MCP `list_llm_prompts` / `get_llm_prompt` to metadata only — full prompt body is unsafe

## Problem Statement

The plan recommends exposing `list_llm_prompts` and `get_llm_prompt` as MCP
tools on the wanda-backend server. These tools return `LlmPromptProps` which
includes the full `prompt` field — the complete AI system instructions. Any
authenticated user who can chat with Wanda can prompt it to call those tools and
read the full system prompt contents. This is an indirect data-exfiltration
path: "What's in your meeting.summary.user prompt?" → Wanda calls
`get_llm_prompt` → full system prompt appears in chat.

## Findings

- MCP tools have no role-based access control at the tool-invocation layer in
  the current architecture
- `LlmPromptProps.prompt` contains complete system prompt text (potentially
  thousands of tokens of proprietary AI instructions)
- The existing backend `HrServer.php` MCP tools don't check org member role —
  any authenticated user can call them
- Backend MCP endpoint: `GET https://dev-api.shrugged.ai/mcp` with Sanctum token
- Exposing read tools without restricting the `prompt` field creates a
  self-exfiltration path

## Proposed Solutions

### Option 1: Expose metadata only — exclude `prompt` field from MCP response (Recommended)

**Approach:** When adding `list_llm_prompts` and `get_llm_prompt` to the backend
MCP server, return only `{ id, slug, name, group, updated_at }` — exclude the
`prompt` field. Wanda can answer "what prompts exist?" and "when was the meeting
summary last updated?" without revealing the instructions.

**Pros:** Safely enables agent-native discovery without self-exfiltration risk
**Cons:** Slightly less powerful for admin debugging via chat **Effort:**
Backend team: 1 hour (new slimmed resource or field exclusion) **Risk:** Low

---

### Option 2: Restrict MCP prompt tools to manager role

**Approach:** Add a policy check in the backend MCP handler so only managers can
call `get_llm_prompt` (with full body). Employees get metadata only.

**Pros:** Managers can still debug prompts via Wanda chat; employees see
metadata only **Cons:** Backend MCP layer currently has no role-based tool
filtering — requires new infrastructure **Effort:** Large (backend MCP
role-based filtering is not implemented) **Risk:** Medium

---

### Option 3: Don't expose MCP tools at all for now

**Approach:** Remove the agent-native recommendation from the plan entirely
until the backend can safely implement it.

**Pros:** Zero risk; simplest **Cons:** Loses the agent-native parity benefit
**Effort:** 0 (skip backend work) **Risk:** Low

## Recommended Action

Option 1 — expose metadata-only MCP tools as a backend ticket. Flag this to the
backend team before any MCP tool additions. The frontend plan itself doesn't
need to change, but the backend MCP implementation specification must exclude
the `prompt` field.

## Technical Details

**Affected systems:** Backend Laravel MCP server
(`app/Mcp/Servers/HrServer.php`) **Not a frontend code change** — this is a
backend implementation note for when the MCP tools are added.

## Acceptance Criteria

- [ ] MCP `get_llm_prompt` response does NOT include the `prompt` text field
- [ ] MCP `list_llm_prompts` response returns `{ id, slug, name, updated_at }`
      only
- [ ] Backend team is aware of the exfiltration risk before implementing MCP
      tools

## Work Log

### 2026-05-25 - Discovered during plan security review

**By:** Claude Code

**Actions:**

- Identified indirect exfiltration path via MCP tool + chat
- Proposed metadata-only response as mitigation
- Flagged as backend coordination required

---
