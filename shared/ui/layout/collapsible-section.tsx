'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

type CollapsibleSectionProps = React.PropsWithChildren<{
  label: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  extraContent?: React.ReactNode;
}>;

export function CollapsibleSection({
  label,
  icon,
  defaultOpen = true,
  className,
  children,
  extraContent,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useMemo(() => {
    return `collapsible-${label.toLowerCase().replaceAll(/\W+/g, '-')}`;
  }, [label]);

  return (
    <div className={className}>
      <div className={'flex flex-row items-center justify-between mb-2'}>
        <button
          type='button'
          onClick={() => {
            setOpen((v) => {
              return !v;
            });
          }}
          aria-label={open ? `Hide ${label}` : `Show ${label}`}
          aria-expanded={open}
          aria-controls={contentId}
          className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none'
        >
          {icon}
          {label}
          <ChevronDown
            className='h-3.5 w-3.5 transition-transform duration-200'
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </button>
        {extraContent}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            role='region'
            aria-label={label}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
