import { permanentRedirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export default function TelegramRedirectPage() {
  permanentRedirect(ROUTES.DASHBOARD.TELEGRAM);
}
