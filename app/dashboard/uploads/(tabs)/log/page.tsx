import { UploadsListClient } from '@/features/uploads';
import { getUploads } from '@/features/uploads/api/uploads';
import { Card } from '@/shared/ui/card';

/**
 * Log tab — unified, org/team-wide feed of all uploads (transcript + task-data).
 * Each row opens a per-upload processing-detail view.
 */
export default async function UploadsLogPage() {
  const initialPage = await getUploads({ offset: 0, limit: 50 });

  return (
    <Card className='h-full flex flex-col overflow-hidden'>
      <div className='flex-1 overflow-y-auto'>
        <UploadsListClient
          initialItems={initialPage.data}
          initialTotalCount={initialPage.totalCount}
          initialHasMore={initialPage.hasMore}
        />
      </div>
    </Card>
  );
}
