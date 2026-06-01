import { Calendar, CalendarDays, CheckCircle2 } from 'lucide-react';

import { getIssueStats } from '@/features/issues';
import { DeltaBadge } from '@/shared/ui/stats/delta-badge';

import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  iconClassName: string;
  delta: number;
  deltaLabel: string;
}

function StatCard({
  label,
  value,
  icon,
  iconClassName,
  delta,
  deltaLabel,
}: StatCardProps) {
  return (
    <div className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-muted-foreground'>
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-md ${iconClassName}`}
        >
          {icon}
        </div>
      </div>
      <p className='text-3xl font-bold text-foreground tabular-nums'>{value}</p>
      <DeltaBadge delta={delta} label={deltaLabel} />
    </div>
  );
}

export async function ClosedTasksBlock() {
  const stats = await getIssueStats();

  return (
    <section className='flex flex-col gap-3'>
      <h3 className='text-sm font-medium text-muted-foreground'>
        Closed Tasks
      </h3>
      <div className='grid grid-cols-3 gap-3'>
        <StatCard
          label='Closed Today'
          value={stats.closed_today}
          icon={<CheckCircle2 className='h-4 w-4' />}
          iconClassName='bg-accent/15 text-emerald-400'
          delta={stats.delta_today}
          deltaLabel='vs yesterday'
        />
        <StatCard
          label='Closed This Week'
          value={stats.closed_this_week}
          icon={<CalendarDays className='h-4 w-4' />}
          iconClassName='bg-primary/10 text-primary'
          delta={stats.delta_week}
          deltaLabel='vs last week'
        />
        <StatCard
          label='Closed This Month'
          value={stats.closed_this_month}
          icon={<Calendar className='h-4 w-4' />}
          iconClassName='bg-violet-500/10 text-violet-400'
          delta={stats.delta_month}
          deltaLabel='vs last month'
        />
      </div>
    </section>
  );
}
