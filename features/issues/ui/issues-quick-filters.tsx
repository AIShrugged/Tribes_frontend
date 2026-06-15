'use client';

import { useFiltersContext } from '@/features/issues/model/filters-context';

type ChipId = 'all' | 'mine';

const CHIPS: Array<{ id: ChipId; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'mine', label: 'Мои' },
];

function chipBaseClass(isActive: boolean): string {
  if (isActive) {
    return 'border border-border bg-secondary text-foreground';
  }
  return 'border border-transparent text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/50';
}

export function IssuesQuickFilters({
  totalCount,
  overdue,
  currentUserId,
}: {
  totalCount: number;
  overdue: number;
  currentUserId: number | null;
}) {
  const { filters, handleFiltersChange } = useFiltersContext();

  const activeChip: ChipId =
    currentUserId !== null && filters.assignee_id === String(currentUserId)
      ? 'mine'
      : 'all';

  function handleClick(id: ChipId) {
    if (id === 'all') {
      handleFiltersChange({ assignee_id: '' });
    } else if (currentUserId !== null) {
      handleFiltersChange({ assignee_id: String(currentUserId) });
    }
  }

  return (
    <div className='flex items-center gap-2 flex-wrap'>
      {CHIPS.map((chip) => {
        const isActive = chip.id === activeChip;
        return (
          <button
            key={chip.id}
            type='button'
            onClick={() => {
              handleClick(chip.id);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipBaseClass(isActive)}`}
          >
            {chip.label}
            {isActive && (
              <span className='text-xs text-muted-foreground'>
                · {totalCount}
              </span>
            )}
          </button>
        );
      })}

      {overdue > 0 && (
        <span className='inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/8 px-3.5 py-1 text-sm font-medium text-red-400'>
          Просрочено
          <span className='text-xs text-red-400/60'>· {overdue}</span>
        </span>
      )}
    </div>
  );
}
