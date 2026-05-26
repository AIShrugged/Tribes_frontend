'use client';

import { useEffect, useState } from 'react';

import { getPastEventsForPicker } from '@/entities/event/api/calendar-events';
import { getTeams } from '@/entities/team/api/team';
import { TranscriptUploadForm } from '@/features/transcript-upload/ui/transcript-upload-form';
import { Modal } from '@/shared/ui/modal/modal';

import type { CalendarEventListItem } from '@/entities/event';
import type { TeamProps } from '@/entities/team';

export function TranscriptUploadModal({
  isOpen,
  onClose,
  organizationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Organization id (from cookie). Required to fetch teams. If absent,
   * Mode B (new meeting) tab is disabled.
   */
  organizationId: string | null;
}) {
  // null = not yet fetched; array = fetched (possibly empty)
  const [meetings, setMeetings] = useState<CalendarEventListItem[] | null>(
    null,
  );
  const [teams, setTeams] = useState<TeamProps[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Derived: loading when modal is open but data hasn't arrived yet
  const isLoading = isOpen && meetings === null && loadError === null;

  useEffect(() => {
    if (!isOpen || meetings !== null) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [meetingsList, teamsResult] = await Promise.all([
          getPastEventsForPicker(50),
          organizationId
            ? getTeams(organizationId)
            : Promise.resolve({
                data: [] as TeamProps[],
                totalCount: 0,
              }),
        ]);
        if (cancelled) return;
        setMeetings(meetingsList);
        setTeams(teamsResult.data);
      } catch {
        if (cancelled) return;
        setLoadError('Failed to load data. Please try again.');
      }
    };

    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, meetings, organizationId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Upload transcript'
      size='md'
    >
      {isLoading && (
        <div className='p-6 text-center text-sm text-muted-foreground'>
          Loading…
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
