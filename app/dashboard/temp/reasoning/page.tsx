import {
  BrainAccessDenied,
  ReasoningLog,
  getBrainAccessContext,
  getBrainEvents,
} from '@/features/brain';
import { ServerError } from '@/shared/lib/errors';

export const metadata = { title: 'Журнал размышлений' };

/**
 * Reasoning log tab — read-only feed of the second brain's thoughts and tool
 * calls for the ACTIVE organization, grouped by run.
 */
export default async function TempReasoningPage() {
  const { canManageBrain, activeOrganization } = await getBrainAccessContext();

  if (!canManageBrain || !activeOrganization) {
    return <BrainAccessDenied />;
  }

  let accessDenied = false;
  let items: Awaited<ReturnType<typeof getBrainEvents>>['data'] = [];
  let total = 0;

  await getBrainEvents({ organizationId: activeOrganization.id })
    .then((result) => {
      items = result.data;
      total = result.totalCount;
    })
    .catch((error) => {
      if (error instanceof ServerError && error.status === 403) {
        accessDenied = true;
      } else {
        throw error;
      }
    });

  if (accessDenied) {
    return <BrainAccessDenied />;
  }

  return (
    <ReasoningLog
      initialItems={items}
      initialTotalCount={total}
      organizationId={activeOrganization.id}
    />
  );
}
