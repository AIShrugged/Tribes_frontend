import { CriticalPathPageClient } from '@/features/issues';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Critical Path' };

export default async function TodayActivityPage() {
  const organizationId = await getOrganizationId();

  return <CriticalPathPageClient organizationId={organizationId} />;
}
