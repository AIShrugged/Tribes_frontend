'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ROUTES } from '@/shared/lib/routes';

import type {
  IssueHealthOverdueItem,
  IssueHealthPriorityIgnoredItem,
  IssueHealthReport,
  IssueHealthSprintRiskItem,
} from '../model/types';
import type { PropsWithChildren } from 'react';

// ---------------------------------------------------------------------------
// Header pulse dot
// ---------------------------------------------------------------------------

function PulseDot() {
  return (
    <span className='relative flex h-2 w-2 shrink-0'>
      <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75' />
      <span className='relative inline-flex h-2 w-2 rounded-full bg-red-500' />
    </span>
  );
}

// ---------------------------------------------------------------------------
// AI Summary card with markdown rendering
// ---------------------------------------------------------------------------

function HealthMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => {
          return (
            <p className='text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0'>
              {children}
            </p>
          );
        },
        ul: ({ children }) => {
          return <ul className='flex flex-col gap-1.5 mb-3'>{children}</ul>;
        },
        li: ({ children }) => {
          return (
            <li className='flex items-start gap-2 text-sm text-muted-foreground leading-relaxed'>
              <span className='mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-400' />
              <span>{children}</span>
            </li>
          );
        },
        strong: ({ children }) => {
          return (
            <strong className='font-semibold text-foreground'>
              {children}
            </strong>
          );
        },
        em: ({ children }) => {
          return <em className='italic'>{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function splitSummary(summary: string): { title: string; body: string } {
  const parts = summary.split(/\n\n+/);
  if (parts.length >= 2) {
    return { title: parts[0].trim(), body: parts.slice(1).join('\n\n').trim() };
  }
  const newline = summary.indexOf('\n');
  if (newline !== -1) {
    return {
      title: summary.slice(0, newline).trim(),
      body: summary.slice(newline + 1).trim(),
    };
  }
  return { title: summary.trim(), body: '' };
}

function AiSummaryCard({ summary }: { summary: string }) {
  const { title, body } = splitSummary(summary);
  return (
    <div className='mb-4 rounded-button border border-red-500/25 border-l-[3px] border-l-red-500 bg-linear-to-b from-red-500/6 to-red-500/2 px-4 py-3.5'>
      <div className='mb-3 flex items-center gap-2.5 flex-wrap'>
        <span className='shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-widest bg-red-500 text-white'>
          Критическое состояние
        </span>
        {title && (
          <span className='text-sm font-medium text-foreground'>{title}</span>
        )}
      </div>
      {body && <HealthMarkdown content={body} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  sub: string;
  variant: 'danger' | 'warn' | 'info' | 'ok';
}

const STAT_BAR: Record<StatCardProps['variant'], string> = {
  danger: 'bg-red-500',
  warn: 'bg-yellow-500',
  info: 'bg-blue-400',
  ok: 'bg-green-400',
};

const STAT_NUM: Record<StatCardProps['variant'], string> = {
  danger: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  ok: 'text-green-400',
};

function StatCard({ label, value, sub, variant }: StatCardProps) {
  return (
    <div className='relative overflow-hidden rounded-button border border-border bg-secondary px-3.5 py-3'>
      <div
        className={`absolute inset-y-0 left-0 w-[3px] ${STAT_BAR[variant]}`}
      />
      <p className='text-xs text-muted-foreground'>{label}</p>
      <div className='mt-1.5 flex items-baseline gap-2'>
        <span
          className={`text-2xl font-semibold tracking-tight ${STAT_NUM[variant]}`}
        >
          {value}
        </span>
        {sub && (
          <span className='text-[11.5px] text-muted-foreground/70 leading-none'>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insight groups (expanded view)
// ---------------------------------------------------------------------------

function InsightGroup({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className='rounded-button border border-border bg-secondary p-3'>
      <p className='mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'>
        {title}
      </p>
      <div className='flex flex-col gap-1'>{children}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function OverdueRow({ item }: { item: IssueHealthOverdueItem }) {
  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-center gap-2.5 rounded-button border border-transparent bg-white/1.5 px-2.5 py-2 transition-colors hover:border-border hover:bg-white/3'
    >
      <span className='shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide bg-red-500/10 text-red-400'>
        +{Math.round(item.days_overdue)} дн.
      </span>
      <span className='flex-1 min-w-0 text-sm truncate text-foreground'>
        {item.name}
      </span>
      <span className='shrink-0 text-[11.5px] text-muted-foreground'>
        {item.assignee_name ?? 'Не назначен'} · {formatDate(item.due_date)}
      </span>
      <ChevronRight className='shrink-0 h-3.5 w-3.5 text-muted-foreground' />
    </Link>
  );
}

function SprintRiskRow({ item }: { item: IssueHealthSprintRiskItem }) {
  const label =
    item.days_until_due === 0 ? 'Сегодня' : `через ${item.days_until_due} дн.`;
  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-center gap-2.5 rounded-button border border-transparent bg-white/1.5 px-2.5 py-2 transition-colors hover:border-border hover:bg-white/3'
    >
      <span className='shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide bg-yellow-500/10 text-yellow-400'>
        {label}
      </span>
      <span className='flex-1 min-w-0 text-sm truncate text-foreground'>
        {item.name}
      </span>
      <span className='shrink-0 text-[11.5px] text-muted-foreground'>
        {item.assignee_name ?? 'Не назначен'} · {formatDate(item.due_date)}
      </span>
      <ChevronRight className='shrink-0 h-3.5 w-3.5 text-muted-foreground' />
    </Link>
  );
}

function PriorityIgnoredRow({
  item,
}: {
  item: IssueHealthPriorityIgnoredItem;
}) {
  const isCritical = item.priority_label === 'critical';
  return (
    <Link
      href={`${ROUTES.DASHBOARD.ISSUES}/${item.issue_id}`}
      className='flex items-center gap-2.5 rounded-button border border-transparent bg-white/1.5 px-2.5 py-2 transition-colors hover:border-border hover:bg-white/3'
    >
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
          isCritical
            ? 'bg-red-500/10 text-red-400'
            : 'bg-orange-500/10 text-orange-400'
        }`}
      >
        {isCritical ? 'Критический' : 'Высокий'}
      </span>
      <span className='flex-1 min-w-0 text-sm truncate text-foreground'>
        {item.name}
      </span>
      <span className='shrink-0 text-[11.5px] text-muted-foreground'>
        {item.has_assignee ? 'Без активности' : 'Нет исполнителя'} ·{' '}
        {Math.round(item.days_inactive)} дн.
      </span>
      <ChevronRight className='shrink-0 h-3.5 w-3.5 text-muted-foreground' />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sub-text helpers for stat cards
// ---------------------------------------------------------------------------

function overdueSubText(items: IssueHealthOverdueItem[]): string {
  if (items.length === 0) return '';
  const max = Math.max(
    ...items.map((i) => {
      return Math.round(i.days_overdue);
    }),
  );
  return `до ${max} дн. просрочки`;
}

function todaySubText(items: IssueHealthSprintRiskItem[]): string {
  const today = items.filter((i) => {
    return i.days_until_due === 0;
  });
  const noAssignee = today.filter((i) => {
    return !i.assignee_name;
  }).length;
  if (noAssignee === 0) return '';
  return `${noAssignee} без ответственного`;
}

function weekSubText(items: IssueHealthSprintRiskItem[]): string {
  const people = new Set(
    items
      .map((i) => {
        return i.assignee_name;
      })
      .filter(Boolean),
  );
  if (people.size === 0) return '';
  return `у ${people.size} ${people.size === 1 ? 'сотрудника' : 'сотрудников'}`;
}

function prioritySubText(items: IssueHealthPriorityIgnoredItem[]): string {
  const noAssignee = items.filter((i) => {
    return !i.has_assignee;
  }).length;
  if (noAssignee === 0) return 'все назначены';
  return `${noAssignee} без исполнителя`;
}

// ---------------------------------------------------------------------------
// Grid class lookup
// ---------------------------------------------------------------------------

const GRID_CLASS_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-3',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IssueHealthAttentionCard({
  teamName,
  report,
  updatedLabel,
}: {
  teamName: string;
  report: IssueHealthReport;
  updatedLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { findings } = report;
  const { counts } = findings;

  const todayRiskCount = findings.sprint_risk.filter((i) => {
    return i.days_until_due === 0;
  }).length;
  const criticalCount = findings.priority_ignored.filter((i) => {
    return i.priority_label === 'critical';
  }).length;

  const nonEmptyGroupCount = [
    findings.overdue.length > 0,
    findings.sprint_risk.length > 0,
    findings.priority_ignored.length > 0,
  ].filter(Boolean).length;

  const gridClass = GRID_CLASS_MAP[nonEmptyGroupCount] ?? 'grid-cols-1';

  return (
    <div className='rounded-card border border-border bg-card p-5'>
      {/* Header */}
      <div className='mb-4 flex items-center justify-between gap-4'>
        <div className='flex items-center gap-2.5 text-sm font-semibold'>
          <PulseDot />
          Требуют внимания · {teamName}
        </div>
        <div className='flex items-center gap-3 shrink-0'>
          <span className='text-xs text-muted-foreground'>{updatedLabel}</span>
          <button
            type='button'
            onClick={() => {
              setExpanded((v) => {
                return !v;
              });
            }}
            className='flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors'
          >
            {expanded ? 'Скрыть' : 'Показать все'}
            {expanded ? (
              <ChevronDown className='h-3 w-3' />
            ) : (
              <ChevronRight className='h-3 w-3' />
            )}
          </button>
        </div>
      </div>

      {/* AI summary */}
      {report.ai_summary && <AiSummaryCard summary={report.ai_summary} />}

      {/* Stats grid */}
      <div
        className='grid grid-cols-2 gap-2.5 sm:grid-cols-4'
        style={expanded ? { marginBottom: '1rem' } : undefined}
      >
        <StatCard
          label='Просрочено'
          value={counts.overdue}
          sub={overdueSubText(findings.overdue)}
          variant='danger'
        />
        <StatCard
          label='Дедлайн сегодня'
          value={todayRiskCount}
          sub={todaySubText(findings.sprint_risk)}
          variant='warn'
        />
        <StatCard
          label='На этой неделе'
          value={counts.sprint_risk}
          sub={weekSubText(findings.sprint_risk)}
          variant='info'
        />
        <StatCard
          label='Критический приоритет'
          value={criticalCount}
          sub={prioritySubText(findings.priority_ignored)}
          variant='ok'
        />
      </div>

      {/* Expandable insights */}
      {expanded && nonEmptyGroupCount > 0 && (
        <div className={`grid gap-3 ${gridClass}`}>
          {findings.overdue.length > 0 && (
            <InsightGroup title='Просроченные задачи'>
              {findings.overdue.map((item) => {
                return <OverdueRow key={item.issue_id} item={item} />;
              })}
            </InsightGroup>
          )}
          {findings.sprint_risk.length > 0 && (
            <InsightGroup title='Риски дедлайна'>
              {findings.sprint_risk.map((item) => {
                return <SprintRiskRow key={item.issue_id} item={item} />;
              })}
            </InsightGroup>
          )}
          {findings.priority_ignored.length > 0 && (
            <InsightGroup title='Игнорируемые приоритеты'>
              {findings.priority_ignored.map((item) => {
                return <PriorityIgnoredRow key={item.issue_id} item={item} />;
              })}
            </InsightGroup>
          )}
        </div>
      )}
    </div>
  );
}
