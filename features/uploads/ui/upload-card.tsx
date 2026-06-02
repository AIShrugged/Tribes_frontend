'use client';

import { FileText, ListChecks } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { UploadStatusBadge } from '@/features/uploads/ui/upload-status-badge';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';

import type { UploadLogItem } from '@/features/uploads/model/types';

const TYPE_LABEL: Record<UploadLogItem['type'], string> = {
  transcript: 'Transcript',
  task_data: 'Task data',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function UploadCard({ upload }: { upload: UploadLogItem }) {
  const router = useRouter();
  const open = () => {
    router.push(ROUTES.DASHBOARD.UPLOAD_DETAIL(upload.type, upload.id));
  };

  const meta = [
    upload.uploader_name,
    upload.team_name,
    formatDateTime(upload.created_at),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      role='button'
      tabIndex={0}
      className='cursor-pointer rounded-[var(--radius-card)] border border-border bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg'
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {upload.type === 'transcript' ? (
            <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
          ) : (
            <ListChecks className='h-4 w-4 shrink-0 text-muted-foreground' />
          )}
          <h3 className='truncate text-base font-semibold text-foreground'>
            {upload.original_filename}
          </h3>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Badge variant='default'>{TYPE_LABEL[upload.type]}</Badge>
          <UploadStatusBadge status={upload.status} />
        </div>
      </div>

      <p className='mt-1.5 text-sm text-muted-foreground'>{meta}</p>

      {upload.status === 'failed' && upload.error_message && (
        <p className='mt-2 line-clamp-2 text-sm text-destructive'>
          {upload.error_message}
        </p>
      )}

      {upload.type === 'task_data' && upload.status === 'done' && (
        <p className='mt-2 text-sm text-muted-foreground'>
          {upload.issues_created ?? 0} created · {upload.issues_updated ?? 0}{' '}
          updated
        </p>
      )}
    </article>
  );
}
