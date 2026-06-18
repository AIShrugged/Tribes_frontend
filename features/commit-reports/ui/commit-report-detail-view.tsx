import { ReportStatusBadge } from '@/features/commit-reports/ui/commit-report-badges';
import { CommitReportItemCard } from '@/features/commit-reports/ui/commit-report-item-card';

import type {
  CommitReportDetail,
  CommitReportItem,
} from '@/features/commit-reports/model/types';

function Group({ title, items }: { title: string; items: CommitReportItem[] }) {
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-semibold text-foreground'>
        {title} <span className='text-muted-foreground'>({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Nothing in this group.</p>
      ) : (
        <div className='space-y-2'>
          {items.map((item) => {
            return <CommitReportItemCard key={item.id} item={item} />;
          })}
        </div>
      )}
    </section>
  );
}

export function CommitReportDetailView({
  detail,
}: {
  detail: CommitReportDetail;
}) {
  const period =
    detail.period_start === detail.period_end
      ? (detail.period_end ?? '')
      : `${detail.period_start ?? '?'} – ${detail.period_end ?? '?'}`;

  return (
    <div className='space-y-5 px-5 py-4'>
      <header className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='text-lg font-semibold text-foreground'>
            {detail.repo}
          </h2>
          <code className='rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-xs text-muted-foreground'>
            {detail.branch}
          </code>
          <ReportStatusBadge status={detail.status} />
        </div>
        <p className='text-sm text-muted-foreground'>
          {period} · {detail.commit_count} of {detail.total_in_window} commits ·{' '}
          {detail.added.length} added · {detail.fixed.length} fixed
        </p>
        {detail.summary && (
          <p className='text-sm text-foreground'>{detail.summary}</p>
        )}
      </header>

      <Group title='Added' items={detail.added} />
      <Group title='Fixed' items={detail.fixed} />
    </div>
  );
}
