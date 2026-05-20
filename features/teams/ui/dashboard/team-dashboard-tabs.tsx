'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { TemplatesTab } from '../templates/templates-tab';

import TeamDashboardTabDecisions from './team-dashboard-tab-decisions';
import TeamDashboardTabHealth from './team-dashboard-tab-health';
import TeamDashboardTabPeople from './team-dashboard-tab-people';
import TeamDashboardTabReadiness from './team-dashboard-tab-readiness';
import TeamDashboardTabRisks from './team-dashboard-tab-risks';
import TeamDashboardTabStatus from './team-dashboard-tab-status';

import type {
  TabHealth,
  TabMeetingReadiness,
  TabPeople,
  TabRisks,
  TabStatus,
} from '../../model/dashboard-types';
import type { TeamInvite, TeamProps } from '@/entities/team';
import type { TelegramChatRegistration } from '@/entities/telegram';
import type { TeamNotificationSetting } from '@/features/teams/model/types';

const TABS = [
  { key: 'status', label: 'Status' },
  { key: 'readiness', label: 'Readiness' },
  { key: 'people', label: 'People' },
  { key: 'health', label: 'Health' },
  { key: 'risks', label: 'Risks' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'templates', label: 'Templates' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface DashboardTabs {
  status: TabStatus;
  meeting_readiness: TabMeetingReadiness;
  people: TabPeople;
  health: TabHealth;
  risks: TabRisks;
}

interface TeamDashboardTabsProps {
  currentTab: string;
  tabs: DashboardTabs | null;
  teamId: number;
  members: TeamProps['members'];
  pendingInvites: TeamInvite[];
  isManager: boolean;
  settings: TeamNotificationSetting[];
  availableChats: TelegramChatRegistration[];
}

/**
 * TeamDashboardTabs — URL-driven tab strip with tab content.
 * @param props - Component props.
 * @param props.currentTab
 * @param props.tabs
 * @param props.teamId
 * @param props.members
 * @param props.pendingInvites
 * @param props.isManager
 * @param props.settings
 * @param props.availableChats
 */
export default function TeamDashboardTabs({
  currentTab,
  tabs,
  teamId,
  members,
  pendingInvites,
  isManager,
  settings,
  availableChats,
}: TeamDashboardTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Redirect legacy ?tab=settings to ?tab=people
  const resolvedTab = currentTab === 'settings' ? 'people' : currentTab;

  const activeTab: TabKey = TABS.some((t) => {
    return t.key === resolvedTab;
  })
    ? (resolvedTab as TabKey)
    : 'status';

  const handleTabChange = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className='flex flex-col flex-1 overflow-hidden'>
      {/* Tab strip */}
      <div className='flex gap-1 border-b border-border px-6 flex-shrink-0'>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type='button'
              onClick={() => {
                return handleTabChange(tab.key);
              }}
              className={[
                'cursor-pointer px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        {activeTab === 'people' && (
          <TeamDashboardTabPeople
            analyticsData={tabs?.people ?? null}
            members={members}
            pendingInvites={pendingInvites}
            teamId={teamId}
            isManager={isManager}
            settings={settings}
            availableChats={availableChats}
          />
        )}
        {activeTab !== 'people' && activeTab !== 'decisions' && tabs && (
          <>
            {activeTab === 'status' && (
              <TeamDashboardTabStatus data={tabs.status} />
            )}
            {activeTab === 'readiness' && (
              <TeamDashboardTabReadiness data={tabs.meeting_readiness} />
            )}
            {activeTab === 'health' && (
              <TeamDashboardTabHealth data={tabs.health} />
            )}
            {activeTab === 'risks' && (
              <TeamDashboardTabRisks data={tabs.risks} />
            )}
          </>
        )}
        {activeTab !== 'people' && activeTab !== 'decisions' && !tabs && (
          <p className='text-sm text-muted-foreground text-center py-10'>
            No dashboard data available.
          </p>
        )}
        {activeTab === 'decisions' && (
          <TeamDashboardTabDecisions teamId={teamId} />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab teamId={teamId} isReadOnly={!isManager} />
        )}
      </div>
    </div>
  );
}
