'use client';

import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Disables interaction (also implied by `loading`). */
  disabled?: boolean;
  /** Shows a spinner in the thumb and blocks toggling while an action is in flight. */
  loading?: boolean;
  id?: string;
  /** Accessible label when there is no visible <label>; prefer `aria-labelledby`. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

/**
 * Switch — accessible on/off toggle (the UI kit has none). Renders a native
 * button with `role="switch"` + `aria-checked` so keyboard (Space/Enter) and
 * screen readers work for free. Themed with `--primary` (on) / `--surface-3`
 * (off) tokens.
 * @param props - Component props.
 * @param props.checked - Whether the switch is on.
 * @param props.onCheckedChange - Called with the next checked value on toggle.
 * @param props.disabled - Disables interaction.
 * @param props.loading - Shows a spinner and blocks toggling.
 * @param props.id - Optional id for label association.
 * @param props.className - Extra classes.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  loading = false,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className,
}: SwitchProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type='button'
      role='switch'
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-busy={loading}
      disabled={isDisabled}
      onClick={() => {
        onCheckedChange(!checked);
      }}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        checked ? 'bg-[var(--primary)]' : 'bg-[var(--surface-3)]',
        isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span
        className={clsx(
          'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      >
        {loading && (
          <span
            className='h-3 w-3 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-transparent'
            aria-hidden='true'
          />
        )}
      </span>
    </button>
  );
}
