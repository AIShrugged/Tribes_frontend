import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { ROUTES } from '@/shared/lib/routes';

import type {
  AddCommentResult,
  BrainAppliedResult,
  CreateIssueResult,
  UpdateTaskStatusResult,
} from '@/features/brain/model/types';
import type { ReactNode } from 'react';

interface Props {
  suggestionKey: string;
  result: BrainAppliedResult | null;
}

function getIssueId(result: BrainAppliedResult | null): number | null {
  const id = (result as { issue_id?: unknown } | null)?.issue_id;

  return typeof id === 'number' ? id : null;
}

function renderSummary(
  suggestionKey: string,
  result: BrainAppliedResult,
): ReactNode {
  if (suggestionKey === 'update_task_status') {
    const typed = result as UpdateTaskStatusResult;

    return (
      <span>
        Статус изменён:{' '}
        <span className='font-medium'>«{typed.old_status}»</span> →{' '}
        <span className='font-medium'>«{typed.new_status}»</span>
      </span>
    );
  }

  if (suggestionKey === 'add_comment') {
    const typed = result as AddCommentResult;

    return <span>Комментарий добавлен к задаче #{typed.issue_id}</span>;
  }

  const typed = result as CreateIssueResult;

  return <span>Задача создана{typed.name ? `: «${typed.name}»` : ''}</span>;
}

/**
 * Renders the outcome of an applied suggestion: a created-issue link, a
 * status-change summary or a comment-added confirmation, per the action type.
 * @param root0 - props.
 * @param root0.suggestionKey - the suggestion's action key.
 * @param root0.result - the backend `applied_result` payload.
 */
export function SuggestionResult({ suggestionKey, result }: Props) {
  if (!result) return null;

  const issueId = getIssueId(result);

  return (
    <div className='flex flex-wrap items-center gap-2 rounded-[var(--r-md)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success)]'>
      <CheckCircle2 className='h-4 w-4 flex-shrink-0' aria-hidden='true' />
      {renderSummary(suggestionKey, result)}
      {issueId != null && (
        <Link
          href={ROUTES.DASHBOARD.ISSUES_DETAIL(issueId)}
          className='inline-flex items-center gap-1 font-medium underline hover:no-underline'
        >
          Открыть #{issueId}
          <ExternalLink className='h-3 w-3' aria-hidden='true' />
        </Link>
      )}
    </div>
  );
}
