export interface TelegramWorkspaceChatCreatePayload {
  telegram_chat_id: number;
  message_thread_id: number | null;
  organization_id: number;
  team_id: number | null;
  name: string | null;
}
