import {
  BrainAccessDenied,
  SuggestionsList,
  getBrainAccessContext,
  getBrainSuggestions,
} from '@/features/brain';
import { ServerError } from '@/shared/lib/errors';

export const metadata = { title: 'Предложения' };

/**
 * Suggestions inbox tab — pending second-brain proposals for the ACTIVE
 * organization, for manager review.
 */
export default async function TempSuggestionsPage() {
  const { canManageBrain, activeOrganization } = await getBrainAccessContext();

  if (!canManageBrain || !activeOrganization) {
    return <BrainAccessDenied />;
  }

  let accessDenied = false;
  let items: Awaited<ReturnType<typeof getBrainSuggestions>>['data'] = [];
  let total = 0;

  await getBrainSuggestions({
    status: 'pending',
    organizationId: activeOrganization.id,
  })
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
      organizationId={activeOrganization.id}
    />
  );
}
