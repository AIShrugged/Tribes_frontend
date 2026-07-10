'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  generateMeetingAgenda,
  getMeetingAgendas,
} from '@/features/brain/api/meeting-agenda';
import { getMeetingDrafts } from '@/features/brain/api/meeting-suggestions';
import {
  generateMeetingSummary,
  getMeetingSummary,
} from '@/features/brain/api/meeting-summary';
import {
  approveBrainSuggestion,
  rejectBrainSuggestion,
} from '@/features/brain/api/suggestions';

import type {
  BrainApproveOutcome,
  BrainRejectOutcome,
  BrainSuggestion,
  MeetingAgenda,
  MeetingSummary,
} from '@/features/brain/model/types';

interface MeetingArtifacts {
  summary: MeetingSummary | null;
  agenda: MeetingAgenda | null;
  summaryDraft: BrainSuggestion | null;
  agendaDraft: BrainSuggestion | null;
  loading: boolean;
  error: string | null;
  regeneratingSummary: boolean;
  regeneratingAgenda: boolean;
  /** Id of the draft currently being approved/rejected, or null. */
  busyDraftId: number | null;
  regenerateSummary: () => Promise<void>;
  regenerateAgenda: () => Promise<void>;
  approveDraft: (id: number) => Promise<void>;
  rejectDraft: (id: number) => Promise<void>;
}

/** Surfaces the outcome of an approve/reject as a toast; true when it applied. */
function reportOutcome(
  outcome: BrainApproveOutcome | BrainRejectOutcome,
): void {
  switch (outcome.kind) {
    case 'applied': {
      toast.success('Предложение одобрено');

      return;
    }
    case 'rejected': {
      toast.success('Предложение отклонено');

      return;
    }
    case 'failed': {
      toast.error(
        outcome.suggestion.failure_reason ?? 'Не удалось применить предложение',
      );

      return;
    }
    default: {
      // conflict | forbidden | error — all carry a human message.
      toast.error(outcome.message);
    }
  }
}

/**
 * Loads a meeting's protocol and `general` agenda, the pending brain drafts for
 * both, and exposes manager regeneration and draft approve/reject. Refetching is
 * race-guarded so a slow earlier request never overwrites a newer selection.
 * @param calendarEventId - the selected calendar event id, or null.
 */
export function useMeetingArtifacts(
  calendarEventId: number | null,
): MeetingArtifacts {
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<BrainSuggestion | null>(
    null,
  );
  const [agendaDraft, setAgendaDraft] = useState<BrainSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [regeneratingAgenda, setRegeneratingAgenda] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<number | null>(null);

  // Guards against a slow earlier request overwriting a newer selection.
  const reqRef = useRef(0);

  const load = useCallback(async (id: number) => {
    const req = ++reqRef.current;

    setLoading(true);
    setError(null);

    try {
      const [summaryResult, agendas, drafts] = await Promise.all([
        getMeetingSummary(id),
        getMeetingAgendas(id),
        getMeetingDrafts(id),
      ]);

      if (req !== reqRef.current) return;

      setSummary(summaryResult);
      setAgenda(
        agendas.find((item) => {
          return item.type === 'general';
        }) ?? null,
      );
      setSummaryDraft(drafts.summaryDraft);
      setAgendaDraft(drafts.agendaDraft);
    } catch {
      if (req !== reqRef.current) return;

      setError('Не удалось загрузить протокол и агенду. Попробуйте ещё раз.');
      setSummary(null);
      setAgenda(null);
      setSummaryDraft(null);
      setAgendaDraft(null);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (calendarEventId == null) {
      setSummary(null);
      setAgenda(null);
      setSummaryDraft(null);
      setAgendaDraft(null);

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

  const approveDraft = useCallback(
    async (id: number) => {
      setBusyDraftId(id);

      try {
        reportOutcome(await approveBrainSuggestion(id));

        if (calendarEventId != null) await load(calendarEventId);
      } finally {
        setBusyDraftId(null);
      }
    },
    [calendarEventId, load],
  );

  const rejectDraft = useCallback(
    async (id: number) => {
      setBusyDraftId(id);

      try {
        reportOutcome(await rejectBrainSuggestion(id));

        if (calendarEventId != null) await load(calendarEventId);
      } finally {
        setBusyDraftId(null);
      }
    },
    [calendarEventId, load],
  );

  return {
    summary,
    agenda,
    summaryDraft,
    agendaDraft,
    loading,
    error,
    regeneratingSummary,
    regeneratingAgenda,
    busyDraftId,
    regenerateSummary,
    regenerateAgenda,
    approveDraft,
    rejectDraft,
  };
}
