import Link from 'next/link';

import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card';

/**
 * NotFound component.
 */
export default function NotFound() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-muted p-4'>
      <Card className='max-w-md w-full'>
        <div className='flex flex-col items-center gap-6 text-center px-8 py-12'>
          <div className='text-8xl font-bold text-primary'>404</div>
          <h1 className='text-2xl font-semibold text-foreground'>
            Page Not Found
          </h1>
          <p className='text-muted-foreground'>
            The page you are looking for does not exist or has been moved.
          </p>
          <div className='flex gap-4'>
            <Link href={ROUTES.DASHBOARD.MEETINGS_CALENDAR} className='cursor-pointer'>
              <Button>Go to Calendar</Button>
            </Link>
            <Link href={ROUTES.AUTH.LOGIN} className='cursor-pointer'>
              <Button variant='secondary'>Sign In</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
