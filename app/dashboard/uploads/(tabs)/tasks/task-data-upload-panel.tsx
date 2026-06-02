'use client';

import { useRouter } from 'next/navigation';

import { TaskDataUploadForm } from '@/features/task-data-upload';
import { ROUTES } from '@/shared/lib/routes';

import type { TeamProps } from '@/entities/team';

/**
 * Client wrapper mounting the existing TaskDataUploadForm inline on the Uploads
 * page. The form owns its own processing/done/error phases; Cancel/Close routes
 * to the Log tab. Lives in app/ to keep features/uploads free of cross-feature
 * imports (FSD).
 */
export function TaskDataUploadPanel({ teams }: { teams: TeamProps[] }) {
  const router = useRouter();
  const goToLog = () => {
    router.push(ROUTES.DASHBOARD.UPLOADS_LOG);
  };

  return <TaskDataUploadForm teams={teams} onClose={goToLog} />;
}
