import type {
  BrainSuggestion,
  MeetingAgenda,
  MeetingSummary,
  SaveMeetingAgendaPayload,
  SaveMeetingSummaryPayload,
} from '@/features/brain/model/types';

/** The brain-drafted protocol/agenda proposals pending for a single meeting. */
export interface MeetingDrafts {
  summaryDraft: BrainSuggestion | null;
  agendaDraft: BrainSuggestion | null;
}

/** Reads `payload.calendar_event_id` off a suggestion regardless of payload shape. */
function payloadEventId(suggestion: BrainSuggestion): number | null {
  const value = (suggestion.payload as { calendar_event_id?: unknown })
    .calendar_event_id;

  return typeof value === 'number' ? value : null;
}

/**
 * Picks the pending protocol and agenda drafts for one meeting. The backend has
 * no `calendar_event_id` filter on `/brain/suggestions`, so the caller passes
 * the full pending list and this filters locally by `payload.calendar_event_id`
 * and splits by suggestion key (first of each wins).
 * @param suggestions - all pending brain suggestions.
 * @param calendarEventId - the meeting to match.
 */
export function pickMeetingDrafts(
  suggestions: BrainSuggestion[],
  calendarEventId: number,
): MeetingDrafts {
  const forMeeting = suggestions.filter((suggestion) => {
    return payloadEventId(suggestion) === calendarEventId;
  });

  return {
    summaryDraft:
      forMeeting.find((suggestion) => {
        return suggestion.key === 'save_meeting_summary';
      }) ?? null,
    agendaDraft:
      forMeeting.find((suggestion) => {
        return suggestion.key === 'save_meeting_agenda';
      }) ?? null,
  };
}

/**
 * Maps a `save_meeting_summary` payload to a {@link MeetingSummary} so the draft
 * preview reuses the Section 1 renderer. Server-only fields are stubbed empty.
 * @param payload - the suggestion payload.
 */
export function summaryFromDraftPayload(
  payload: SaveMeetingSummaryPayload,
): MeetingSummary {
  return {
    id: 0,
    calendar_event_id: payload.calendar_event_id,
    status: 'done',
    title: payload.title ?? null,
    summary: payload.summary ?? null,
    key_points: payload.key_points ?? [],
    decisions: payload.decisions ?? [],
    repeated_discussions: [],
    attendees: [],
    created_at: '',
    updated_at: '',
  };
}

/**
 * Maps a `save_meeting_agenda` payload to a {@link MeetingAgenda} so the draft
 * preview reuses the Section 2 renderer.
 * @param payload - the suggestion payload.
 */
export function agendaFromDraftPayload(
  payload: SaveMeetingAgendaPayload,
): MeetingAgenda {
  return {
    id: 0,
    calendar_event_id: payload.calendar_event_id,
    user_id: null,
    type: payload.type ?? 'general',
    status: 'done',
    content: payload.content ?? null,
    raw_json: payload.raw_json ?? null,
    sent_at: null,
    send_scheduled_at: null,
    created_at: '',
    updated_at: '',
  };
}
