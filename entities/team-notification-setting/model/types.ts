import type { TelegramChatRegistration } from '@/entities/telegram';

export interface TeamNotificationSetting {
  id: number;
  team_id: number;
  event_type: string;
  channel_type: string;
  notifiable: {
    type: string;
    id: number;
    data: TelegramChatRegistration | null;
  } | null;
  enabled: boolean;
  minutes_before: number | null;
  created_at: string;
  updated_at: string;
}

export interface TeamNotificationSettingCreateDTO {
  event_type: string;
  channel_type: string;
  telegram_chat_registration_id?: number | null;
  enabled?: boolean;
}

export interface TeamNotificationSettingUpdateDTO {
  enabled: boolean;
  minutes_before?: number | null;
}

/** Telegram notification event the user can route to chat(s). */
export interface NotificationEventType {
  /** Backend event_type string. */
  value: string;
  label: string;
  /** Short "what is this notification about" help text (R3). */
  description: string;
  /** Whether this event supports a configurable lead time (minutes before the meeting). */
  hasMinutesBefore: boolean;
  /** Backend default lead time used when minutes_before is unset (per-event; mirrors backend). */
  defaultMinutesBefore?: number;
}

/**
 * Notifications exposed in the Telegram → Notifications matrix.
 * `meeting_tasks` is intentionally absent — its backend listener is dead.
 * Mirrors TeamNotificationSettingRequest::ALLOWED_EVENT_TYPES on the backend.
 */
export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  {
    value: 'meeting_summary',
    label: 'Meeting summary',
    description:
      'Post-meeting recap: key points, decisions, tasks, and detected conflicts.',
    hasMinutesBefore: false,
  },
  {
    value: 'meeting_review',
    label: 'Meeting review',
    description:
      'Meeting evaluation: score, key insight, and improvement suggestions.',
    hasMinutesBefore: false,
  },
  {
    value: 'meeting_agenda',
    label: 'Meeting agenda',
    description:
      'Pre-meeting agenda: goal, discussion topics, and a review of previous commitments.',
    hasMinutesBefore: true,
    defaultMinutesBefore: 60, // GenerateAgendaCommand: minutes_before ?? 60
  },
  {
    value: 'pre_meeting_brief',
    label: 'Meeting reminder',
    description:
      'Pre-meeting brief: attendees, previous notes, open tasks, and deadlines.',
    hasMinutesBefore: true,
    defaultMinutesBefore: 15, // PreMeetingBriefService::DEFAULT_LEAD_MINUTES = 15
  },
  {
    value: 'critical_path',
    label: 'Critical path',
    description:
      'Periodic critical-path digest: tasks and dependencies affecting the project deadline.',
    hasMinutesBefore: false,
  },
] as const;
