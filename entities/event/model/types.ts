export interface EventProps {
  id: number;
  platform: string;
  url: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  creator_user_id: number;
  required_bot: boolean;
  /**
   * Organization the recording bot was connected from, or null when the bot is
   * not connected. This is "which org the bot belongs to", NOT "which org the
   * calendar belongs to". Drives the org calendar and the "→ Organization X" badge.
   */
  organization_id: number | null;
  has_summary: boolean;
}

export interface CalendarEventListItem {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  platform: string;
  url?: string | null;
  description: string | null;
  creator_user_id: number;
  required_bot: boolean;
  /** Org the bot was connected from (null when not connected). See {@link EventProps.organization_id}. */
  organization_id: number | null;
  has_summary: boolean;
}
