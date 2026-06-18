'use client';

import { useRouter } from 'next/navigation';

import { ReportStatusBadge } from '@/features/commit-reports/ui/commit-report-badges';
import { ROUTES } from '@/shared/lib/routes';

import type { CommitReportSummary } from '@/features/commit-reports/model/types';

export function CommitReportCard({ report }: { report: CommitReportSummary }) {
  const router = useRouter();
  const open = () => {
    router.push(ROUTES.DASHBOARD.CHANGELOG_DETAIL(report.id));
  };

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
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-base font-semibold text-foreground'>
            {report.period_end ?? report.repo}
          </h3>
          <p className='mt-0.5 truncate text-sm text-muted-foreground'>
            {report.repo} · {report.branch}
          </p>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>

      {report.summary && (
        <p className='mt-2 line-clamp-2 text-sm text-muted-foreground'>
          {report.summary}
        </p>
      )}

      <p className='mt-2 text-xs text-muted-foreground'>
        {report.added_count} added · {report.fixed_count} fixed ·{' '}
        {report.commit_count} commits
      </p>

      {report.matched_count > 0 && (
        <p className='mt-0.5 text-xs text-muted-foreground'>
          {report.matched_count} matched · {report.reviewed_count} reviewed
        </p>
      )}
    </article>
  );
}
