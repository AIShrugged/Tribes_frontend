import { EpicGoalCardSkeleton } from '@/features/issues/ui/epic-goal-card';

export default function GoalsLoading() {
  return (
    <div className='space-y-4 p-6'>
      {[1, 2, 3].map((i) => {
        return <EpicGoalCardSkeleton key={i} />;
      })}
    </div>
  );
}
