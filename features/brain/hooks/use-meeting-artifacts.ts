'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  generateMeetingAgenda,
  getMeetingAgendas,
} from '@/features/brain/api/meeting-agenda';
import {
  generateMeetingSummary,
  getMeetingSummary,
} from '@/features/brain/api/meeting-summary';

import type {
  MeetingAgenda,
  MeetingSummary,
} from '@/features/brain/model/types';

interface MeetingArtifacts {
  summary: MeetingSummary | null;
  agenda: MeetingAgenda | null;
  loading: boolean;
  error: string | null;
  regeneratingSummary: boolean;
  regeneratingAgenda: boolean;
  regenerateSummary: () => Promise<void>;
  regenerateAgenda: () => Promise<void>;
}

/**
 * Loads a meeting's protocol (summary) and its `general` agenda together and
 * exposes manager regeneration for each. Refetching is race-guarded so a slow
 * earlier request never overwrites a newer selection. Pass `null` to clear.
 * @param calendarEventId - the selected calendar event id, or null.
 */
export function useMeetingArtifacts(
  calendarEventId: number | null,
): MeetingArtifacts {
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [regeneratingAgenda, setRegeneratingAgenda] = useState(false);

  // Guards against a slow earlier request overwriting a newer selection.
  const reqRef = useRef(0);

  const load = useCallback(async (id: number) => {
    const req = ++reqRef.current;

    setLoading(true);
    setError(null);

    try {
      const [summaryResult, agendas] = await Promise.all([
        getMeetingSummary(id),
        getMeetingAgendas(id),
      ]);

      if (req !== reqRef.current) return;

      setSummary(summaryResult);
      setAgenda(
        agendas.find((item) => {
          return item.type === 'general';
        }) ?? null,
      );
    } catch {
      if (req !== reqRef.current) return;

      setError('Не удалось загрузить протокол и агенду. Попробуйте ещё раз.');
      setSummary(null);
      setAgenda(null);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (calendarEventId == null) {
      setSummary(null);
      setAgenda(null);

      return;
    }

    load(calendarEventId).catch(() => {});
  }, [calendarEventId, load]);

  const regenerateSummary = useCallback(async () => {
    if (calendarEventId == null) return;

    setRegeneratingSummary(true);

    try {
      const result = await generateMeetingSummary(calendarEventId);

      if (result.error) {
        toast.error(result.error);

        return;
      }

      toast.success('Протокол пересобран');
      await load(calendarEventId);
    } finally {
      setRegeneratingSummary(false);
    }
  }, [calendarEventId, load]);

  const regenerateAgenda = useCallback(async () => {
    if (calendarEventId == null) return;

    setRegeneratingAgenda(true);

    try {
      const result = await generateMeetingAgenda(calendarEventId);

      if (result.error) {
        toast.error(result.error);

        return;
      }

      toast.success('Генерация агенды запущена');
      await load(calendarEventId);
    } finally {
      setRegeneratingAgenda(false);
    }
  }, [calendarEventId, load]);

  return {
    summary,
    agenda,
    loading,
    error,
    regeneratingSummary,
    regeneratingAgenda,
    regenerateSummary,
    regenerateAgenda,
  };
}
