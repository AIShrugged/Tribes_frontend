import { format, parseISO } from 'date-fns';
import { Calendar, CheckCircle2, Clock, Lightbulb, Users } from 'lucide-react';

import { MarkdownContent } from '@/shared/ui/markdown-content';

import type { MeetingCardArtifact } from '@/entities/artifact/model/types';

/**
 * formatTime.
 * @param iso - iso.
 * @returns Result.
 */
function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

/**
 * formatDate.
 * @param iso - iso.
 * @returns Result.
 */
function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

/**
 * MeetingCard component.
 * @param props - Component props.
 * @param props.data - Meeting card artifact data.
 * @returns Result.
 */
export function MeetingCard({ data }: { data: MeetingCardArtifact['data'] }) {
  const participants = data.participants ?? [];
  const keyPoints = data.key_points ?? [];
  const decisions = data.decisions ?? [];

  return (
    <div className='flex flex-col gap-4'>
      {/* Meta row */}
      <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1'>
          <Calendar className='w-3.5 h-3.5' />
          {formatDate(data.starts_at)}
        </span>
        <span className='flex items-center gap-1'>
          <Clock className='w-3.5 h-3.5' />
          {formatTime(data.starts_at)}
          {'\u2013'}
          {data.ends_at ? formatTime(data.ends_at) : ''}
        </span>
        {participants.length > 0 && (
          <span className='flex items-center gap-1'>
            <Users className='w-3.5 h-3.5' />
            {participants.join(', ')}
          </span>
        )}
      </div>

      {/* Summary */}
      {data.summary && <MarkdownContent>{data.summary}</MarkdownContent>}

      {/* Key points */}
      {keyPoints.length > 0 && (
        <div>
          <p className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2'>
            <Lightbulb className='w-3.5 h-3.5' />
            Key points
          </p>
          <ul className='flex flex-col gap-1'>
            {keyPoints.map((point, i) => {
              return (
                <li
                  key={i}
                  className='flex items-start gap-2 text-sm text-foreground'
                >
                  <span className='w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0' />
                  {point}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {decisions.length > 0 && (
        <div>
          <p className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2'>
            <CheckCircle2 className='w-3.5 h-3.5' />
            Decisions
          </p>
          <ul className='flex flex-col gap-1'>
            {decisions.map((d, i) => {
              return (
                <li
                  key={i}
                  className='flex items-start gap-2 text-sm text-foreground'
                >
                  <CheckCircle2 className='w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0' />
                  {d}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
