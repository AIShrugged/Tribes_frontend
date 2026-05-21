import { TelegramLinkSection } from '@/features/user-profile';
import { getIdentities } from '@/features/user-profile/api/identities';

export default async function IntegrationsPage() {
  const identities = await getIdentities();
  const telegramIdentity =
    identities.find((i) => {
      return i.channel === 'telegram';
    }) ?? null;

  return (
    <div className='space-y-6'>
      <TelegramLinkSection initialTelegramIdentity={telegramIdentity} />
    </div>
  );
}
