import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export default function TelegramPage() {
  redirect(ROUTES.DASHBOARD.TELEGRAM_CHATS);
}
