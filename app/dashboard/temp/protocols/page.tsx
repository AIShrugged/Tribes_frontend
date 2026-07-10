import { getOrgEventsForPicker } from '@/entities/event/api/calendar-events';
import {
  BrainAccessDenied,
  MeetingProtocolAgenda,
  getBrainAccessContext,
} from '@/features/brain';

export const metadata = { title: 'Протокол и агенда' };

/**
 * Protocol & agenda tab — for a picked meeting, shows the protocol (summary of
 * the meeting that happened) and the agenda (of the next meeting in the series).
 * Manager-only, consistent with the rest of the Temp section. The second brain
 * works at the organization level, so the picker lists ORG-wide meetings (via
 * getOrgEventsForPicker) — colleagues' meetings included — not just the current
 * user's own, so their protocols/agendas are reachable here.
 */
export default async function TempProtocolsPage() {
  const { canManageBrain } = await getBrainAccessContext();

  if (!canManageBrain) {
    return <BrainAccessDenied />;
  }

  const meetings = await getOrgEventsForPicker();

  return <MeetingProtocolAgenda meetings={meetings} />;
}
