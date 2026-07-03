import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

/**
 * Redirects to the default Temp tab (Управление) — the control surface where a
 * manager turns the second brain on/off, the natural landing when it may be off.
 */
export default function TempPage() {
  redirect(ROUTES.DASHBOARD.TEMP_SETTINGS);
}
