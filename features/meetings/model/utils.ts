import type { EventProps } from '@/entities/event';
import type { CalendarEventListItem } from '@/features/meetings/model/types';

/**
 * Maps a CalendarEventListItem to the EventProps shape expected by calendar grid components.
 * @param item - org calendar event item.
 * @returns EventProps.
 */
export function toEventProps(item: CalendarEventListItem): EventProps {
  return {
    id: item.id,
    title: item.title,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    platform: item.platform,
    url: item.url ?? '',
    description: item.description ?? '',
    creator_user_id: item.creator_user_id,
    required_bot: item.required_bot,
    organization_id: item.organization_id,
    has_summary: item.has_summary,
  };
}
