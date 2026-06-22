interface Props {
  value: number | null | undefined;
}

/** Compact confidence indicator — a small bar plus the percentage. */
export function ConfidenceMeter({ value }: Props) {
  if (value === null || value === undefined) return null;

  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className='flex items-center gap-2'
      title={`Уверенность: ${pct}%`}
      aria-label={`Уверенность ${pct} процентов`}
    >
      <span className='text-xs text-[var(--muted-foreground)]'>
        Уверенность
      </span>
      <div className='h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-3)]'>
        <div
          className='h-full rounded-full bg-[var(--primary)]'
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className='text-xs font-medium text-[var(--foreground)]'>
        {pct}%
      </span>
    </div>
  );
}
