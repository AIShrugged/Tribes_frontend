// Strings will be moved to i18n when that framework is adopted.

import type {
  AgendaSection,
  MeetingSummarySection,
} from '@/features/teams/model/types';

export const SUMMARY_SECTION_LABELS: Record<MeetingSummarySection, string> = {
  key_points: 'Key points',
  decisions: 'Decisions',
  commitments: 'Commitments',
  repeated_discussions: 'Repeated discussions',
  tasks: 'New & updated tasks',
};

export const AGENDA_SECTION_LABELS: Record<AgendaSection, string> = {
  meeting_goal: 'Meeting goal',
  discussion_topics: 'Discussion topics',
  main_problem: 'Main problem',
  prev_topics: 'Previous meeting topics',
  commitments_check: 'Commitments check',
  tasks_between: 'Tasks between meetings',
  backlog_stats: 'Backlog stats',
  tg_topics: 'New Telegram topics',
  next_meeting_context: 'Next meeting context',
  follow_up_items: 'Follow-up items',
  open_questions: 'Open questions',
  focus_areas: 'Focus areas',
};
