import { getIssueAuditLog } from '@/features/issues/api/audit-log';
import { IssueAuditLog } from '@/features/issues/ui/issue-audit-log';

interface Props {
  issueId: number;
}

export async function IssueAuditLogSection({ issueId }: Props) {
  const events = await getIssueAuditLog(issueId).catch(() => {
    return [];
  });
  return <IssueAuditLog events={events} />;
}