import {
  agendaFromDraftPayload,
  pickMeetingDrafts,
  summaryFromDraftPayload,
} from '@/features/brain/lib/meeting-drafts';

import type {
  BrainSuggestion,
  SaveMeetingAgendaPayload,
  SaveMeetingSummaryPayload,
} from '@/features/brain/model/types';

function makeSuggestion(
  overrides: Partial<BrainSuggestion> & Pick<BrainSuggestion, 'id' | 'key'>,
): BrainSuggestion {
  return {
    organization_id: 1,
    run_uuid: null,
    title: 'draft',
    summary: null,
    reasoning: null,
    evidence: null,
    confidence: null,
    payload: {},
    status: 'pending',
    applied_result: null,
    failure_reason: null,
    dedupe_key: null,
    created_at: null,
    resolved_at: null,
    applied_at: null,
    ...overrides,
  };
}

describe('pickMeetingDrafts', () => {
  const summary206 = makeSuggestion({
    id: 1,
    key: 'save_meeting_summary',
    payload: { calendar_event_id: 206 },
  });
  const agenda206 = makeSuggestion({
    id: 2,
    key: 'save_meeting_agenda',
    payload: { calendar_event_id: 206 },
  });
  const summaryOther = makeSuggestion({
    id: 3,
    key: 'save_meeting_summary',
    payload: { calendar_event_id: 999 },
  });
  const unrelated = makeSuggestion({
    id: 4,
    key: 'create_issue',
    payload: { calendar_event_id: 206 },
  });

  it('filters by payload.calendar_event_id and splits by key', () => {
    const result = pickMeetingDrafts(
      [summary206, agenda206, summaryOther, unrelated],
      206,
    );

    expect(result.summaryDraft).toBe(summary206);
    expect(result.agendaDraft).toBe(agenda206);
  });

  it('returns nulls when no suggestion matches the meeting', () => {
    const result = pickMeetingDrafts([summaryOther], 206);

    expect(result.summaryDraft).toBeNull();
    expect(result.agendaDraft).toBeNull();
  });

  it('ignores suggestions whose payload has no numeric calendar_event_id', () => {
    const noEventId = makeSuggestion({
      id: 5,
      key: 'save_meeting_summary',
      payload: {},
    });

    expect(pickMeetingDrafts([noEventId], 206).summaryDraft).toBeNull();
  });
});

describe('summaryFromDraftPayload', () => {
  it('maps the payload to a done MeetingSummary with empty server fields', () => {
    const payload: SaveMeetingSummaryPayload = {
      calendar_event_id: 206,
      title: 'Планёрка',
      summary: '## Контекст',
      key_points: ['a'],
      decisions: ['b'],
    };

    const summary = summaryFromDraftPayload(payload);

    expect(summary).toMatchObject({
      calendar_event_id: 206,
      status: 'done',
      title: 'Планёрка',
      summary: '## Контекст',
      key_points: ['a'],
      decisions: ['b'],
      repeated_discussions: [],
      attendees: [],
    });
  });

  it('defaults missing list fields to empty arrays', () => {
    const summary = summaryFromDraftPayload({ calendar_event_id: 1 });

    expect(summary.key_points).toEqual([]);
    expect(summary.decisions).toEqual([]);
    expect(summary.title).toBeNull();
  });
});

describe('agendaFromDraftPayload', () => {
  it('maps the payload to a done general MeetingAgenda', () => {
    const payload: SaveMeetingAgendaPayload = {
      calendar_event_id: 181,
      type: 'general',
      content: '## Повестка',
      raw_json: { meeting_goal: 'Цель' },
      source_meeting_id: 180,
    };

    const agenda = agendaFromDraftPayload(payload);

    expect(agenda).toMatchObject({
      calendar_event_id: 181,
      type: 'general',
      status: 'done',
      content: '## Повестка',
      raw_json: { meeting_goal: 'Цель' },
      user_id: null,
    });
  });

  it('defaults type to general when omitted', () => {
    expect(agendaFromDraftPayload({ calendar_event_id: 1 }).type).toBe(
      'general',
    );
  });
});
