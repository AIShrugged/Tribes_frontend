import { TelegramTabsNav } from '@/features/telegram';

import type { PropsWithChildren } from 'react';

/**
 * TelegramLayout — tab strip for the Telegram section. Pure presentational
 * (no data fetching); each tab page fetches its own prerequisites.
 */
export default function TelegramLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex h-full flex-col overflow-hidden p-2'>
      <div className='mb-4 shrink-0'>
        <TelegramTabsNav />
      </div>
      <div className='flex-1 overflow-y-auto'>{children}</div>
    </div>
  );
}
