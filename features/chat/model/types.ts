/** Single chat conversation as returned by GET /api/v1/chats and related endpoints */
export interface Chat {
  id: number;
  title: string | null;
  organization_id: number | null;
  team_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatUpsertDTO {
  title: string | null;
  organization_id: number | null;
  team_id: number | null;
}

export type MessageStatus =
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed';

/** A single message within a chat as returned by the messages sub-resource */
export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  status: MessageStatus | null;
  content: string;
  followup_data: unknown | null;
  error_message: string | null;
  failure_code: string | null;
  agent_run_uuid: string | null;
  current_attempt: number | null;
  max_attempts: number | null;
  completed_at: string | null;
  next_retry_at: string | null;
  created_at: string;
}

/** Response from GET /api/v1/chats/{chat}/runs/{runUuid} */
export interface AgentRun {
  agent_run_uuid: string;
  chat_id: number;
  message_id: number;
  status: MessageStatus;
  progress_percent: number;
  current_step_label: string | null;
  error_message: string | null;
  failure_code: string | null;
  current_attempt: number;
  max_attempts: number;
  completed_at: string | null;
  next_retry_at: string | null;
  message: {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  };
}

// ─── Artifacts ────────────────────────────────────────────────────────────────
// Artifact types are defined in entities/artifact/model/types.ts (canonical).
// Re-exported here for backward compatibility with existing feature code.

export type {
  Artifact,
  ArtifactStatus,
  ArtifactType,
  ArtifactsResponse,
  ChartArtifact,
  ChartType,
  DecisionEntry,
  DecisionLogArtifact,
  InsightCardArtifact,
  MeetingCardArtifact,
  PeopleListArtifact,
  TaskTableArtifact,
  TranscriptArtifact,
} from '@/entities/artifact/model/types';

export interface PageContext {
  page_text?: string;
  page_title?: string;
  page_url?: string;
}
