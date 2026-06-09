import { Suspense } from 'react';

import {
  getIssueStats,
  getIssueStatsHistory,
  IssueProgressPage,
} from '@/features/issues';
import { MeetingTaskReviewContainer } from '@/features/meeting-task-review';
import { AiNudge, getTodayBriefing } from '@/features/today-briefing';

import type { IssueHistoryPeriod } from '@/features/issues';

export const metadata = { title: 'Tasks' };

const VALID_PERIODS = new Set<IssueHistoryPeriod>(['day', 'week', 'month']);

async function AiNudgeSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  // The nudge is built from tasks (overdue / stale / assigned) as well as
  // meetings, so it stays useful on days with no meetings — only require that
  // a nudge was actually generated (cached by the daily cron).
  if (!briefing.nudge) return null;
  return (
    <AiNudge key={briefing.date} text={briefing.nudge} date={briefing.date} />
  );
}

export default async function TodayProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const { period: rawPeriod, date } = await searchParams;
  const period: IssueHistoryPeriod = VALID_PERIODS.has(
    rawPeriod as IssueHistoryPeriod,
  )
    ? (rawPeriod as IssueHistoryPeriod)
    : 'week';

  const [stats, history] = await Promise.all([
    getIssueStats(),
    getIssueStatsHistory(period),
  ]);

  return (
    <div className='flex flex-col gap-4'>
      <Suspense fallback={<div className='h-0' />}>
        <AiNudgeSection date={date} />
      </Suspense>

      <IssueProgressPage stats={stats} history={history} period={period} />

      {/* Meeting Task Review — shows latest AI task analysis for the org */}
      <MeetingTaskReviewContainer />
    </div>
  );
}
