import { format, parseISO } from 'date-fns';
import { CheckCircle2, Circle, ExternalLink, Users } from 'lucide-react';

import { Badge } from '@/shared/ui/badge/Badge';

import type { TabMeetingReadiness } from '../../model/dashboard-types';

const STATUS_VARIANT = {
  ready: 'success',
  attention: 'warning',
  none: 'default',
} as const;

const STATUS_LABEL = {
  ready: 'Ready',
  attention: 'Needs Attention',
  none: 'No Data',
} as const;

interface TeamDashboardTabReadinessProps {
  data: TabMeetingReadiness;
}

/**
 * TeamDashboardTabReadiness — meeting readiness checklist and details.
 * @param props - Component props.
 * @param props.data
 */
export default function TeamDashboardTabReadiness({
  data,
}: TeamDashboardTabReadinessProps) {
  const passedCount = data.checks.filter((c) => {
    return c.value;
  }).length;

  return (
    <div className='flex flex-col gap-6'>
      {/* Score + status */}
      <div className='flex items-center gap-4'>
        <div>
          <div className='flex items-center gap-2'>
            <span className='text-4xl font-bold text-foreground'>
              {passedCount}
            </span>
            <span className='text-xl text-muted-foreground'>
              / {data.checks.length}
            </span>
          </div>
          <p className='text-xs text-muted-foreground mt-0.5'>checks passed</p>
        </div>
        <Badge variant={STATUS_VARIANT[data.status]}>
          {STATUS_LABEL[data.status]}
        </Badge>
      </div>

      {/* Checklist */}
      {data.checks.length > 0 && (
        <div className='flex flex-col gap-2'>
          {data.checks.map((check) => {
            return (
              <div key={check.key} className='flex items-center gap-2'>
                {check.value ? (
                  <CheckCircle2 className='h-4 w-4 text-emerald-400 flex-shrink-0' />
                ) : (
                  <Circle className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                )}
                <span
                  className={`text-sm ${check.value ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {check.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes */}
      {data.notes.length > 0 && (
        <ul className='flex flex-col gap-1'>
          {data.notes.map((note, i) => {
            return (
              <li
                key={i}
                className='text-xs text-muted-foreground italic before:content-["·"] before:mr-1.5'
              >
                {note}
              </li>
            );
          })}
        </ul>
      )}

      {/* Upcoming meeting card */}
      {data.meeting && (
        <div className='rounded-[var(--radius-card)] border border-border bg-card p-4 flex flex-col gap-2'>
          <p className='text-sm font-semibold text-foreground'>
            {data.meeting.title}
          </p>
          <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>
            <span>
              {format(parseISO(data.meeting.starts_at), 'MMM d, HH:mm')}
              {data.meeting.ends_at !== null && (
                <> — {format(parseISO(data.meeting.ends_at), 'HH:mm')}</>
              )}
            </span>
            {data.meeting.platform !== null && (
              <span className='capitalize'>
                {data.meeting.platform.replace('_', ' ')}
              </span>
            )}
            <span className='flex items-center gap-1'>
              <Users className='h-3 w-3' />
              {data.meeting.participants_count}
            </span>
          </div>
          {data.meeting.meeting_link && (
            <a
              href={data.meeting.meeting_link.url}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-fit'
            >
              <ExternalLink className='h-3 w-3' />
              {data.meeting.meeting_link.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
