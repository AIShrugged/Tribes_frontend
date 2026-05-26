import { getOrganizations } from '@/features/organization';
import { getTelegramChats, TelegramChatsManagement } from '@/features/telegram';
import { TELEGRAM_BOT_USERNAME } from '@/shared/lib/config';

export default async function TelegramPage() {
  const [{ data: chats }, { data: organizations }] = await Promise.all([
    getTelegramChats(),
    getOrganizations(),
  ]);

  const orgList = organizations ?? [];
  const orgMap: Record<number, string> = Object.fromEntries(
    orgList.map((org) => {
      return [org.id, org.name];
    }),
  );

  return (
    <TelegramChatsManagement
      initialChats={chats}
      organizations={orgList}
      orgMap={orgMap}
      botUsername={TELEGRAM_BOT_USERNAME ?? 'your_bot'}
    />
  );
}
