'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { type PropsWithChildren, useState } from 'react';

import { ROUTES } from '@/shared/lib/routes';

import type {
  IssueHealthCounts,
  IssueHealthOverdueItem,
  IssueHealthPriorityIgnoredItem,
  IssueHealthReport,
  IssueHealthSprintRiskItem,
} from '@/features/issues/model/types';

function formatDueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function OverdueCard({ item }: { item: IssueHealthOverdueItem }) {
  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-start justify-between gap-3 rounded-[var(--radius-button)] border border-red-500/15 bg-red-500/5 px-3 py-2 hover:bg-red-500/10 transition-colors'
    >
      <span className='text-sm text-foreground line-clamp-1 flex-1'>
        {item.name}
      </span>
      <div className='flex items-center gap-3 shrink-0 text-xs text-muted-foreground'>
        <span className='text-red-400 font-medium'>
          +{item.days_overdue} д.
        </span>
        <span>{formatDueDate(item.due_date)}</span>
        <span className='flex items-center gap-1'>
          <User className='h-3 w-3' />
          {item.assignee_name ?? 'Не назначен'}
        </span>
      </div>
    </Link>
  );
}

function SprintRiskCard({ item }: { item: IssueHealthSprintRiskItem }) {
  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-start justify-between gap-3 rounded-[var(--radius-button)] border border-yellow-500/15 bg-yellow-500/5 px-3 py-2 hover:bg-yellow-500/10 transition-colors'
    >
      <span className='text-sm text-foreground line-clamp-1 flex-1'>
        {item.name}
      </span>
      <div className='flex items-center gap-3 shrink-0 text-xs text-muted-foreground'>
        <span className='text-yellow-400 font-medium'>
          {item.days_until_due} д. до срока
        </span>
        <span>{formatDueDate(item.due_date)}</span>
        <span className='flex items-center gap-1'>
          <User className='h-3 w-3' />
          {item.assignee_name ?? 'Не назначен'}
        </span>
      </div>
    </Link>
  );
}

function PriorityIgnoredCard({
  item,
}: {
  item: IssueHealthPriorityIgnoredItem;
}) {
  const priorityClass =
    item.priority_label === 'critical'
      ? 'text-red-400 font-medium'
      : 'text-orange-400 font-medium';

  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-start justify-between gap-3 rounded-[var(--radius-button)] border border-orange-500/15 bg-orange-500/5 px-3 py-2 hover:bg-orange-500/10 transition-colors'
    >
      <span className='text-sm text-foreground line-clamp-1 flex-1'>
        {item.name}
      </span>
      <div className='flex items-center gap-3 shrink-0 text-xs text-muted-foreground'>
        <span className={priorityClass}>
          {item.priority_label === 'critical' ? 'Критический' : 'Высокий'}
        </span>
        <span>{item.days_inactive} дн. без активности</span>
        {!item.has_assignee && (
          <span className='flex items-center gap-1 text-orange-400'>
            <User className='h-3 w-3' />
            Нет исполнителя
          </span>
        )}
      </div>
    </Link>
  );
}

function HealthGroup({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className='flex flex-col gap-1.5'>
      <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
        {title}
      </p>
      <div className='flex flex-col gap-1'>{children}</div>
    </div>
  );
}

function CountBadges({ counts }: { counts: IssueHealthCounts }) {
  return (
    <div className='flex items-center gap-2 flex-wrap'>
      {counts.overdue > 0 && (
        <span className='inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400'>
          <Clock className='h-3 w-3' />
          Просрочено: {counts.overdue}
        </span>
      )}
      {counts.sprint_risk > 0 && (
        <span className='inline-flex items-center gap-1 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400'>
          <AlertTriangle className='h-3 w-3' />
          Риск спринта: {counts.sprint_risk}
        </span>
      )}
      {counts.priority_ignored > 0 && (
        <span className='inline-flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-400'>
          <Flag className='h-3 w-3' />
          Приоритет: {counts.priority_ignored}
        </span>
      )}
    </div>
  );
}

function IssueHealthExpanded({ report }: { report: IssueHealthReport }) {
  return (
    <div className='border-t border-orange-500/15 px-4 py-3 flex flex-col gap-3'>
      {report.ai_summary && (
        <p className='text-sm text-muted-foreground'>{report.ai_summary}</p>
      )}
      {report.findings.overdue.length > 0 && (
        <HealthGroup title='Просроченные задачи'>
          {report.findings.overdue.map((item) => {
            return <OverdueCard key={item.issue_id} item={item} />;
          })}
        </HealthGroup>
      )}
      {report.findings.sprint_risk.length > 0 && (
        <HealthGroup title='Риски спринта'>
          {report.findings.sprint_risk.map((item) => {
            return <SprintRiskCard key={item.issue_id} item={item} />;
          })}
        </HealthGroup>
      )}
      {report.findings.priority_ignored.length > 0 && (
        <HealthGroup title='Игнорируемые приоритеты'>
          {report.findings.priority_ignored.map((item) => {
            return <PriorityIgnoredCard key={item.issue_id} item={item} />;
          })}
        </HealthGroup>
      )}
    </div>
  );
}

export function IssueHealthBanner({
  teamName,
  report,
  updatedLabel,
}: {
  teamName: string;
  report: IssueHealthReport;
  updatedLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { counts } = report.findings;
  const hasIssues =
    counts.overdue > 0 || counts.sprint_risk > 0 || counts.priority_ignored > 0;

  if (!hasIssues) return null;

  return (
    <div className='rounded-[var(--radius-card)] border border-orange-500/25 bg-orange-950/10'>
      <button
        type='button'
        onClick={() => {
          setExpanded((v) => {
            return !v;
          });
        }}
        className='w-full flex items-center gap-2.5 px-4 py-3 text-left'
      >
        <AlertTriangle className='h-4 w-4 shrink-0 text-orange-400' />
        <span className='text-sm font-medium text-foreground'>{teamName}</span>
        <span className='text-xs text-muted-foreground'>{updatedLabel}</span>
        <div className='ml-auto flex items-center gap-2'>
          <CountBadges counts={counts} />
          {expanded ? (
            <ChevronUp className='h-4 w-4 text-muted-foreground' />
          ) : (
            <ChevronDown className='h-4 w-4 text-muted-foreground' />
          )}
        </div>
      </button>
      {expanded && <IssueHealthExpanded report={report} />}
    </div>
  );
}
