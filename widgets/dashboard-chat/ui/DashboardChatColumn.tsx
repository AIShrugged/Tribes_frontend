'use client';

import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type PropsWithChildren, Suspense } from 'react';

import { CollapsedSidePanel } from '@/shared/ui/layout/collapsed-side-panel';
import { Skeleton } from '@/shared/ui/layout/skeleton';
import { isChatColumnHidden } from '@/widgets/dashboard-chat/model/chat-column-config';
import { useDashboardChatColumnStore } from '@/widgets/dashboard-chat/model/dashboard-chat-column-store';

/**
 * DashboardChatColumn — wraps the chat panel in the dashboard layout.
 * Hides on /dashboard/chat/** routes to avoid duplication.
 * Supports collapse/expand with persisted state.
 * @param root0 - Component props.
 * @param root0.children - The chat panel to render.
 * @returns JSX element or null.
 */
export function DashboardChatColumn({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { isCollapsed, setCollapsed } = useDashboardChatColumnStore();

  if (isChatColumnHidden(pathname)) return null;

  return (
    <div
      className={`hidden xl:flex flex-col flex-shrink-0 border-l border-border overflow-hidden transition-[width] duration-[var(--dur-norm)] ${isCollapsed ? 'w-10' : 'w-[480px]'}`}
    >
      {isCollapsed ? (
        <CollapsedSidePanel
          label='Chat'
          icon='left'
          className='border-none'
          onExpand={() => {
            return setCollapsed(false);
          }}
        />
      ) : (
        <>
          <div className='flex items-center h-8 px-2 flex-shrink-0 border-b border-border'>
            <button
              type='button'
              onClick={() => {
                return setCollapsed(true);
              }}
              className='flex items-center gap-1 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              aria-label='Collapse chat panel'
            >
              <ChevronRight className='w-4 h-4' />
              <span className='text-xs'>Hide</span>
            </button>
          </div>
          <Suspense fallback={<Skeleton className='h-full w-full' />}>
            {children}
          </Suspense>
        </>
      )}
    </div>
  );
}
