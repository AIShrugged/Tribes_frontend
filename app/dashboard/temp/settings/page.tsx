import {
  BrainAccessDenied,
  BrainInstanceCard,
  getBrainAccessContext,
  getBrainInstance,
} from '@/features/brain';
import { ServerError } from '@/shared/lib/errors';

import type { SecondBrainInstance } from '@/features/brain';

export const metadata = { title: 'Управление вторым мозгом' };

/**
 * Management tab — turns the second brain on/off for the ACTIVE organization and
 * supplies the Claude credential. Manager-only (of that org); scoped to the org
 * selected in the switcher.
 */
export default async function TempSettingsPage() {
  const { canManageBrain, activeOrganization } = await getBrainAccessContext();

  if (!canManageBrain || !activeOrganization) {
    return <BrainAccessDenied />;
  }

  let accessDenied = false;
  let instance: SecondBrainInstance | null = null;

  await getBrainInstance(activeOrganization.id)
    .then((data) => {
      instance = data;
    })
    .catch((error) => {
      if (error instanceof ServerError && error.status === 403) {
        accessDenied = true;
      } else {
        throw error;
      }
    });

  if (accessDenied || !instance) {
    return <BrainAccessDenied />;
  }

  return (
    <div className='flex max-w-2xl flex-col gap-4'>
      <p className='text-sm text-[var(--muted-foreground)]'>
        «Второй мозг» помогает вести задачи и решения организации «
        {activeOrganization.name}». Чтобы включить его, укажите доступ к Claude:
        токен подписки Claude или API-ключ Anthropic.
      </p>
      <BrainInstanceCard
        instance={instance}
        organizationName={activeOrganization.name}
      />
    </div>
  );
}
