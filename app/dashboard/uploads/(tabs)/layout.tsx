import { UploadsTabsNav } from '@/features/uploads';

import type { PropsWithChildren } from 'react';

/**
 * UploadsLayout — tab strip for the Uploads section. Pure presentational
 * (no data fetching); each tab page fetches its own prerequisites. The detail
 * route lives OUTSIDE this (tabs) group so it does not inherit the tab strip.
 */
export default function UploadsLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex flex-col h-full overflow-hidden p-2'>
      <div className='shrink-0 mb-4'>
        <UploadsTabsNav />
      </div>
      <div className='flex-1 overflow-y-auto'>{children}</div>
    </div>
  );
}
