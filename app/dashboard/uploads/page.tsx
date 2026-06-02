import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export default function UploadsPage() {
  redirect(ROUTES.DASHBOARD.UPLOADS_TRANSCRIPTS);
}
