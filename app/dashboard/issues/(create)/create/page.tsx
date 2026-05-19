import {
  getEpics,
  getPersons,
  getTasksForEpicForm,
  IssueForm,
} from '@/features/issues';
import { getOrganizations } from '@/features/organization';
import { getUser } from '@/features/user';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';
import { validateBackHref } from '@/shared/lib/validate-back-href';
import { Card, CardBody } from '@/shared/ui/card';
import PageHeader from '@/widgets/layout/ui/page-header';

interface IssueCreatePageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function IssueCreatePage({
  searchParams,
}: IssueCreatePageProps) {
  const { from } = await searchParams;
  const backHref = validateBackHref(from) ?? ROUTES.DASHBOARD.ISSUES_KANBAN;

  const [organizationsResponse, persons, epics, organizationId, userResponse] =
    await Promise.all([
      getOrganizations(),
      getPersons(),
      getEpics().catch(() => {
        return [];
      }),
      getOrganizationId(),
      getUser(),
    ]);

  const tasks = await getTasksForEpicForm(
    organizationId ? Number(organizationId) : null,
  ).catch(() => {
    return [];
  });

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title='Create task' href={backHref} />
      <div className='h-full overflow-y-auto'>
        <CardBody>
          <IssueForm
            organizations={organizationsResponse.data ?? []}
            persons={persons}
            epics={epics}
            tasks={tasks}
            defaultOrganizationId={organizationId}
            currentUser={userResponse.data ?? null}
            backHref={backHref}
          />
        </CardBody>
      </div>
    </Card>
  );
}
