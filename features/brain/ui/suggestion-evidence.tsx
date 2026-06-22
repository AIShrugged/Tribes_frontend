import { CalendarDays, CheckSquare, Lightbulb, Quote } from 'lucide-react';
import Link from 'next/link';

import { ROUTES } from '@/shared/lib/routes';

import type { BrainSuggestionEvidence } from '@/features/brain/model/types';

interface Props {
  evidence: BrainSuggestionEvidence | null;
}

const linkClass =
  'inline-flex items-center gap-1 rounded-[var(--r-sm)] text-[var(--primary)] hover:underline';
const refClass =
  'inline-flex items-center gap-1 text-[var(--muted-foreground)]';

/**
 * Evidence block for a suggestion: links meeting/issue references to their app
 * pages (decisions have no detail route, shown as text) plus the source quote.
 * @param root0 - props.
 * @param root0.evidence - the suggestion's evidence object, if any.
 */
export function SuggestionEvidence({ evidence }: Props) {
  if (!evidence) return null;

  const hasRefs =
    evidence.meeting_id != null ||
    evidence.issue_id != null ||
    evidence.decision_id != null;

  if (!hasRefs && !evidence.quote) return null;

  return (
    <div className='flex flex-col gap-2'>
      {hasRefs && (
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs'>
          {evidence.meeting_id != null && (
            <Link
              href={ROUTES.DASHBOARD.MEETING_DETAIL(evidence.meeting_id)}
              className={linkClass}
            >
              <CalendarDays className='h-3.5 w-3.5' aria-hidden='true' />
              Встреча #{evidence.meeting_id}
            </Link>
          )}
          {evidence.issue_id != null && (
            <Link
              href={ROUTES.DASHBOARD.ISSUES_DETAIL(evidence.issue_id)}
              className={linkClass}
            >
              <CheckSquare className='h-3.5 w-3.5' aria-hidden='true' />
              Задача #{evidence.issue_id}
            </Link>
          )}
          {evidence.decision_id != null && (
            <span className={refClass}>
              <Lightbulb className='h-3.5 w-3.5' aria-hidden='true' />
              Решение #{evidence.decision_id}
            </span>
          )}
        </div>
      )}
      {evidence.quote && (
        <blockquote className='flex gap-2 rounded-[var(--r-md)] border-l-2 border-[var(--primary)] bg-[var(--surface-3)] px-3 py-2 text-xs italic text-[var(--muted-foreground)]'>
          <Quote className='h-3.5 w-3.5 flex-shrink-0' aria-hidden='true' />
          <span>{evidence.quote}</span>
        </blockquote>
      )}
    </div>
  );
}
