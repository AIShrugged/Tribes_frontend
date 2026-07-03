'use client';

import { useEffect, useRef } from 'react';

import { getBrainInstance } from '@/features/brain/api/instances';
import { isTransitionalStatus } from '@/features/brain/lib/instance-status';

import type { SecondBrainInstance } from '@/features/brain/model/types';

const POLL_INTERVAL_MS = 7000;

/**
 * Polls a single organization's instance while its status is transitional
 * (pending / stopping / stopped), pushing each fresh snapshot through
 * `onUpdate`. Stops on a stable status or unmount. Server Actions aren't
 * abortable, so a `cancelled` guard around a self-rescheduling timeout drops
 * any in-flight result after teardown (spec §4 `pollUntilStable`).
 * @param instance - the current instance snapshot.
 * @param onUpdate - receives each polled snapshot.
 */
export function useBrainInstancePoll(
  instance: SecondBrainInstance,
  onUpdate: (next: SecondBrainInstance) => void,
): void {
  const onUpdateRef = useRef(onUpdate);

  // Keep the latest callback without making it an effect dependency (would
  // re-subscribe the poll loop on every parent render).
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  const organizationId = instance.organization_id;
  const shouldPoll = isTransitionalStatus(instance.status);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const next = await getBrainInstance(organizationId);

        if (cancelled) return;

        onUpdateRef.current(next);

        // Keep going only while the fresh status is still transitional.
        if (isTransitionalStatus(next.status)) {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        // Network/permission hiccup — stop polling, keep the last snapshot.
      }
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shouldPoll, organizationId]);
}
