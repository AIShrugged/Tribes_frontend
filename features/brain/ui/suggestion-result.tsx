import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { ROUTES } from '@/shared/lib/routes';

import type {
  BrainAppliedResult,
  CreateIssueResult,
  UpdateTaskStatusResult,
} from '@/features/brain/model/types';

interface Props {
  suggestionKey: string;
  result: BrainAppliedResult | null;
}

function getIssueId(result: BrainAppliedResult | null): number | null {
  const id = (result as { issue_id?: unknown } | null)?.issue_id;

  return typeof id === 'number' ? id : null;
}

/**
 * Renders the outcome of an applied suggestion: a link to the created issue or a
 * status-change summary, depending on the action type.
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
      {suggestionKey === 'update_task_status' ? (
        <span>
          Статус изменён:{' '}
          <span className='font-medium'>
            «{(result as UpdateTaskStatusResult).old_status}»
          </span>{' '}
          →{' '}
          <span className='font-medium'>
            «{(result as UpdateTaskStatusResult).new_status}»
          </span>
        </span>
      ) : (
        <span>
          Задача создана
          {(result as CreateIssueResult).name
            ? `: «${(result as CreateIssueResult).name}»`
            : ''}
        </span>
      )}
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
