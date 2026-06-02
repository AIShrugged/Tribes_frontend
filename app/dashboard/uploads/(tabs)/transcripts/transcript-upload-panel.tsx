'use client';

import { useRouter } from 'next/navigation';

import { TranscriptUploadForm } from '@/features/transcript-upload';
import { ROUTES } from '@/shared/lib/routes';

import type { CalendarEventListItem } from '@/entities/event';
import type { TeamProps } from '@/entities/team';

/**
 * Client wrapper that mounts the existing TranscriptUploadForm inline on the
 * Uploads page. Lives in app/ (not features/uploads) so composing another
 * feature's form does not breach FSD feature isolation. After a successful
 * upload — or on Cancel — it navigates to the Log tab.
 */
export function TranscriptUploadPanel({
  meetings,
  teams,
}: {
  meetings: CalendarEventListItem[];
  teams: TeamProps[];
}) {
  const router = useRouter();
  const goToLog = () => {
    router.push(ROUTES.DASHBOARD.UPLOADS_LOG);
  };

  return (
    <TranscriptUploadForm
      meetings={meetings}
      teams={teams}
      onClose={goToLog}
      onSuccess={goToLog}
    />
  );
}
