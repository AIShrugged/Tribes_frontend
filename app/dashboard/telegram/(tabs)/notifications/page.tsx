import { getTeams } from '@/entities/team/api/team';
import {
  TelegramNotificationsMatrix,
  getTelegramChats,
} from '@/features/telegram';
import { getTeamNotificationSettings } from '@/features/telegram/api/telegram-notifications';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export default async function TelegramNotificationsPage() {
  const organizationId = await getOrganizationId();

  const [teamsResult, chatsResult] = await Promise.all([
    getTeams(organizationId),
    getTelegramChats(organizationId),
  ]);

  // In the no-teams model all notification settings live on the org's default ("General") team.
  const defaultTeam = (teamsResult.data ?? []).find((team) => {
    return team.is_default;
  });

  if (!defaultTeam) {
    return (
      <p className='rounded-[var(--radius-card)] border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground'>
        Default team not found. Notifications are temporarily unavailable.
      </p>
    );
  }

  // Managing notifications is manager-only (TeamNotificationSettingPolicy). A non-manager who
  // reaches this tab gets a 403 — show a friendly message instead of crashing the error boundary.
  let settings;
  try {
    settings = await getTeamNotificationSettings(defaultTeam.id);
  } catch {
    return (
      <p className='rounded-[var(--radius-card)] border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground'>
        Managing notifications is available to organization managers only.
      </p>
    );
  }

  const availableChats = (chatsResult.data ?? []).filter((chat) => {
    return chat.team_id === defaultTeam.id && chat.bound_at !== null;
  });

  return (
    <TelegramNotificationsMatrix
      teamId={defaultTeam.id}
      settings={settings}
      availableChats={availableChats}
    />
  );
}
