'use server';

import { getBrainSuggestions } from '@/features/brain/api/suggestions';
import { pickMeetingDrafts } from '@/features/brain/lib/meeting-drafts';
import { ServerError } from '@/shared/lib/errors';

import type { MeetingDrafts } from '@/features/brain/lib/meeting-drafts';

/** Max pending suggestions pulled in one page (backend cap). */
const SUGGESTIONS_PER_PAGE = 200;

/**
 * Fetches the pending second-brain drafts (protocol + agenda) for one meeting.
 * The endpoint is manager-only and has no `calendar_event_id` filter, so this
 * pulls the pending page and filters locally. A 403 (not a manager) resolves to
 * empty drafts — the block is simply hidden, not an error.
 * @param calendarEventId - the meeting id.
 */
export async function getMeetingDrafts(
  calendarEventId: number,
): Promise<MeetingDrafts> {
  try {
    const { data } = await getBrainSuggestions({
      status: 'pending',
      perPage: SUGGESTIONS_PER_PAGE,
    });

    return pickMeetingDrafts(data, calendarEventId);
  } catch (error) {
    if (error instanceof ServerError && error.status === 403) {
      return { summaryDraft: null, agendaDraft: null };
    }

    throw error;
  }
}
