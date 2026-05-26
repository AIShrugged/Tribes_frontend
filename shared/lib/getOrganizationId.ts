import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ROUTES } from '@/shared/lib/routes';

/**
 * Gets organization_id from cookies as a validated positive integer.
 * Redirects to login page if absent or invalid.
 * Wrapped with React.cache() so multiple calls in the same render tree
 * share a single cookie read.
 */
export const getOrganizationId = cache(async (): Promise<number> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('organization_id')?.value;
  const parsed = raw === undefined ? Number.NaN : Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  return parsed;
});
