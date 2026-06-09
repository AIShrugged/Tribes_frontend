# WandaAsk Backend Navigator — Agent Memory

## Paths

- Frontend: `/home/anor/projects/WandaAsk_frontend`
- Backend: `/home/anor/projects/spodial_hr_backend` (Laravel 12 / PHP 8.2)

## Backend File Navigation Map

| What you need                     | Where to look                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Route list & HTTP methods         | `routes/api.php` (REST) · `routes/ai.php` (MCP/AI)                               |
| Request params & validation rules | `app/Http/Requests/API/v1/<Name>Request.php`                                     |
| Response field names (Resource)   | `app/Http/Resources/API/v1/<Name>Resource.php` — read `toArray()` method         |
| Response field names (DTO)        | `app/Domain/DTO/<Domain>/<Name>DTO.php` — check controller to know which applies |
| Business logic                    | `app/Services/<Domain>/<Name>Service.php`                                        |
| Domain error codes                | `app/Domain/Errors/` — all `AppException` error code strings                     |
| Models & relations                | `app/Models/<Name>.php`                                                          |
| Enum values (valid strings)       | `app/Enums/<Name>.php` — backed enum cases → TypeScript string union             |
| Agent tools (AI capabilities)     | `app/Services/Agent/Tools/`                                                      |
| Artifact type schemas             | `app/Services/Agent/Tools/CreateArtifactTool.php`                                |

## API Response Envelope

Every endpoint returns:

```ts
interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string;
  status: number;
  meta: Record<string, unknown>;
}
```

Paginated list endpoints additionally return `Items-Count` response header with
total count — use `httpClientList<T>()` on the frontend for these.

## Auth

Laravel Sanctum token. All authenticated requests send
`Authorization: Bearer <token>`. The frontend reads this from cookies via
`getAuthToken()` in `shared/lib/getAuthToken.ts`.

## PHP → TypeScript Type Mapping

| PHP                         | TypeScript                                      |
| --------------------------- | ----------------------------------------------- |
| `int` / `integer`           | `number`                                        |
| `string`                    | `string`                                        |
| `?string`                   | `string \| null`                                |
| `bool`                      | `boolean`                                       |
| `Carbon` / timestamp        | `string` (ISO 8601)                             |
| `array` (indexed)           | `T[]`                                           |
| `array` (assoc / toArray()) | `Record<string, unknown>` or specific interface |
| Backed enum                 | string union: `'value1' \| 'value2'`            |

## Error Handling Pattern

Backend throws `AppException` with a machine-readable `errorCode` string. The
frontend catches `ServerError` (from `httpClient`) and parses it via
`parseApiError()` from `shared/lib/apiError.ts`:

```ts
import { parseApiError } from '@/shared/lib/apiError';
import { ServerError } from '@/shared/lib/errors';

try {
  const { data } = await httpClient<T>(url, options);
  return { data, error: null };
} catch (error) {
  if (error instanceof ServerError) {
    const parsed = parseApiError(error.responseBody ?? '', 'Default message');
    return {
      data: null,
      error: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }
  throw error;
}
```

## MCP Tools (via `wanda-backend` server)

14 tools available at `https://dev-api.shrugged.ai/mcp`:

| Tool                                 | Purpose                                             |
| ------------------------------------ | --------------------------------------------------- |
| `get_user_info`                      | Lookup user by id/email/name — get `profile_id`     |
| `get_user_insights`                  | Full psychological/behavioral profile               |
| `search_meetings`                    | Find meetings by title, date range, participant     |
| `get_meeting_summary`                | AI summary, decisions, key points for a meeting     |
| `get_followup`                       | DISC/360 follow-up assessments after a meeting      |
| `get_tasks`                          | List tasks by meeting or assignee                   |
| `create_task` / `update_task_status` | Task management                                     |
| `get_transcript`                     | Full meeting transcript (expensive — confirm first) |
| `get_team_members`                   | Members of a team by id or name                     |
| `get_relationship_insight`           | Interaction dynamics between two people             |
| `get_extracted_facts`                | Raw AI-extracted facts from transcripts/Telegram    |
| `get_user_short_term_memory`         | Recent memory context for a user                    |
| `get_insight_profile_history`        | Historical insight profile data                     |
