'use client';

import { MotionConfig } from 'framer-motion';
import React, { type PropsWithChildren } from 'react';
import { Toaster } from 'sonner';

import { ModalProvider } from '@/app/providers/ModalProvider';
import { PopupProvider } from '@/app/providers/PopupProvider';

/**
 * Providers component.
 * @param props - Component props.
 * @param props.children
 */
export default function Providers({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion='user'>
      <Toaster
        position='top-center'
        richColors
        toastOptions={{
          style: {
            background: 'var(--surface-3)',
            border: 'none',
            boxShadow: 'inset 0 0 0 1px var(--border), var(--shadow-lg)',
            color: 'var(--foreground)',
            borderRadius: 'var(--r-lg)',
            fontSize: 'var(--fs-sm)',
          },
        }}
      />
      <ModalProvider>
        <PopupProvider>{children}</PopupProvider>
      </ModalProvider>
    </MotionConfig>
  );
}
