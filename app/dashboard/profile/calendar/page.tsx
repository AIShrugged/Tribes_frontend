import { getSources } from '@/features/calendar';
import { getOrganizations } from '@/features/organization/api/organization';
import { CalendarSection } from '@/features/user-profile';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const metadata = { title: 'Calendar' };

/**
 * Calendar tab — displays the connected calendar status and disconnect action.
 * Also provides an attach button when no calendar is connected.
 */
export default async function ProfileCalendarPage() {
  const [sources, orgId, { data: organizations }] = await Promise.all([
    getSources(),
    getOrganizationId(),
    getOrganizations(),
  ]);

  const calendarSource =
    sources.find((s) => {
      return s.is_connected === '1' || s.is_connected === true;
    }) ?? null;

  const orgName =
    calendarSource?.organization_id !== null &&
    calendarSource?.organization_id !== undefined
      ? (organizations?.find((o) => {
          return o.id === calendarSource.organization_id;
        })?.name ?? null)
      : null;

  return (
    <CalendarSection
      source={calendarSource}
      organizationId={orgId}
      organizationName={orgName}
    />
  );
}
