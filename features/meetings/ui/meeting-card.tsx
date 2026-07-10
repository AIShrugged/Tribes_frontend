'use client';

import {
  Bot,
  BotOff,
  Building2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { getMeetingDisplayState } from '@/features/meetings/model/meeting-state';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';

import { useBotManage, type BotOrgOption } from '../model/bot-manage-context';

import { BotToggleButton } from './bot-toggle-button';
import { MeetingJoinButton } from './meeting-join-button';

import type { CalendarEventListItem } from '@/features/meetings/model/types';

function resolveOrgName(
  organizations: BotOrgOption[],
  organizationId: number | null,
): string | null {
  if (organizationId == null) {
    return null;
  }

  return (
    organizations.find((o) => {
      return o.id === organizationId;
    })?.name ?? null
  );
}

function formatTimeRange(startsAt: Date, endsAt: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${formatter.format(startsAt)} – ${formatter.format(endsAt)}`;
}

function getPlatformLabel(platform: string) {
  return platform.trim().length > 0 ? platform : 'Unknown platform';
}

function PlatformLink({
  platform,
  url,
}: {
  platform: string;
  url?: string | null;
}) {
  if (!url) {
    return <span>{getPlatformLabel(platform)}</span>;
  }

  return (
    <a
      href={url}
      target='_blank'
      rel='noreferrer'
      className='inline-flex items-center gap-1 text-primary hover:underline'
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <span>{getPlatformLabel(platform)}</span>
      <ExternalLink className='h-3 w-3' />
    </a>
  );
}

type BotStatus = 'not_required' | 'scheduled' | 'missed' | 'attended';

function getBotStatus(meeting: CalendarEventListItem, now: Date): BotStatus {
  if (!meeting.required_bot) return 'not_required';
  if (meeting.has_summary) return 'attended';

  return new Date(meeting.starts_at) > now ? 'scheduled' : 'missed';
}

const BOT_BADGE_CONFIG: Record<
  BotStatus,
  {
    variant: 'default' | 'primary' | 'success' | 'destructive';
    label: string;
    icon: 'bot' | 'bot-off';
  }
> = {
  not_required: {
    variant: 'default',
    label: 'Bot not required',
    icon: 'bot-off',
  },
  scheduled: { variant: 'primary', label: 'Bot scheduled', icon: 'bot' },
  missed: { variant: 'destructive', label: 'Bot missed', icon: 'bot-off' },
  attended: { variant: 'success', label: 'Bot attended', icon: 'bot' },
};

const STATE_BORDER_CLASS: Record<
  ReturnType<typeof getMeetingDisplayState>,
  string
> = {
  active: 'border-emerald-500/40',
  upcoming_with_bot: 'border-primary/30',
  upcoming_no_bot: 'border-border',
  past_with_summary: 'border-primary/20',
  past_missed_bot: 'border-destructive/20',
  past_no_bot: 'border-border',
};

interface MeetingCardProps {
  meeting: CalendarEventListItem;
}

/**
 * MeetingCard component.
 * @param props - Component props.
 * @param props.meeting - Calendar event item.
 */
export function MeetingCard({ meeting }: MeetingCardProps) {
  const router = useRouter();
  const { organizations } = useBotManage();
  const now = new Date();
  const orgName = resolveOrgName(organizations, meeting.organization_id);
  const startsAt = new Date(meeting.starts_at);
  const endsAt = new Date(meeting.ends_at);
  const isReady = Boolean(meeting.has_summary);
  const botStatus = getBotStatus(meeting, now);
  const botBadge = BOT_BADGE_CONFIG[botStatus];
  const displayState = getMeetingDisplayState(meeting, now);
  const isCompleted = isReady;
  const borderClass = STATE_BORDER_CLASS[displayState];

  return (
    <article
      role='button'
      tabIndex={0}
      className={`relative cursor-pointer overflow-hidden rounded-[var(--radius-card)] border ${borderClass} bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg`}
      onClick={() => {
        router.push(ROUTES.DASHBOARD.MEETING_DETAIL(meeting.id));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(ROUTES.DASHBOARD.MEETING_DETAIL(meeting.id));
        }
      }}
    >
      {/* Active indicator */}
      {displayState === 'active' && (
        <div className='absolute left-0 top-0 h-full w-1 rounded-l-[var(--radius-card)] bg-emerald-500' />
      )}

      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0 flex-1'>
          <h3 className='text-base font-semibold text-foreground transition-colors hover:text-primary'>
            {meeting.title}
          </h3>

          <div className='mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground'>
            <span>{formatTimeRange(startsAt, endsAt)}</span>
            <span className='text-border'>•</span>
            <PlatformLink platform={meeting.platform} url={meeting.url} />
          </div>
        </div>
      </div>

      <p className='mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground'>
        {meeting.description ?? 'No description provided.'}
      </p>

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        <Badge variant={botBadge.variant} className='gap-1'>
          {botBadge.icon === 'bot' ? (
            <Bot className='h-3.5 w-3.5' />
          ) : (
            <BotOff className='h-3.5 w-3.5' />
          )}
          {botBadge.label}
        </Badge>

        {isReady && (
          <Badge variant='success' className='gap-1'>
            <CheckCircle2 className='h-3.5 w-3.5' />
            Summary ready
          </Badge>
        )}

        {orgName && (
          <Badge variant='default' className='gap-1'>
            <Building2 className='h-3.5 w-3.5' />
            {orgName}
          </Badge>
        )}

        <MeetingJoinButton url={meeting.url} isCompleted={isCompleted} />

        <BotToggleButton
          eventId={meeting.id}
          isBotAdded={meeting.required_bot}
          creatorUserId={meeting.creator_user_id}
        />
      </div>
    </article>
  );
}
