'use client';

import { useRef, type KeyboardEvent } from 'react';

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'epic', label: 'Epics' },
  { value: 'task', label: 'Tasks' },
] as const;

type ToggleValue = (typeof OPTIONS)[number]['value'];

interface Props {
  value: ToggleValue;
  onChange: (value: ToggleValue) => void;
}

export function IssueTypeToggle({ value, onChange }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (index + 1) % OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    }
    if (next !== -1) {
      e.preventDefault();
      refs.current[next]?.focus();
      onChange(OPTIONS[next].value);
    }
  }

  return (
    <div
      role='radiogroup'
      aria-label='Issue type'
      className='inline-flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5'
    >
      {OPTIONS.map((opt, i) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role='radio'
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              return onChange(opt.value);
            }}
            onKeyDown={(e) => {
              return handleKeyDown(e, i);
            }}
            className={[
              'px-3 py-1 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              checked
                ? 'bg-card border border-white/8 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
