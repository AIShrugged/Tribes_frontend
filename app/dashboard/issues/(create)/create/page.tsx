import {
  getEpics,
  getPersons,
  getTasksForEpicForm,
  IssueForm,
} from '@/features/issues';
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
  const organizationId = await getOrganizationId();

  const [persons, epics, userResponse] = await Promise.all([
    getPersons(organizationId),
    getEpics(organizationId).catch(() => {
      return [];
    }),
    getUser(),
  ]);

  const tasks = await getTasksForEpicForm(organizationId).catch(() => {
    return [];
  });

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title='Create task' href={backHref} />
      <div className='h-full overflow-y-auto'>
        <CardBody>
          <IssueForm
            persons={persons}
            epics={epics}
            tasks={tasks}
            defaultOrganizationId={String(organizationId)}
            currentUser={userResponse.data ?? null}
            backHref={backHref}
          />
        </CardBody>
      </div>
    </Card>
  );
}
