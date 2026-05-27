import type { CalendarEventListItem } from '@/entities/event';
import type { MeetingTask } from '@/features/meeting/types';

export interface CalendarEventReadMore {
  section?: string | null;
  anchor?: string | null;
}

export interface CalendarEventTakeaway {
  title: string;
  excerpt: string;
  full_text: string;
  kind: string;
  label?: string | null;
  read_more?: CalendarEventReadMore | null;
}

export interface CalendarEventParticipant {
  id?: number | string;
  name?: string | null;
  label?: string | null;
  title?: string | null;
  email?: string | null;
  role?: string | null;
  initials?: string | null;
  is_current_user?: boolean;
  is_chair?: boolean;
  [key: string]: unknown;
}

export interface CalendarEventAgendaItem {
  id?: number | string;
  type?: string | null;
  status?: string | null;
  title?: string | null;
  text?: string | null;
  description?: string | null;
  content?: string | null;
  order?: number | null;
  sent_at?: string | null;
  send_scheduled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export type CalendarEventSectionValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<unknown>
  | Record<string, unknown>;

/**
 * Decision (пункт протокола) на дашборде встречи — со связанными задачами и флагом покрытия.
 * Бэкенд: CalendarEventDetailResource::buildDecisions().
 */
export interface MeetingDecisionLinkedIssue {
  id: number;
  name: string;
  status: string;
}

export interface MeetingDecision {
  id: number;
  text: string;
  topic: string | null;
  author_raw_name: string | null;
  author: {
    id: number;
    name: string;
  } | null;
  linked_issues: MeetingDecisionLinkedIssue[];
  is_uncovered: boolean;
}

export interface CalendarEventDetailResponse {
  event: CalendarEventListItem & Record<string, unknown>;
  participants: CalendarEventParticipant[];
  agendas: CalendarEventAgendaItem[];
  tasks: MeetingTask[];
  summary: CalendarEventSectionValue;
  review: CalendarEventSectionValue;
  followup: CalendarEventSectionValue;
  previous_meeting: CalendarEventSectionValue;
  key_takeaways: CalendarEventTakeaway[];
  decisions?: MeetingDecision[];
  counts: Record<string, number | string | null | undefined>;
  [key: string]: unknown;
}

export { type CalendarEventListItem } from '@/entities/event';
