'use client';

import { useEffect, useRef } from 'react';

import type { ProfileIdentity } from '@/entities/user';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

async function fetchIdentities(): Promise<ProfileIdentity[]> {
  const res = await fetch('/api/identities', { cache: 'no-store' });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) return [];
  const data: ProfileIdentity[] = await res.json();
  return data;
}

export function useTelegramLinkPoll(
  enabled: boolean,
  onLinked: (identity: ProfileIdentity) => void,
) {
  const onLinkedRef = useRef(onLinked);
  const stoppedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    onLinkedRef.current = onLinked;
  }, [onLinked]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    isFetchingRef.current = false;
    let attemptsCount = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (stoppedRef.current) return;
      if (isFetchingRef.current) {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      if (attemptsCount >= MAX_POLL_ATTEMPTS) return;

      if (document.visibilityState !== 'visible') {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      attemptsCount += 1;
      isFetchingRef.current = true;
      try {
        const identities = await fetchIdentities();
        if (stoppedRef.current) return;
        const telegram = identities.find((i) => i.channel === 'telegram');
        if (telegram) {
          stoppedRef.current = true;
          onLinkedRef.current(telegram);
          return;
        }
      } catch {
        // retry on next tick
      } finally {
        isFetchingRef.current = false;
      }

      if (!stoppedRef.current) {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    timerId = setTimeout(poll, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && !stoppedRef.current) {
        if (timerId !== null) clearTimeout(timerId);
        void poll();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stoppedRef.current = true;
      if (timerId !== null) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
