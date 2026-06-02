import { getPastEventsForPicker } from '@/entities/event/api/calendar-events';
import { getTeams } from '@/entities/team/api/team';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

import { TranscriptUploadPanel } from './transcript-upload-panel';

/**
 * Transcripts tab — manual transcript upload. Fetches the prerequisites
 * (past meetings + teams) on the server, then mounts the upload form inline.
 */
export default async function UploadsTranscriptsPage() {
  const orgId = await getOrganizationId();
  const [meetings, teamsResult] = await Promise.all([
    getPastEventsForPicker(50),
    getTeams(orgId),
  ]);

  return (
    <Card className='mx-auto max-w-2xl'>
      <TranscriptUploadPanel meetings={meetings} teams={teamsResult.data} />
    </Card>
  );
}
