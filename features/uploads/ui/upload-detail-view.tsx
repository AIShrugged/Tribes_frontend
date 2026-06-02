'use client';

import { CheckCircle2, Clock, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getUploadDetail } from '@/features/uploads/api/uploads';
import {
  TASK_DATA_STATUS_LABELS,
  TASK_DATA_STATUS_PROGRESS,
} from '@/features/uploads/model/types';
import { UploadStatusBadge } from '@/features/uploads/ui/upload-status-badge';
import { ROUTES } from '@/shared/lib/routes';

import type {
  UploadDetail,
  UploadDetailTaskData,
  UploadDetailTranscript,
} from '@/features/uploads/model/types';

// ~3 min at 2s — ceiling for BOTH types so a row stranded in a non-terminal state
// (e.g. a task-data worker killed before it can write 'failed', or a transcript whose
// artifacts never settle) can't poll forever. Polling stops earlier when needsPoll
// goes false (terminal status / artifacts settled).
const MAX_POLLS = 90;

function needsPoll(detail: UploadDetail): boolean {
  if (detail.status === 'failed') return false;
  if (detail.type === 'task_data') return detail.status === 'processing';
  // Transcript: only poll a done row that still has a LIVE linked event whose
  // artifacts haven't settled. With no event (calendar_event_id null — e.g. the
  // event was hard-deleted), the processing block can never appear, so don't poll.
  return (
    detail.status === 'done' &&
    detail.calendar_event_id != null &&
    (!detail.processing ||
      !detail.processing.has_summary ||
      !detail.processing.has_review)
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function UploadDetailView({
  initialDetail,
}: {
  initialDetail: UploadDetail;
}) {
  const [detail, setDetail] = useState<UploadDetail>(initialDetail);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!needsPoll(initialDetail)) return;

    pollCount.current = 0;

    const tick = async () => {
      pollCount.current += 1;
      try {
        const fresh = await getUploadDetail(initialDetail.type, initialDetail.id);
        setDetail(fresh);
        if (!needsPoll(fresh) || pollCount.current >= MAX_POLLS) stop();
      } catch {
        // transient network blip — keep polling
      }
    };

    pollRef.current = setInterval(() => {
      tick().catch(() => {});
    }, 2000);

    return stop;
  }, [initialDetail, stop]);

  return (
    <div className='flex flex-col gap-4 px-5 py-4'>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h2 className='truncate text-lg font-semibold text-foreground'>
            {detail.original_filename}
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            {[
              detail.type === 'transcript' ? 'Transcript' : 'Task data',
              detail.uploader_name,
              detail.type === 'task_data' ? detail.team_name : null,
              formatDateTime(detail.created_at),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <UploadStatusBadge status={detail.status} />
      </div>

      {detail.type === 'transcript' ? (
        <TranscriptBody detail={detail} />
      ) : (
        <TaskDataBody detail={detail} />
      )}
    </div>
  );
}

function Signal({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className='flex items-center gap-2 text-sm'>
      {ready ? (
        <CheckCircle2 className='h-4 w-4 text-green-500' />
      ) : (
        <Clock className='h-4 w-4 text-muted-foreground' />
      )}
      <span className={ready ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}

function MeetingLink({ id, label }: { id: number; label: string }) {
  return (
    <Link
      href={ROUTES.DASHBOARD.MEETING_DETAIL_OVERVIEW(id)}
      className='inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline'
    >
      {label} <ExternalLink className='h-3 w-3' />
    </Link>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className='flex items-center gap-2 text-destructive'>
      <XCircle className='h-5 w-5' />
      <span className='text-sm font-medium'>{message}</span>
    </div>
  );
}

function TranscriptBody({ detail }: { detail: UploadDetailTranscript }) {
  if (detail.status === 'failed') {
    return (
      <div className='flex flex-col gap-3'>
        <ErrorLine message={detail.error_message ?? 'Upload failed'} />
        {detail.calendar_event_id && (
          <p className='text-sm text-muted-foreground'>
            An empty meeting was created.{' '}
            <MeetingLink id={detail.calendar_event_id} label='View meeting' />
          </p>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground'>
        {detail.transcript_entries_count ?? 0} transcript entries ·{' '}
        {detail.participants_count ?? 0} participants
      </div>

      {detail.processing ? (
        <TranscriptProcessing processing={detail.processing} />
      ) : (
        <p className='text-sm text-muted-foreground'>
          No linked meeting for this upload.
        </p>
      )}

      {detail.calendar_event_id && (
        <MeetingLink id={detail.calendar_event_id} label='View meeting' />
      )}
    </div>
  );
}

function TranscriptProcessing({
  processing,
}: {
  processing: NonNullable<UploadDetailTranscript['processing']>;
}) {
  return (
    <div className='flex flex-col gap-2 rounded-md border border-border p-3'>
      <p className='text-sm font-medium text-foreground'>Processing</p>
      <Signal
        ready={processing.has_summary}
        label={processing.has_summary ? 'Summary ready' : 'Summary generating…'}
      />
      <Signal
        ready={processing.has_review}
        label={processing.has_review ? 'Review ready' : 'Review generating…'}
      />
      <p className='text-sm text-muted-foreground'>
        {processing.followups_count} follow-up
        {processing.followups_count === 1 ? '' : 's'} ·{' '}
        {processing.issues_created} tasks created · {processing.issues_updated}{' '}
        updated
      </p>
    </div>
  );
}

function TaskDataBody({ detail }: { detail: UploadDetailTaskData }) {
  if (detail.status === 'failed') {
    return <ErrorLine message={detail.error_message ?? 'Processing failed'} />;
  }

  if (detail.status === 'processing') {
    return <TaskDataProcessing rawStatus={detail.raw_status} />;
  }

  return <TaskDataDone detail={detail} />;
}

function TaskDataProcessing({
  rawStatus,
}: {
  rawStatus: UploadDetailTaskData['raw_status'];
}) {
  const pct = TASK_DATA_STATUS_PROGRESS[rawStatus] ?? 0;
  const label = TASK_DATA_STATUS_LABELS[rawStatus] ?? 'Processing…';
  return (
    <div className='rounded-md border border-border bg-muted/30 p-3 text-sm'>
      <div className='flex items-center gap-2 text-foreground'>
        <div className='size-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
        {label}
      </div>
      <div className='mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className='h-full rounded-full bg-primary transition-all duration-700 ease-out'
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TaskDataDone({ detail }: { detail: UploadDetailTaskData }) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground'>
        {detail.issues_created} task{detail.issues_created === 1 ? '' : 's'}{' '}
        created · {detail.issues_updated} updated
      </div>

      {detail.issues.length > 0 ? (
        <div className='flex flex-col gap-1'>
          <p className='text-sm font-medium text-foreground'>Created tasks</p>
          <ul className='flex flex-col gap-1'>
            {detail.issues.map((issue) => {
              return (
                <li key={issue.id}>
                  <Link
                    href={ROUTES.DASHBOARD.ISSUES_DETAIL(issue.id)}
                    className='inline-flex items-center gap-1 text-sm text-primary hover:underline'
                  >
                    {issue.name} <ExternalLink className='h-3 w-3' />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className='text-sm text-muted-foreground'>
          No tasks were created from this document.
        </p>
      )}

      {detail.issues_updated > 0 && (
        <p className='text-xs text-muted-foreground'>
          {detail.issues_updated} existing task
          {detail.issues_updated === 1 ? '' : 's'} were updated (not listed).
        </p>
      )}
    </div>
  );
}
