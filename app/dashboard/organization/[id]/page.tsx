import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

import type { PageProps } from '@/shared/types/common';

/**
 * Legacy organization detail route — open People as the primary Organization tab.
 * @param props - Component props.
 * @param props.params
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params;

  redirect(ROUTES.DASHBOARD.ORGANIZATION_PEOPLE(id));
}
