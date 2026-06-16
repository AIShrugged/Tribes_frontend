import { getIssueHealth } from '@/features/issues/api/issue-health';
import { IssueHealthAttentionCard } from '@/features/issues/ui/issue-health-attention-card';

import type { TeamProps } from '@/entities/team';
import type {
  IssueHealthLiveCounts,
  IssueHealthReport,
} from '@/features/issues/model/types';
import type { ReactNode } from 'react';

function hasHealthProblems(report: IssueHealthReport): boolean {
  const { live_counts } = report;
  return (
    live_counts.overdue > 0 ||
    live_counts.due_today > 0 ||
    live_counts.due_this_week > 0 ||
    live_counts.critical_ignored > 0
  );
}

function formatUpdatedLabel(generatedAt: string): string {
  const dt = new Date(generatedAt);
  const today = new Date();
  const time = dt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (dt.toDateString() === today.toDateString()) {
    return `Analysis updated today at ${time}`;
  }

  const yesterday = new Date(Date.now() - 86_400_000);
  if (dt.toDateString() === yesterday.toDateString()) {
    return `Analysis updated yesterday at ${time}`;
  }

  const dateLabel = dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
  return `Analysis updated ${dateLabel} at ${time}`;
}

type HealthBanner = {
  team: TeamProps;
  report: IssueHealthReport;
  updatedLabel: string;
};

function buildBanners(
  teams: TeamProps[],
  results: PromiseSettledResult<IssueHealthReport | null>[],
): HealthBanner[] {
  const banners: HealthBanner[] = [];
  for (const [i, team] of teams.entries()) {
    const result = results[i];
    if (result.status !== 'fulfilled' || result.value === null) continue;
    const report = result.value;
    if (hasHealthProblems(report)) {
      banners.push({
        team,
        report,
        updatedLabel: formatUpdatedLabel(report.generated_at),
      });
    }
  }
  return banners;
}

// Sum live_counts across ALL teams (not just those with banners) to get org-wide totals.
function aggregateOrgCounts(
  results: PromiseSettledResult<IssueHealthReport | null>[],
): IssueHealthLiveCounts {
  const totals: IssueHealthLiveCounts = {
    overdue: 0,
    due_today: 0,
    due_this_week: 0,
    critical_ignored: 0,
  };
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const lc = result.value.live_counts;
    totals.overdue += lc.overdue;
    totals.due_today += lc.due_today;
    totals.due_this_week += lc.due_this_week;
    totals.critical_ignored += lc.critical_ignored;
  }
  return totals;
}

export async function IssueHealthSection({
  teams,
  statsOverdue,
  emptyState,
}: {
  teams: TeamProps[];
  statsOverdue?: number;
  emptyState?: ReactNode;
}) {
  if (teams.length === 0) return emptyState ?? null;

  const results = await Promise.allSettled(
    teams.map((team) => {
      return getIssueHealth(team.id);
    }),
  );

  const banners = buildBanners(teams, results);
  if (banners.length === 0) return emptyState ?? null;

  const base = aggregateOrgCounts(results);
  const orgCounts =
    statsOverdue === undefined ? base : { ...base, overdue: statsOverdue };

  return (
    <div className='flex flex-col gap-3'>
      {banners.map(({ team, report, updatedLabel }) => {
        return (
          <IssueHealthAttentionCard
            key={team.id}
            teamName={team.name}
            report={report}
            updatedLabel={updatedLabel}
            orgCounts={orgCounts}
          />
        );
      })}
    </div>
  );
}
