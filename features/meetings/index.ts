// Public API for the meetings feature

export { MeetingsColumnView } from './ui/meetings-column-view';
export { DateSwitcher } from './ui/date-switcher';
export { MeetingCard } from './ui/meeting-card';
export { MeetingDetailTabsNav } from './ui/meeting-detail-tabs-nav';
export { MeetingsTabsNav } from './ui/meetings-tabs-nav';
export { BotToggleButton } from './ui/bot-toggle-button';
export { MeetingJoinButton } from './ui/meeting-join-button';
export { MeetingCalendarPopover } from './ui/meeting-calendar-popover';
export { OrgCalendarEvent } from './ui/org-calendar-event';
export { OrgCalendarView } from './ui/org-calendar-view';

export type {
  CalendarEventListItem,
  CalendarEventDetailResponse,
  CalendarEventAgendaItem,
  CalendarEventParticipant,
  CalendarEventSectionValue,
  CalendarEventReadMore,
  CalendarEventTakeaway,
  MeetingDecision,
  MeetingDecisionLinkedIssue,
} from './model/types';
export {
  getMeetingDisplayState,
  type MeetingDisplayState,
} from './model/meeting-state';
export {
  getBotPillIndicator,
  type BotPillIndicator,
} from './model/bot-pill-indicator';
export { BotPillIcon } from './ui/bot-pill-icon';
export {
  getMeetingsForDate,
  getMeetingsForThreeDays,
  getCalendarEventsForMonth,
  getMeetingsList,
} from './api/meetings';
export { getOrgCalendarEvents, getAllOrgCalendarEvents } from './api/org-calendar';
export {
  type MeetingScope,
  type MeetingsListFilters,
  DEFAULT_MEETINGS_FILTERS,
  parseFilters,
  serializeFilters,
  hasActiveFilters,
} from './model/filters';
export { MeetingsListFiltersBar } from './ui/meetings-list-filters-bar';
export { MeetingsListClient } from './ui/meetings-list-client';
export { MeetingDecisionsSection } from './ui/meeting-decisions-section';
