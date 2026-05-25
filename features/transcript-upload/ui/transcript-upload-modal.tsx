'use client';

import { useEffect, useState } from 'react';

import { getMeetingsList } from '@/features/meetings/api/meetings';
import { getTeams } from '@/features/teams/api/team';
import { TranscriptUploadForm } from '@/features/transcript-upload/ui/transcript-upload-form';
import { Modal } from '@/shared/ui/modal/modal';

import type { CalendarEventListItem } from '@/features/meetings/model/types';
import type { TeamProps } from '@/entities/team';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Organization id (from cookie). Required to fetch teams. If absent,
   * Mode B (new meeting) tab is disabled.
   */
  organizationId: string | null;
}

/**
 * Manual transcript upload modal.
 *
 * Lazy-loads meetings (past, up to 200) and teams of the active organization
 * on first open. Skips re-fetch on subsequent opens within the same session.
 *
 * Background: backend endpoint POST /api/v1/transcripts/upload accepts a
 * file (JSON Recall / TXT / VTT / SRT, ≤5MB), either attaches it to an
 * existing CalendarEvent (Mode A) or creates a new manual one (Mode B),
 * and then dispatches the regular TranscriptParsed pipeline (summary,
 * review, followup, agenda, insights).
 */
export function TranscriptUploadModal({
  isOpen,
  onClose,
  organizationId,
}: Props) {
  const [meetings, setMeetings] = useState<CalendarEventListItem[] | null>(
    null,
  );
  const [teams, setTeams] = useState<TeamProps[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || meetings !== null) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void Promise.all([
      getMeetingsList({
        scope: 'past',
        team_id: null,
        user_id: null,
        offset: 0,
        // Backend caps `limit` at 50. For users with many past meetings the
        // picker shows the 50 most recent; broader picker will come with an
        // explicit search/pagination in a follow-up ticket.
        limit: 50,
      }),
      organizationId
        ? getTeams(organizationId)
        : Promise.resolve({ data: [] as TeamProps[], totalCount: 0, hasMore: false }),
    ])
      .then(([meetingsResult, teamsResult]) => {
        if (cancelled) return;
        setMeetings(meetingsResult.data);
        setTeams(teamsResult.data);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Не удалось загрузить данные. Попробуйте ещё раз.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, meetings, organizationId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title='Загрузить транскрипт' size='md'>
      {isLoading && (
        <div className='p-6 text-center text-sm text-muted-foreground'>
          Загрузка…
        </div>
      )}
      {loadError && (
        <div className='p-6 text-center text-sm text-destructive'>
          {loadError}
        </div>
      )}
      {!isLoading && !loadError && meetings !== null && (
        <TranscriptUploadForm
          meetings={meetings}
          teams={teams}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
