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
  required_bot: boolean;
  has_summary: boolean;
}
