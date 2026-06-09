'use client';

import { format, parseISO } from 'date-fns';
import { Calendar, Clock, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button';

import { closeReviewIssue } from '../api/issue-actions';

import type {
  MeetingTaskReviewIssue,
  MeetingTaskReviewSuggestion,
} from '../model/types';

interface MeetingTaskReviewBlockItemProps {
  issue: MeetingTaskReviewIssue;
}

const ACTION_LABELS: Record<MeetingTaskReviewSuggestion, string> = {
  update_status: 'Обновить статус',
  resolve_blocker: 'Открыть задачу',
  reassign: 'Переназначить',
  fill_info: 'Заполнить',
  update_due_date: 'Изменить дедлайн',
  escalate: 'Эскалировать',
  close: 'Закрыть',
};

export function MeetingTaskReviewBlockItem({
  issue,
}: MeetingTaskReviewBlockItemProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const formattedDueDate = issue.due_date
    ? format(parseISO(issue.due_date), 'dd.MM.yyyy')
    : null;

  const isDestructive =
    issue.suggestion === 'update_status' || issue.suggestion === 'close';

  const handleAction = async () => {
    if (isDestructive) {
      if (!confirming) {
        setConfirming(true);
        setTimeout(() => {
          return setConfirming(false);
        }, 3000);
        return;
      }
      setConfirming(false);
      const successText =
        issue.suggestion === 'close'
          ? 'Задача закрыта'
          : 'Статус задачи обновлён';
      setIsPending(true);
      const result = await closeReviewIssue(issue.id);
      setIsPending(false);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successText);
        router.refresh();
      }
      return;
    }

    router.push(ROUTES.DASHBOARD.ISSUES_DETAIL(issue.id));
  };

  const label = confirming ? 'Подтвердить?' : ACTION_LABELS[issue.suggestion];

  return (
    <div className='rounded-button border border-border bg-card px-3 py-2.5'>
      <div className='flex items-start justify-between gap-3'>
        <Link
          href={ROUTES.DASHBOARD.ISSUES_DETAIL(issue.id)}
          className='flex-1 min-w-0 text-sm font-medium text-foreground transition-colors hover:text-primary hover:underline leading-snug'
        >
          {issue.name}
        </Link>
        <Button
          size='xs'
          variant='secondary'
          fullWidth={false}
          className='shrink-0 whitespace-nowrap'
          loading={isPending}
          onClick={handleAction}
        >
          {label}
        </Button>
      </div>

      <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1'>
        {issue.assignee_name && (
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <User className='h-3 w-3' />
            {issue.assignee_name}
          </span>
        )}
        {formattedDueDate && (
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Calendar className='h-3 w-3' />
            {formattedDueDate}
          </span>
        )}
        {issue.days_inactive > 0 && (
          <span className='flex items-center gap-1 text-xs text-(--warning-500)'>
            <Clock className='h-3 w-3' />
            {issue.days_inactive} {issue.days_inactive === 1 ? 'день' : 'дней'}{' '}
            без изменений
          </span>
        )}
      </div>

      {issue.transcript_evidence && (
        <div className='mt-2 flex gap-1.5 rounded border-l-2 border-primary/50 bg-primary/5 px-2.5 py-1.5'>
          <MessageSquare className='mt-0.5 h-3 w-3 shrink-0 text-primary' />
          <p className='text-xs italic text-muted-foreground'>
            "{issue.transcript_evidence}"
          </p>
        </div>
      )}
    </div>
  );
}
