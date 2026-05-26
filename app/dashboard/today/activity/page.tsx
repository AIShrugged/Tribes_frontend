import { CriticalPathPageClient } from '@/features/issues/ui/critical-path-page';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Activity' };

export default async function TodayActivityPage() {
  const organizationId = await getOrganizationId();

  return <CriticalPathPageClient organizationId={organizationId} />;
}
