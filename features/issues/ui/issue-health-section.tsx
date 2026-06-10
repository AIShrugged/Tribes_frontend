import { getIssueHealth } from '@/features/issues/api/issue-health';
import { IssueHealthBanner } from '@/features/issues/ui/issue-health-banner';

import type { TeamProps } from '@/entities/team';
import type { IssueHealthReport } from '@/features/issues/model/types';

function hasHealthProblems(report: IssueHealthReport): boolean {
  const { counts } = report.findings;
  return (
    counts.overdue > 0 || counts.sprint_risk > 0 || counts.priority_ignored > 0
  );
}

function formatUpdatedLabel(periodStart: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  if (periodStart === today) return 'Обновлено: сегодня';
  if (periodStart === yesterday) return 'Обновлено: вчера';
  return `Обновлено: ${periodStart}`;
}

export async function IssueHealthSection({ teams }: { teams: TeamProps[] }) {
  if (teams.length === 0) return null;

  const results = await Promise.allSettled(
    teams.map((team) => {
      return getIssueHealth(team.id);
    }),
  );

  const banners: Array<{
    team: TeamProps;
    report: IssueHealthReport;
    updatedLabel: string;
  }> = [];

  for (const [i, team] of teams.entries()) {
    const result = results[i];
    if (result.status !== 'fulfilled' || result.value === null) continue;

    const report = result.value;
    if (hasHealthProblems(report)) {
      banners.push({
        team: team,
        report,
        updatedLabel: formatUpdatedLabel(report.period_start),
      });
    }
  }

  if (banners.length === 0) return null;

  return (
    <div className='flex flex-col gap-2 px-2 pt-2'>
      {banners.map(({ team, report, updatedLabel }) => {
        return (
          <IssueHealthBanner
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
