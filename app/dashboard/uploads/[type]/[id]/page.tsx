import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { UploadDetailView } from '@/features/uploads';
import { getUploadDetail } from '@/features/uploads/api/uploads';
import { UploadReviewScreen } from '@/features/upload-review';
import { getPlan } from '@/features/upload-review/api/upload-review';
import { ROUTES } from '@/shared/lib/routes';
import { Card } from '@/shared/ui/card';

import type { UploadType } from '@/features/uploads/model/types';

const VALID_TYPES = new Set<UploadType>(['transcript', 'task_data']);

/**
 * Upload detail — lives OUTSIDE the (tabs) group, so it has no tab strip.
 * Modeled on the meeting "protocol" detail shell (back link + content card).
 */
export default async function UploadDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  const numericId = Number(id);
  if (!VALID_TYPES.has(type as UploadType) || !Number.isInteger(numericId)) {
    notFound();
  }

  const uploadType = type as UploadType;
  const detail = await getUploadDetail(uploadType, numericId);

  // Moderation gate (app→features branch, FSD-clean): a 'review' row renders the editable review
  // screen instead of the read-only detail/poll. After approve/reject the screen calls
  // router.refresh(), the row leaves 'review', and this page re-renders the normal detail view.
  const reviewing = detail.status === 'review';
  const planResponse = reviewing ? await getPlan(uploadType, numericId) : null;

  return (
    <Card className='h-full flex flex-col overflow-hidden'>
      <div className='px-5 pt-4'>
        <Link
          href={ROUTES.DASHBOARD.UPLOADS_LOG}
          className='inline-flex w-fit items-center gap-2 text-sm text-primary transition-colors hover:text-primary/80'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to Log
        </Link>
      </div>
      <div className='flex-1 min-h-0 overflow-y-auto'>
        {reviewing && planResponse ? (
          <UploadReviewScreen
            type={uploadType}
            id={numericId}
            initialPlan={planResponse.plan}
            assignees={planResponse.assignees ?? []}
          />
        ) : (
          <UploadDetailView initialDetail={detail} />
        )}
      </div>
    </Card>
  );
}
