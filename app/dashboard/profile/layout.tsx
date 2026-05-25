import { ProfileTabsNav } from '@/features/user-profile';
import { Card } from '@/shared/ui/card';

import type { PropsWithChildren } from 'react';

export default function ProfileLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex flex-col h-full overflow-hidden p-2'>
      <div className='shrink-0 mb-4'>
        <ProfileTabsNav />
      </div>
      <Card className='h-full flex flex-col min-h-0'>
        <div className='flex-1 overflow-y-auto p-4'>{children}</div>
      </Card>
    </div>
  );
}
