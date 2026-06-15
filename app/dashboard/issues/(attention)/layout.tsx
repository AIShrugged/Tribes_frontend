import { IssuesTabsNav } from '@/features/issues';

import type { PropsWithChildren } from 'react';

export default function IssuesAttentionLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex flex-col p-2'>
      <div className='shrink-0 mb-4'>
        <IssuesTabsNav />
      </div>
      {children}
    </div>
  );
}
