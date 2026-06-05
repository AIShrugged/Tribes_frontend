import { EpicGoalCardSkeleton } from '@/features/issues';

export default function OrganizationGoalsLoading() {
  return (
    <div className='space-y-4'>
      {[1, 2, 3].map((i) => {
        return <EpicGoalCardSkeleton key={i} />;
      })}
    </div>
  );
}
