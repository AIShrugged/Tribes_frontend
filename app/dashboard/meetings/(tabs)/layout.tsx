import { MeetingsTabsNav } from '@/features/meetings';

import type { PropsWithChildren } from 'react';

/**
 * Meetings tabbed-views layout — the Calendar / List / Organization tab strip.
 * Lives in the (tabs) route group so the meeting detail route (`[id]`), which has
 * its own tabs, sits outside it and does not inherit this strip.
 */
export default function MeetingsTabsLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex h-full flex-col overflow-hidden'>
      <div className='shrink-0 mb-4'>
        <MeetingsTabsNav />
      </div>
      <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
    </div>
  );
}
