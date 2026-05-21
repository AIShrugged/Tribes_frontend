'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function CalendarAttachedToast() {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    toast.success('Google Calendar connected successfully!');

    const url = new URL(globalThis.location.href);

    url.searchParams.delete('attached');
    router.replace(url.pathname + (url.search || ''));
  }, [router]);

  return null;
}
