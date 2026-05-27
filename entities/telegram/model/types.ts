export interface TelegramChatRegistration {
  id: number;
  channel_conversation_id: number | null;
  user_id: number | null;
  telegram_chat_id: number;
  message_thread_id: number | null;
  chat_type: 'private' | 'group' | 'supergroup' | null;
  chat_title: string | null;
  topic_label: string | null;
  topic_title: string | null;
  organization_id: number | null;
  team_id: number | null;
  // Always null since the attach-code flow was removed — kept for API contract completeness
  attach_code: string | null;
  attach_command: string | null;
  attach_code_expires_at: string | null;
  attach_code_used_at: string | null;
  is_bound: boolean;
  bound_at: string | null;
  created_at: string;
  updated_at: string;
}
