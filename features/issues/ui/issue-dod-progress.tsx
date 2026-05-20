import type { DoDItem } from '@/features/issues/model/types';

interface Props {
  dod: DoDItem[];
}

export function IssueDodProgress({ dod }: Props) {
  if (dod.length === 0) return null;

  const completed = dod.filter((item) => {
    return item.completed;
  }).length;
  const pct = Math.round((completed / dod.length) * 100);
  const allDone = completed === dod.length;

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-muted-foreground'>Definition of Done</span>
        <span className='text-xs text-muted-foreground tabular-nums'>
          {completed} / {dod.length}
        </span>
      </div>
      <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className={[
            'h-full rounded-full transition-all duration-300',
            allDone ? 'bg-primary' : 'bg-accent',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}