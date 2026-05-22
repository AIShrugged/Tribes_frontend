'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { lockScroll, unlockScroll } from '@/shared/lib/scroll-lock';
import { useIsMounted } from '@/shared/lib/use-is-mounted';
import { isChatColumnHidden } from '@/widgets/dashboard-chat/model/chat-column-config';

import { DashboardChatPanel } from './DashboardChatPanel';

import type { Chat, Message } from '@/features/chat';

interface MobileChatDrawerProps {
  initialChat: Chat | null;
  initialMessages: Message[];
  totalMessagesCount: number;
  startOffset: number;
}

export function MobileChatDrawer({
  initialChat,
  initialMessages,
  totalMessagesCount,
  startOffset,
}: MobileChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isMounted = useIsMounted();
  const fabRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isHidden = isChatColumnHidden(pathname);
  const prevPathnameRef = useRef(pathname);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Close when navigating away (prevents stale open state + scroll lock surviving navigation)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, [pathname]);

  // Move focus into dialog when it opens (WCAG 2.4.3)
  useEffect(() => {
    if (isOpen) sheetRef.current?.focus();
  }, [isOpen]);

  // Scroll lock + Escape key while open
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unlockScroll();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (isHidden) return null;

  return (
    <>
      {/* FAB — inline fixed, z-[30] intentionally below MobileSidebar backdrop (z-40) */}
      <button
        ref={fabRef}
        type='button'
        onClick={() => { setIsOpen(true); }}
        aria-label='Open chat'
        aria-expanded={isOpen}
        aria-haspopup='dialog'
        aria-controls='mobile-chat-sheet'
        className='fixed z-[30] xl:hidden bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
      >
        <MessageSquare className='w-6 h-6' aria-hidden='true' />
      </button>

      {/* Portal — always mounted so AnimatePresence exit animations run */}
      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  key='mobile-chat-backdrop'
                  className='fixed inset-0 z-[50] bg-black/50 xl:hidden'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleClose}
                  aria-hidden='true'
                />

                {/* Sheet */}
                <motion.div
                  id='mobile-chat-sheet'
                  key='mobile-chat-drawer'
                  ref={sheetRef}
                  role='dialog'
                  aria-modal='true'
                  aria-label='Chat'
                  tabIndex={-1}
                  className='fixed bottom-0 inset-x-0 z-[60] xl:hidden max-h-[calc(100dvh-env(safe-area-inset-top)-44px)] h-[85dvh] rounded-t-[var(--radius-card)] bg-card border-t border-border flex flex-col overflow-hidden outline-none'
                  initial={{ y: '100%' }}
                  animate={{
                    y: 0,
                    transition: { type: 'spring', stiffness: 400, damping: 40, mass: 0.8 },
                  }}
                  exit={{ y: '100%', transition: { type: 'tween', ease: 'easeIn', duration: 0.2 } }}
                  onAnimationComplete={() => {
                    return !isOpen && fabRef.current?.focus();
                  }}
                >
                  {/* Drag handle + header */}
                  <div className='h-10 flex items-center justify-between px-4 border-b border-border flex-shrink-0 relative'>
                    <div
                      className='absolute left-1/2 top-2 -translate-x-1/2 w-8 h-1 rounded-full bg-muted-foreground/30'
                      aria-hidden='true'
                    />
                    <span className='text-sm font-medium'>Chat</span>
                    <button
                      type='button'
                      onClick={handleClose}
                      aria-label='Close chat'
                      className='flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                    >
                      <X className='w-4 h-4' aria-hidden='true' />
                    </button>
                  </div>

                  {/* Scrollable chat content — overscroll-contain prevents body scroll bleed on iOS */}
                  <div className='flex-1 min-h-0 overflow-y-auto overscroll-contain'>
                    <DashboardChatPanel
                      initialChat={initialChat}
                      initialMessages={initialMessages}
                      totalMessagesCount={totalMessagesCount}
                      startOffset={startOffset}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
