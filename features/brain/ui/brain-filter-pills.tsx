'use client';

import clsx from 'clsx';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/** A compact row of single-select filter pills, used for status/key filters. */
export function BrainFilterPills<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: Props<T>) {
  return (
    <div className='flex flex-wrap gap-1.5' role='group' aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type='button'
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => {
              onChange(option.value);
            }}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              disabled && 'cursor-not-allowed opacity-50',
              isActive
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-soft-text)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
