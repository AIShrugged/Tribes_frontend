import {
  BrainAccessDenied,
  SuggestionsList,
  getBrainAccessContext,
  getBrainSuggestions,
} from '@/features/brain';
import { ServerError } from '@/shared/lib/errors';

export const metadata = { title: 'Предложения' };

/**
 * Suggestions inbox tab — pending second-brain proposals for manager review.
 */
export default async function TempSuggestionsPage() {
  const { canManageBrain, managerOrganizations } =
    await getBrainAccessContext();

  if (!canManageBrain) {
    return <BrainAccessDenied />;
  }

  let accessDenied = false;
  let items: Awaited<ReturnType<typeof getBrainSuggestions>>['data'] = [];
  let total = 0;

  await getBrainSuggestions({ status: 'pending' })
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
    <SuggestionsList
      initialItems={items}
      initialTotalCount={total}
      organizations={managerOrganizations}
    />
  );
}
