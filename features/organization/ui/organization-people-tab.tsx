'use client';

import {
  Activity,
  MessageSquareText,
  Sparkles,
  Timer,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { TeamMemberAddModal } from '@/features/teams';
import { cancelTeamInvite, kickTeamMember } from '@/features/teams/api/team';
import { avatarColor, initials } from '@/features/teams/model/avatar-utils';
import { useModal } from '@/shared/hooks/use-modal';
import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button, ButtonIcon } from '@/shared/ui/button';
import Avatar from '@/shared/ui/common/avatar';

import type { TeamInvite, TeamMember } from '@/entities/team';
import type {
  PersonInsightCategoryValue,
  PersonMember,
  TabPeople,
} from '@/features/teams/model/dashboard-types';

interface OrganizationMember extends TeamMember {
  teamNames: string[];
}

interface OrganizationPeopleTabProps {
  analyticsData: TabPeople | null;
  members: OrganizationMember[];
  pendingInvites: TeamInvite[];
  defaultTeamId: number | null;
  isManager: boolean;
  currentUserId: number | null;
}

interface MemberRowProps {
  member: OrganizationMember;
  analytics: PersonMember | null;
  defaultTeamId: number | null;
  isManager: boolean;
  currentUserId: number | null;
}

function normalizeInsightCategory(
  value: PersonInsightCategoryValue,
): string[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    const items = value
      .filter((v): v is string => {
        return typeof v === 'string';
      })
      .map((v) => {
        return v.trim();
      })
      .filter((v) => {
        return v.length > 0;
      });

    return items.length > 0 ? items : null;
  }

  if (typeof value === 'object') {
    const itemsField = (value as Record<string, unknown>).items;

    if (Array.isArray(itemsField)) {
      const items = itemsField
        .filter((v): v is string => {
          return typeof v === 'string';
        })
        .map((v) => {
          return v.trim();
        })
        .filter((v) => {
          return v.length > 0;
        });

      if (items.length > 0) return items;
    }

    const items = Object.entries(value)
      .filter(([key]) => {
        return key !== 'evidence';
      })
      .map(([key, itemValue]) => {
        if (
          typeof itemValue === 'string' ||
          typeof itemValue === 'number' ||
          typeof itemValue === 'boolean'
        ) {
          return `${key}: ${itemValue}`;
        }

        return null;
      })
      .filter((item): item is string => {
        return item !== null;
      });

    return items.length > 0 ? items : null;
  }

  return null;
}

function StatsSection({
  metrics,
}: {
  metrics: NonNullable<PersonMember['metrics']>;
}) {
  const cycle = metrics.avg_cycle_time_days ?? null;
  const ai = metrics.ai_calls_week ?? 0;
  const chat = metrics.chat_messages_week ?? 0;

  if (cycle === null && ai === 0 && chat === 0) return null;

  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground'>
      <span className='font-semibold uppercase text-[10px] text-violet-400'>
        Stats
      </span>
      <span className='flex items-center gap-1' title='Average cycle time'>
        <Timer className='size-3' />
        Cycle:{' '}
        <span className='text-foreground font-medium'>
          {cycle === null ? '-' : `${cycle.toFixed(1)}d`}
        </span>
      </span>
      <span className='flex items-center gap-1' title='AI tool calls this week'>
        <Activity className='size-3' />
        AI: <span className='text-foreground font-medium'>{ai}</span>/wk
      </span>
      <span className='flex items-center gap-1' title='Chat messages this week'>
        <MessageSquareText className='size-3' />
        Chat: <span className='text-foreground font-medium'>{chat}</span>/wk
      </span>
    </div>
  );
}

function InsightSection({
  insight,
}: {
  insight: NonNullable<PersonMember['insight']>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (insight.status === 'unavailable') return null;

  if (insight.status === 'collecting' || !insight.data) {
    return (
      <div className='mt-2 text-xs text-muted-foreground italic flex items-center gap-1.5'>
        <Sparkles className='size-3' />
        Insights are being collected...
      </div>
    );
  }

  const strengths = normalizeInsightCategory(insight.data.strengths);
  const development = normalizeInsightCategory(insight.data.development_areas);
  const patterns = normalizeInsightCategory(insight.data.work_patterns);

  if (!strengths && !development && !patterns) return null;

  return (
    <div className='mt-2 text-xs'>
      <button
        type='button'
        onClick={() => {
          return setExpanded((value) => {
            return !value;
          });
        }}
        className='cursor-pointer flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors'
      >
        <Sparkles className='size-3' />
        {expanded ? 'Hide insights' : 'Show AI insights'}
      </button>

      {expanded && (
        <div className='mt-2 space-y-2 border-l-2 border-violet-500/30 pl-3'>
          {strengths && (
            <InsightList label='Strengths' items={strengths} tone='emerald' />
          )}
          {development && (
            <InsightList
              label='Development areas'
              items={development}
              tone='amber'
            />
          )}
          {patterns && (
            <InsightList label='Work patterns' items={patterns} tone='sky' />
          )}
        </div>
      )}
    </div>
  );
}

function InsightList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'emerald' | 'amber' | 'sky';
}) {
  const toneClass = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    sky: 'text-sky-400',
  };

  return (
    <div>
      <p
        className={`font-semibold ${toneClass[tone]} text-[11px] uppercase mb-0.5`}
      >
        {label}
      </p>
      <ul className='space-y-0.5 text-muted-foreground'>
        {items.map((item) => {
          return <li key={item}>{item}</li>;
        })}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  analytics,
  defaultTeamId,
  isManager,
  currentUserId,
}: MemberRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { open, close } = useModal();
  const metrics = analytics?.metrics ?? null;
  const canRemove =
    isManager && defaultTeamId !== null && member.id !== currentUserId;

  const handleRemove = () => {
    if (defaultTeamId === null) return;

    open?.(
      <div className='flex flex-col gap-4 p-4'>
        <p className='text-sm text-foreground'>
          Remove <span className='font-semibold'>{member.name}</span> from the
          organization?
        </p>
        <div className='flex justify-end gap-2'>
          <Button
            size={BUTTON_SIZE.sm}
            variant={BUTTON_VARIANT.ghost}
            fullWidth={false}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            size={BUTTON_SIZE.sm}
            variant={BUTTON_VARIANT.danger}
            fullWidth={false}
            onClick={() => {
              close?.();
              startTransition(async () => {
                const result = await kickTeamMember(defaultTeamId, member.id);

                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`${member.name} removed from organization`);
                  router.refresh();
                }
              });
            }}
          >
            Remove
          </Button>
        </div>
      </div>,
    );
  };

  return (
    <div className='flex items-start gap-3 p-4 rounded-[var(--radius-card)] border border-border bg-card'>
      <Avatar
        size='sm'
        className={`text-xs font-bold text-white ${avatarColor(member.name)}`}
      >
        {initials(member.name)}
      </Avatar>

      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-foreground truncate'>
          {member.name}
        </p>
        <p className='text-xs text-muted-foreground truncate'>{member.email}</p>

        {member.teamNames.length > 0 && (
          <p className='text-xs text-muted-foreground truncate mt-1'>
            {member.teamNames.join(', ')}
          </p>
        )}

        {analytics && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs'>
            <span className='text-muted-foreground'>
              <span className='text-foreground font-medium'>
                {analytics.done_tasks}
              </span>{' '}
              done
            </span>
            <span className='text-muted-foreground'>
              <span className='text-foreground font-medium'>
                {analytics.open_tasks}
              </span>{' '}
              open
            </span>
            {analytics.overdue_tasks > 0 && (
              <span className='text-red-400 font-medium'>
                {analytics.overdue_tasks} overdue
              </span>
            )}
          </div>
        )}

        {metrics && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground'>
            <span title='Closed tasks in the last 7 days'>
              Velocity:{' '}
              <span className='text-foreground font-medium'>
                {metrics.velocity_week}
              </span>
              /wk
            </span>
            <span title='Average time from creation to close'>
              Lead time:{' '}
              <span className='text-foreground font-medium'>
                {metrics.avg_lead_time_days === null
                  ? '-'
                  : `${metrics.avg_lead_time_days.toFixed(1)}d`}
              </span>
            </span>
          </div>
        )}

        {metrics && <StatsSection metrics={metrics} />}
        {analytics?.insight && <InsightSection insight={analytics.insight} />}
      </div>

      {canRemove && (
        <ButtonIcon
          aria-label={`Remove ${member.name}`}
          icon={<UserMinus className='size-4' />}
          variant='danger'
          size='sm'
          disabled={isPending}
          onClickAction={handleRemove}
          className='flex-shrink-0'
        />
      )}
    </div>
  );
}

const INVITE_STATUS_BADGE: Record<
  TeamInvite['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-400' },
  accepted: {
    label: 'Accepted',
    className: 'bg-emerald-500/10 text-emerald-400',
  },
  expired: { label: 'Expired', className: 'bg-red-500/10 text-red-400' },
};

function PendingInviteRow({
  invite,
  defaultTeamId,
}: {
  invite: TeamInvite;
  defaultTeamId: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const expiresDate =
    invite.expires_at === null ? null : new Date(invite.expires_at);
  const isPastExpiry = expiresDate !== null && expiresDate < new Date();
  const badge = isPastExpiry
    ? INVITE_STATUS_BADGE.expired
    : INVITE_STATUS_BADGE[invite.status];
  const expiresLabel = expiresDate
    ? expiresDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelTeamInvite(defaultTeamId, invite.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Invitation cancelled');
        router.refresh();
      }
    });
  };

  return (
    <div className='flex items-center gap-3 p-3 rounded-[var(--radius-card)] border border-border bg-card/50'>
      <div className='flex-1 min-w-0'>
        <p className='text-sm text-foreground truncate'>{invite.email}</p>
        {expiresLabel && (
          <p
            className={`text-xs mt-0.5 ${isPastExpiry ? 'text-red-400' : 'text-muted-foreground'}`}
          >
            {isPastExpiry
              ? `Expired ${expiresLabel}`
              : `Expires ${expiresLabel}`}
          </p>
        )}
      </div>

      <span
        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}
      >
        {badge.label}
      </span>

      <ButtonIcon
        aria-label={`Cancel invite for ${invite.email}`}
        icon={<X className='size-4' />}
        variant='danger'
        size='sm'
        disabled={isPending}
        onClickAction={handleCancel}
        className='flex-shrink-0'
      />
    </div>
  );
}

/**
 * OrganizationPeopleTab — people management for the active organization.
 * @param props - Component props.
 */
export function OrganizationPeopleTab({
  analyticsData,
  members,
  pendingInvites,
  defaultTeamId,
  isManager,
  currentUserId,
}: OrganizationPeopleTabProps) {
  const { open, close } = useModal();
  const analyticsMap = new Map<number, PersonMember>(
    (analyticsData?.members ?? []).map((member) => {
      return [member.id, member];
    }),
  );
  const canInvite = isManager && defaultTeamId !== null;

  const handleInvite = () => {
    if (defaultTeamId === null) return;

    open?.(<TeamMemberAddModal close={close} teamId={defaultTeamId} />);
  };

  return (
    <div className='flex flex-col gap-8'>
      <div className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-foreground'>Members</h3>
          {canInvite && (
            <Button
              size={BUTTON_SIZE.xs}
              variant={BUTTON_VARIANT.ghost}
              fullWidth={false}
              leftIcon={<UserPlus className='size-4' />}
              onClick={handleInvite}
              className='text-violet-500 hover:text-violet-400'
            >
              Invite
            </Button>
          )}
        </div>

        {members.length === 0 ? (
          <p className='text-sm text-muted-foreground text-center py-6'>
            No members yet.
          </p>
        ) : (
          <div className='grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'>
            {members.map((member) => {
              return (
                <MemberRow
                  key={member.id}
                  member={member}
                  analytics={analyticsMap.get(member.id) ?? null}
                  defaultTeamId={defaultTeamId}
                  isManager={isManager}
                  currentUserId={currentUserId}
                />
              );
            })}
          </div>
        )}
      </div>

      {isManager && defaultTeamId !== null && (
        <div className='flex flex-col gap-3'>
          <h3 className='text-sm font-semibold text-foreground'>
            Pending Invites
          </h3>
          {pendingInvites.length === 0 ? (
            <p className='text-sm text-muted-foreground rounded-[var(--radius-card)] border border-border bg-card/50 p-4'>
              No pending invites.
            </p>
          ) : (
            <div className='flex flex-col gap-2'>
              {pendingInvites.map((invite) => {
                return (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    defaultTeamId={defaultTeamId}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
