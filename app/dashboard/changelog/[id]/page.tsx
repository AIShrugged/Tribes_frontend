import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CommitReportDetailView } from '@/features/commit-reports';
import { getCommitReport } from '@/features/commit-reports/api/commit-reports';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';
import { Card } from '@/shared/ui/card';

export default async function ChangelogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const orgId = await getOrganizationId();
  const detail = await getCommitReport(orgId, numericId);

  return (
    <Card className='flex h-full flex-col overflow-hidden'>
      <div className='px-5 pt-4'>
        <Link
          href={ROUTES.DASHBOARD.CHANGELOG}
          className='inline-flex w-fit items-center gap-2 text-sm text-primary transition-colors hover:text-primary/80'
        >
          <ArrowLeft className='h-4 w-4' /> Back to Changelog
        </Link>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <CommitReportDetailView detail={detail} />
      </div>
    </Card>
  );
}
