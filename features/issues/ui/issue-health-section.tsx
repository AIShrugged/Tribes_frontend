import { getIssueHealth } from '@/features/issues/api/issue-health';
import { IssueHealthAttentionCard } from '@/features/issues/ui/issue-health-attention-card';

import type { TeamProps } from '@/entities/team';
import type { IssueHealthReport } from '@/features/issues/model/types';
import type { ReactNode } from 'react';

function hasHealthProblems(report: IssueHealthReport): boolean {
  const { counts } = report.findings;
  return (
    counts.overdue > 0 || counts.sprint_risk > 0 || counts.priority_ignored > 0
  );
}

function formatUpdatedLabel(generatedAt: string): string {
  const dt = new Date(generatedAt);
  const today = new Date();
  const time = dt.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (dt.toDateString() === today.toDateString()) {
    return `Анализ обновлён сегодня в ${time}`;
  }

  const yesterday = new Date(Date.now() - 86_400_000);
  if (dt.toDateString() === yesterday.toDateString()) {
    return `Анализ обновлён вчера в ${time}`;
  }

  const dateLabel = dt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `Анализ обновлён ${dateLabel} в ${time}`;
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

export async function IssueHealthSection({
  teams,
  emptyState,
}: {
  teams: TeamProps[];
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

  return (
    <div className='flex flex-col gap-3'>
      {banners.map(({ team, report, updatedLabel }) => {
        return (
          <IssueHealthAttentionCard
            key={team.id}
            teamName={team.name}
            report={report}
            updatedLabel={updatedLabel}
          />
        );
      })}
    </div>
  );
}
