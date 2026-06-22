import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

/**
 * Redirects to the default Temp tab (Предложения).
 */
export default function TempPage() {
  redirect(ROUTES.DASHBOARD.TEMP_SUGGESTIONS);
}
