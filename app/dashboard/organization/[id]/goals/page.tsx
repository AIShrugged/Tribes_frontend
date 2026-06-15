import { notFound } from 'next/navigation';

import { GoalsContent, isGoalsFilter } from '@/features/issues';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Goals' };

/**
 * Organization Goals tab — open epics and unlinked tasks scoped to this
 * organization, with a summary strip and filter chips.
 * @param props - Component props.
 * @param props.params - Route params holding the organization id.
 * @param props.searchParams - Filter params (filter chip; q is client-side).
 * @returns JSX element.
 */
export default async function OrganizationGoalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { id } = await params;
  const orgId = Number(id);

  // Guard against a non-numeric id: Number('abc') / Number('0') are falsy, which
  // buildIssuesQuery drops, making getEpics return epics from ALL of the user's
  // orgs instead of this one. Fail with 404 instead of leaking cross-org goals.
  if (!Number.isInteger(orgId) || orgId <= 0) {
    notFound();
  }

  const sp = await searchParams;
  const filter = isGoalsFilter(sp.filter) ? sp.filter : 'all';
  const currentUserId = await getCurrentUserId();

  return (
    <div className='space-y-6'>
      <GoalsContent
        orgId={orgId}
        filter={filter}
        currentUserId={currentUserId}
      />
    </div>
  );
}
