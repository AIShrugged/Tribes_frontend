import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export default function TodayTasksPage() {
  redirect(ROUTES.DASHBOARD.TODAY_PROGRESS);
}