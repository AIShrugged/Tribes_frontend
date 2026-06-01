import type { PropsWithChildren } from 'react';

/**
 * MeetingsLayout — shared layout for all meetings sub-routes.
 */
export default function MeetingsLayout({ children }: PropsWithChildren) {
  return (
    <div className='flex flex-col h-full overflow-hidden p-2'>
      <div className='flex-1 overflow-y-auto'>{children}</div>
    </div>
  );
}
