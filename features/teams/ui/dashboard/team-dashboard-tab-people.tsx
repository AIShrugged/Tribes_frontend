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

import { cancelTeamInvite, kickTeamMember } from '@/features/teams/api/team';
import { avatarColor, initials } from '@/features/teams/model/avatar-utils';
import TeamMemberAddModal from '@/features/teams/ui/team-member-add-modal';
import TeamNotificationSettings from '@/features/teams/ui/team-notification-settings';
import { useModal } from '@/shared/hooks/use-modal';
import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button, ButtonIcon } from '@/shared/ui/button';
import Avatar from '@/shared/ui/common/avatar';

import type { TeamInvite, TeamMember, TeamProps } from '@/entities/team';
import type { TelegramChatRegistration } from '@/entities/telegram';
import type {
  PersonInsightCategoryValue,
  PersonMember,
  TabPeople,
} from '@/features/teams/model/dashboard-types';
import type { TeamNotificationSetting } from '@/features/teams/model/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Backend `InsightProfile.content` is free-form JSON whose shape depends on category:
 *
 *  - `strengths` / `development_areas` → `{ items: string[], evidence?: string[] }`
 *    The `items` array is the user-facing list of strengths / weaknesses;
 *    `evidence` holds optional transcript citations we don't surface in the card.
 *
 *  - `work_patterns` → flat key/value object like
 *    `{ meeting_role: "...", decision_style: "...", deadline_reliability: "..." }`
 *
 *  - Legacy / other: may be a plain `string[]`.
 *
 * Order of detection here matches frequency in production data; null when nothing
 * is renderable.
 */
function normalizeInsightCategory(
  value: PersonInsightCategoryValue,
): string[] | null {
  if (!value) {
    return null;
  }

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
    // Primary shape for strengths / development_areas
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

    // Fallback for work_patterns and similar flat key/value objects
    const items = Object.entries(value)
      .filter(([k]) => {
        return k !== 'evidence';
      }) // never surface raw evidence in the card
      .map(([k, v]) => {
        if (typeof v === 'string') return `${k}: ${v}`;
        if (typeof v === 'number' || typeof v === 'boolean')
          return `${k}: ${v}`;
        return null;
      })
      .filter((s): s is string => {
        return s !== null;
      });
    return items.length > 0 ? items : null;
  }

  return null;
}

// ─── Stats mini-section (US-12.7 cycle time / AI usage / chat activity) ──────

/**
 * Compact "Stats" row showing the three US-12.7 metrics:
 *   - Cycle time (days from first in_progress → done)
 *   - AI usage (agent_activity_logs in last 7 days)
 *   - Chat activity (role='user' messages in org-bound TG chats, last 7 days)
 *
 * Only rendered when at least one of the three has signal — keeps the card
 * uncluttered for members with zero activity.
 */
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
      <span className='font-semibold uppercase tracking-wide text-[10px] text-violet-400'>
        Stats
      </span>
      <span
        className='flex items-center gap-1'
        title='Average cycle time: first in_progress → done'
      >
        <Timer className='size-3' />
        Cycle:{' '}
        <span className='text-foreground font-medium'>
          {cycle === null ? '—' : `${cycle.toFixed(1)}d`}
        </span>
      </span>
      <span
        className='flex items-center gap-1'
        title='AI tool calls in the last 7 days (all events incl. system pipeline)'
      >
        <Activity className='size-3' />
        AI: <span className='text-foreground font-medium'>{ai}</span>
        /wk
      </span>
      <span
        className='flex items-center gap-1'
        title='Messages in org-bound TG chats in the last 7 days'
      >
        <MessageSquareText className='size-3' />
        Chat: <span className='text-foreground font-medium'>{chat}</span>
        /wk
      </span>
    </div>
  );
}

// ─── Insight section (collapsible) ────────────────────────────────────────────

function InsightSection({
  insight,
}: {
  insight: NonNullable<PersonMember['insight']>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (insight.status === 'unavailable') {
    return null;
  }

  if (insight.status === 'collecting' || !insight.data) {
    return (
      <div className='mt-2 text-xs text-muted-foreground italic flex items-center gap-1.5'>
        <Sparkles className='size-3' />
        Insights are being collected…
      </div>
    );
  }

  const strengths = normalizeInsightCategory(insight.data.strengths);
  const dev = normalizeInsightCategory(insight.data.development_areas);
  const patterns = normalizeInsightCategory(insight.data.work_patterns);

  if (!strengths && !dev && !patterns) {
    return null;
  }

  return (
    <div className='mt-2 text-xs'>
      <button
        type='button'
        onClick={() => {
          return setExpanded((v) => {
            return !v;
          });
        }}
        className='flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors'
      >
        <Sparkles className='size-3' />
        {expanded ? 'Hide insights' : 'Show AI insights'}
      </button>

      {expanded && (
        <div className='mt-2 space-y-2 border-l-2 border-violet-500/30 pl-3'>
          {strengths && (
            <div>
              <p className='font-semibold text-emerald-400 text-[11px] uppercase tracking-wide mb-0.5'>
                Strengths
              </p>
              <ul className='space-y-0.5 text-muted-foreground'>
                {strengths.map((s) => {
                  return <li key={s}>• {s}</li>;
                })}
              </ul>
            </div>
          )}
          {dev && (
            <div>
              <p className='font-semibold text-amber-400 text-[11px] uppercase tracking-wide mb-0.5'>
                Development areas
              </p>
              <ul className='space-y-0.5 text-muted-foreground'>
                {dev.map((s) => {
                  return <li key={s}>• {s}</li>;
                })}
              </ul>
            </div>
          )}
          {patterns && (
            <div>
              <p className='font-semibold text-sky-400 text-[11px] uppercase tracking-wide mb-0.5'>
                Work patterns
              </p>
              <ul className='space-y-0.5 text-muted-foreground'>
                {patterns.map((s) => {
                  return <li key={s}>• {s}</li>;
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: TeamMember;
  analytics: PersonMember | null;
  teamId: number;
  isManager: boolean;
}

function MemberRow({ member, analytics, teamId, isManager }: MemberRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { open, close } = useModal();

  const handleRemove = () => {
    open?.(
      <div className='flex flex-col gap-4 p-4'>
        <p className='text-sm text-foreground'>
          Remove <span className='font-semibold'>{member.name}</span> from the
          team?
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
                const result = await kickTeamMember(teamId, member.id);

                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`${member.name} removed from team`);
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

  // Extended metrics from PerformanceMetricsService (always shown when present,
  // even when values are 0/null — the section anchors "Темп/Активность" per US-12.6).
  const m = analytics?.metrics ?? null;

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
            {analytics.latest_meeting && (
              <span className='text-muted-foreground truncate max-w-[120px]'>
                {analytics.latest_meeting.title}
              </span>
            )}
          </div>
        )}

        {m && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground'>
            <span title='Closed tasks in the last 7 days'>
              Velocity:{' '}
              <span className='text-foreground font-medium'>
                {m.velocity_week}
              </span>
              /wk
            </span>
            <span title='Average time from creation to close'>
              Lead time:{' '}
              <span className='text-foreground font-medium'>
                {m.avg_lead_time_days === null
                  ? '—'
                  : `${m.avg_lead_time_days.toFixed(1)}d`}
              </span>
            </span>
            <span title='Tasks currently in progress'>
              In progress:{' '}
              <span className='text-foreground font-medium'>
                {m.in_progress}
              </span>
            </span>
          </div>
        )}

        {m && <StatsSection metrics={m} />}

        {analytics?.insight && <InsightSection insight={analytics.insight} />}
      </div>

      {isManager && (
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

// ─── Pending invite row ───────────────────────────────────────────────────────

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

interface PendingInviteRowProps {
  invite: TeamInvite;
  teamId: number;
}

function PendingInviteRow({ invite, teamId }: PendingInviteRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Parse once, use for both expiry check and display label.
  // new Date(null) = Unix epoch (1970) — the null guard prevents that false positive.
  const expiresDate =
    invite.expires_at === null ? null : new Date(invite.expires_at);
  const isPastExpiry = expiresDate !== null && expiresDate < new Date();

  const badge = isPastExpiry
    ? INVITE_STATUS_BADGE['expired']
    : INVITE_STATUS_BADGE[invite.status];

  const expiresLabel = expiresDate
    ? expiresDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelTeamInvite(teamId, invite.id);

      if (result.error) {
        toast.error(result.error);
        // No router.refresh() on error: server state is unchanged.
        // revalidatePath('/dashboard/teams') in the Server Action handles cache invalidation.
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

// ─── Main component ───────────────────────────────────────────────────────────

interface TeamDashboardTabPeopleProps {
  analyticsData: TabPeople | null;
  members: TeamMember[];
  pendingInvites: TeamInvite[];
  teamId: number;
  isManager: boolean;
  settings: TeamNotificationSetting[];
  availableChats: TelegramChatRegistration[];
}

/**
 * TeamDashboardTabPeople — unified People tab.
 * Shows member list with analytics, pending invites (manager-only), and
 * notification settings (manager-only).
 */
export default function TeamDashboardTabPeople({
  analyticsData,
  members,
  pendingInvites,
  teamId,
  isManager,
  settings,
  availableChats,
}: TeamDashboardTabPeopleProps) {
  const { open, close } = useModal();

  const analyticsMap = new Map<number, PersonMember>(
    (analyticsData?.members ?? []).map((m) => {
      return [m.id, m];
    }),
  );

  const handleInvite = () => {
    open?.(<TeamMemberAddModal close={close} teamId={teamId} />);
  };

  return (
    <div className='flex flex-col gap-8'>
      {/* Members section */}
      <div className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-foreground'>Members</h3>
          {isManager && (
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
            No members yet.{' '}
            {isManager && (
              <Button
                size={BUTTON_SIZE.xs}
                variant={BUTTON_VARIANT.ghost}
                fullWidth={false}
                onClick={handleInvite}
                className='inline text-violet-500 hover:text-violet-400'
              >
                Invite someone to get started.
              </Button>
            )}
          </p>
        ) : (
          <div className='grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
            {members.map((member) => {
              return (
                <MemberRow
                  key={member.id}
                  member={member}
                  analytics={analyticsMap.get(member.id) ?? null}
                  teamId={teamId}
                  isManager={isManager}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites section (manager-only, hidden when empty) */}
      {isManager && pendingInvites.length > 0 && (
        <div className='flex flex-col gap-3'>
          <h3 className='text-sm font-semibold text-foreground'>
            Pending Invites
          </h3>
          <div className='flex flex-col gap-2'>
            {pendingInvites.map((invite) => {
              return (
                <PendingInviteRow
                  key={invite.id}
                  invite={invite}
                  teamId={teamId}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Notification settings (manager-only) */}
      {isManager && (
        <TeamNotificationSettings
          teamId={teamId}
          settings={settings}
          availableChats={availableChats}
        />
      )}
    </div>
  );
}
