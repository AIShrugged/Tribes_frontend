import {
  getIssueStats,
  getIssueStatsHistory,
  IssueProgressPage,
} from '@/features/issues';

import type { IssueHistoryPeriod } from '@/features/issues';

const VALID_PERIODS = new Set<IssueHistoryPeriod>(['day', 'week', 'month']);

export default async function IssuesProgressPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    assignee_id?: string;
    organization_id?: string;
  }>;
}) {
  const {
    period: rawPeriod,
    assignee_id,
    organization_id,
  } = await searchParams;
  const period: IssueHistoryPeriod = VALID_PERIODS.has(
    rawPeriod as IssueHistoryPeriod,
  )
    ? (rawPeriod as IssueHistoryPeriod)
    : 'week';

  const hasActiveFilters = Boolean(assignee_id ?? organization_id);

  const [stats, history] = await Promise.all([
    getIssueStats(),
    getIssueStatsHistory(period),
  ]);

  return (
    <IssueProgressPage
      stats={stats}
      history={history}
      period={period}
      hasActiveFilters={hasActiveFilters}
    />
  );
}
