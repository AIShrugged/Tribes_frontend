import { BrainTabsNav } from '@/features/brain';

import type { PropsWithChildren } from 'react';

/**
 * TempLayout — shared layout for the second-brain (Temp) section: a route-based
 * tab strip (Предложения / Журнал размышлений) above the active sub-page.
 */
export default function TempLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex flex-col h-full overflow-hidden p-2'>
      <div className='shrink-0 mb-4'>
        <BrainTabsNav />
      </div>
      <div className='flex-1 overflow-y-auto'>{children}</div>
    </div>
  );
}
