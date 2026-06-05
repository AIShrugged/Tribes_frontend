import { notFound } from 'next/navigation';

import { GoalsContent } from '@/features/issues';

import type { PageProps } from '@/shared/types/common';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Goals' };

/**
 * Organization Goals tab — open epics and unlinked tasks scoped to this
 * organization.
 * @param props - Component props.
 * @param props.params - Route params holding the organization id.
 */
export default async function OrganizationGoalsPage({ params }: PageProps) {
  const { id } = await params;
  const orgId = Number(id);

  // Guard against a non-numeric id: Number('abc') / Number('0') are falsy, which
  // buildIssuesQuery drops, making getEpics return epics from ALL of the user's
  // orgs instead of this one. Fail with 404 instead of leaking cross-org goals.
  if (!Number.isInteger(orgId) || orgId <= 0) {
    notFound();
  }

  return (
    <div className='space-y-6'>
      <GoalsContent orgId={orgId} />
    </div>
  );
}
