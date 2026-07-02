import { differenceInDays } from 'date-fns';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { IssueCodeBadge } from '@/entities/issue';
import {
  getIssue,
  getIssueByCode,
  getIssueAttachments,
  getPersons,
  getEpics,
  getTasksForEpicForm,
  IssueAttachments,
  IssueComments,
  getIssueComments,
  IssueForm,
  IssueLinkedTask,
  EpicChildIssues,
  IssueNoGoalHint,
  IssueAuditLogSection,
} from '@/features/issues';
import { getUser } from '@/features/user';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';
import { validateBackHref } from '@/shared/lib/validate-back-href';
import { Card, CardBody } from '@/shared/ui/card';
import PageHeader from '@/widgets/layout/ui/page-header';

interface IssueDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function IssueDetailPage({
  params,
  searchParams,
}: IssueDetailPageProps) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);

  // A purely numeric segment is a raw id; anything else is a code (e.g.
  // "DEV-14"). Resolve the code to its issue, then canonicalize to the numeric
  // detail URL — every child component below keys off the numeric id, so this
  // keeps a single render path for both entry points.
  if (!/^\d+$/.test(id)) {
    const issueByCode = await getIssueByCode(id);
    const suffix = from ? `?from=${encodeURIComponent(from)}` : '';

    redirect(`${ROUTES.DASHBOARD.ISSUES_DETAIL(issueByCode.id)}${suffix}`);
  }

  const issueId = Number(id);

  if (issueId <= 0) notFound();

  const backHref = validateBackHref(from) ?? ROUTES.DASHBOARD.ISSUES_KANBAN;
  const organizationId = await getOrganizationId();

  const [issue, attachments, persons, epics, comments, userResponse] =
    await Promise.all([
      getIssue(issueId).catch((error: Error) => {
        if (
          error.message.includes('404') ||
          error.message.toLowerCase().includes('not found') ||
          error.message.toLowerCase().includes('no query results')
        ) {
          notFound();
        }
        throw error;
      }),
      getIssueAttachments(issueId).catch(() => {
        return [];
      }),
      getPersons(organizationId),
      getEpics(organizationId).catch(() => {
        return [];
      }),
      getIssueComments(issueId).catch(() => {
        return [];
      }),
      getUser(),
    ]);

  const tasks = await getTasksForEpicForm(organizationId).catch(() => {
    return [];
  });

  const currentUserId = userResponse.data?.id ?? 0;
  const isArchived =
    issue.status === 'done' &&
    issue.close_date !== null &&
    differenceInDays(new Date(), new Date(issue.close_date)) >= 14;

  return (
    <div className='h-full overflow-y-auto'>
      <div className='grid min-h-full gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'>
        <div className='flex flex-col gap-6'>
          <Card className='flex flex-col'>
            <PageHeader
              hasButtonBack
              href={backHref}
              title='Task'
              extraContent={
                <span className='flex items-center gap-2'>
                  <IssueCodeBadge code={issue.code} id={issue.id} />
                  {isArchived ? (
                    <span className='inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60'>
                      Archived
                    </span>
                  ) : null}
                </span>
              }
            />
            <div className='overflow-y-auto'>
              <CardBody>
                {issue.type !== 'epic' && issue.epic_id === null && (
                  <IssueNoGoalHint issueId={issue.id} epics={epics} />
                )}
                <IssueForm
                  key={issue.id}
                  issue={issue}
                  persons={persons}
                  epics={epics}
                  tasks={tasks}
                  defaultOrganizationId={String(organizationId)}
                  currentUser={userResponse.data ?? null}
                />
              </CardBody>
            </div>
          </Card>

          <IssueLinkedTask issue={issue} />

          {issue.type === 'epic' && (
            <EpicChildIssues issues={issue.child_issues ?? []} />
          )}

          <Card className='flex flex-col'>
            <PageHeader title='Comments' />
            <CardBody>
              <IssueComments
                issueId={issueId}
                initialComments={comments}
                currentUserId={currentUserId}
              />
            </CardBody>
          </Card>

          <Card className='flex flex-col'>
            <CardBody>
              <Suspense
                fallback={
                  <div className='h-8 animate-pulse rounded bg-muted' />
                }
              >
                <IssueAuditLogSection issueId={issueId} />
              </Suspense>
            </CardBody>
          </Card>
        </div>

        <div className='flex h-full flex-col gap-6'>
          <Card className='h-full flex flex-col'>
            <PageHeader title='Attachments' />
            <div className='h-full overflow-y-auto'>
              <CardBody>
                <IssueAttachments
                  issueId={issueId}
                  initialAttachments={attachments}
                />
              </CardBody>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
