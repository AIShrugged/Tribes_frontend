import SpinLoader from '@/shared/ui/layout/spin-loader';

/**
 * Loading state for Meetings calendar tab.
 */
export default function Loading() {
  return (
    <div className='flex flex-1 items-center justify-center py-12'>
      <SpinLoader />
    </div>
  );
}
