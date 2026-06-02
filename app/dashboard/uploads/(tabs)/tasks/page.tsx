import { getTeams } from '@/entities/team/api/team';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

import { TaskDataUploadPanel } from './task-data-upload-panel';

/**
 * Tasks tab — upload a file for task extraction. Fetches teams on the server,
 * then mounts the extraction form inline.
 */
export default async function UploadsTasksPage() {
  const orgId = await getOrganizationId();
  const teamsResult = await getTeams(orgId);

  return (
    <Card className='mx-auto max-w-2xl'>
      <TaskDataUploadPanel teams={teamsResult.data} />
    </Card>
  );
}
