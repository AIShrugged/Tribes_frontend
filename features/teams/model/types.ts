export type {
  TeamProps,
  TeamCreateDTO,
  TeamAddMemberDTO,
  TeamActionType,
} from '@/entities/team';

// Notification-setting types moved to entities/team-notification-setting (shared with the
// Telegram feature). Re-exported here so existing features/teams imports keep working.
export type {
  TeamNotificationSetting,
  TeamNotificationSettingCreateDTO,
  TeamNotificationSettingUpdateDTO,
} from '@/entities/team-notification-setting';

// Meeting summary template (US-5.8)
export type MeetingSummarySection =
  | 'key_points'
  | 'decisions'
  | 'commitments'
  | 'repeated_discussions'
  | 'tasks';

export const MEETING_SUMMARY_DEFAULT_SECTIONS: MeetingSummarySection[] = [
  'key_points',
  'decisions',
  'commitments',
  'repeated_discussions',
  'tasks',
];

export const MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS: MeetingSummarySection[] =
  ['key_points'];

export interface MeetingSummaryTemplate {
  id: number;
  team_id: number;
  sections: MeetingSummarySection[];
  visible_sections: MeetingSummarySection[] | null;
  prompt_override: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingSummaryTemplateResolved {
  template: MeetingSummaryTemplate | null;
  sections: MeetingSummarySection[];
  visibleSections: MeetingSummarySection[];
  promptOverride: string | null;
  version: number | null;
  isDefault: boolean;
}

export interface MeetingSummaryTemplateVersion {
  id: number;
  template_id: number;
  version: number;
  sections: MeetingSummarySection[];
  visible_sections: MeetingSummarySection[] | null;
  prompt_override: string | null;
  created_at: string;
}

export interface MeetingSummaryDefaultPrompt {
  default_prompt: string;
  placeholders: string[];
}

// Agenda template (new in Epic 5)
export type AgendaSection =
  | 'meeting_goal'
  | 'discussion_topics'
  | 'main_problem'
  | 'prev_topics'
  | 'commitments_check'
  | 'tasks_between'
  | 'backlog_stats'
  | 'tg_topics'
  | 'next_meeting_context'
  | 'follow_up_items'
  | 'open_questions'
  | 'focus_areas';

export const AGENDA_SECTIONS_PRE_MEETING: AgendaSection[] = [
  'meeting_goal',
  'discussion_topics',
  'main_problem',
  'prev_topics',
  'commitments_check',
  'tasks_between',
  'backlog_stats',
  'tg_topics',
];

export const AGENDA_SECTIONS_UPCOMING: AgendaSection[] = [
  'next_meeting_context',
  'follow_up_items',
  'open_questions',
  'focus_areas',
];

export const AGENDA_DEFAULT_SECTIONS: AgendaSection[] = [
  ...AGENDA_SECTIONS_PRE_MEETING,
  ...AGENDA_SECTIONS_UPCOMING,
];

export interface AgendaTemplate {
  id: number;
  team_id: number;
  sections: AgendaSection[];
  available_sections: AgendaSection[];
  created_at: string;
  updated_at: string;
}

export interface AgendaTemplateResolved {
  template: AgendaTemplate | null;
  sections: AgendaSection[];
  availableSections: AgendaSection[];
  isDefault: boolean;
}
