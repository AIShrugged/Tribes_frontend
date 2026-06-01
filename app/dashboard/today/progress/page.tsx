import { Suspense } from 'react';

import {
  getIssueStats,
  getIssueStatsHistory,
  IssueProgressPage,
} from '@/features/issues';
import {
  AiNudge,
  AiPrepPanel,
  getTodayBriefing,
  StaleItems,
  WaitingOnYou,
} from '@/features/today-briefing';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import type { IssueHistoryPeriod } from '@/features/issues';

export const metadata = { title: 'Tasks' };

const VALID_PERIODS = new Set<IssueHistoryPeriod>(['day', 'week', 'month']);

async function AiNudgeSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  if (briefing.events.length === 0 || !briefing.nudge) return null;
  return (
    <AiNudge key={briefing.date} text={briefing.nudge} date={briefing.date} />
  );
}

async function AiPrepSection({ date }: { date?: string }) {
  const briefing = await getTodayBriefing(date);
  if (briefing.events.length === 0) return null;
  return (
    <div className='flex flex-col gap-8'>
      {briefing.events.map((event) => {
        return (
          <AiPrepPanel
            key={event.id}
            event={event}
            tasks={event.tasks}
            carriedTasks={briefing.carried_tasks}
          />
        );
      })}
      <WaitingOnYou tasks={briefing.waiting_on_you} />
      <StaleItems tasks={briefing.stale} />
    </div>
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

      <Suspense
        fallback={
          <div className='rounded-[var(--radius-card)] border border-border bg-card p-5'>
            <Skeleton className='mb-3 h-4 w-48' />
            <Skeleton className='h-20 w-full' />
          </div>
        }
      >
        <AiPrepSection date={date} />
      </Suspense>
    </div>
  );
}
