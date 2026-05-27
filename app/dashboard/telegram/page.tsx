import { getOrganizations } from '@/features/organization';
import { getTelegramChats, TelegramChatsManagement } from '@/features/telegram';
import { TELEGRAM_BOT_USERNAME } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export default async function TelegramPage() {
  const organizationId = await getOrganizationId();
  const [{ data: chats }, { data: organizations }] = await Promise.all([
    getTelegramChats(organizationId),
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
      selectedOrganizationId={organizationId}
      orgMap={orgMap}
      botUsername={TELEGRAM_BOT_USERNAME ?? 'your_bot'}
    />
  );
}
