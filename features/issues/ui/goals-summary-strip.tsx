import type { GoalsSummary } from '@/features/issues/model/goals-summary';

/**
 * GoalsSummaryStrip — 4-cell goal-scoped count strip (Open / In progress /
 * Review / Overdue), computed client-side from the epics array.
 * @param props - Component props.
 * @param props.summary - precomputed summary counts.
 * @returns JSX element.
 */
export function GoalsSummaryStrip({ summary }: { summary: GoalsSummary }) {
  const cells: { label: string; value: number; className: string }[] = [
    {
      label: 'Open',
      value: summary.open,
      className: 'text-[var(--foreground)]',
    },
    {
      label: 'In progress',
      value: summary.inProgress,
      className: 'text-emerald-500',
    },
    { label: 'Review', value: summary.review, className: 'text-amber-500' },
    { label: 'Overdue', value: summary.overdue, className: 'text-red-500' },
  ];

  return (
    <div className='grid grid-cols-2 gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-4'>
      {cells.map((cell) => {
        return (
          <div key={cell.label}>
            <div className='text-xs text-[var(--muted-foreground)]'>
              {cell.label}
            </div>
            <div className={`mt-0.5 text-xl font-semibold ${cell.className}`}>
              {cell.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
