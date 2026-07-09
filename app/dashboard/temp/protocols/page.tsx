import { getPastEventsForPicker } from '@/entities/event/api/calendar-events';
import {
  BrainAccessDenied,
  MeetingProtocolAgenda,
  getBrainAccessContext,
} from '@/features/brain';

export const metadata = { title: 'Протокол и агенда' };

/**
 * Protocol & agenda tab — for a picked past meeting, shows the protocol (summary
 * of the meeting that happened) and the agenda (of the next meeting in the
 * series). Manager-only, consistent with the rest of the Temp section. The
 * meeting picker lists the current user's past meetings (the endpoints are
 * scoped to their own events).
 */
export default async function TempProtocolsPage() {
  const { canManageBrain } = await getBrainAccessContext();

  if (!canManageBrain) {
    return <BrainAccessDenied />;
  }

  const meetings = await getPastEventsForPicker(50);

  return <MeetingProtocolAgenda meetings={meetings} />;
}
