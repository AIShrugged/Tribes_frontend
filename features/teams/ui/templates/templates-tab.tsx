'use client';

import { useEffect, useState } from 'react';

import { getAgendaTemplate } from '@/features/teams/api/agenda-template';
import { getMeetingSummaryTemplate } from '@/features/teams/api/meeting-summary-template';
import {
  type AgendaTemplateResolved,
  type MeetingSummaryTemplateResolved,
} from '@/features/teams/model/types';

import { AgendaTemplateEditor } from './agenda-template-editor';
import { MeetingSummaryTemplateEditor } from './meeting-summary-template-editor';

interface Props {
  teamId: number;
  isReadOnly: boolean;
}

export function TemplatesTab({ teamId, isReadOnly }: Props) {
  const [summary, setSummary] = useState<MeetingSummaryTemplateResolved | null>(
    null,
  );
  const [agenda, setAgenda] = useState<AgendaTemplateResolved | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMeetingSummaryTemplate(teamId), getAgendaTemplate(teamId)])
      .then(([s, a]) => {
        if (cancelled) return;
        setSummary(s);
        setAgenda(a);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Failed to load templates';
        setLoadError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loadError) {
    return (
      <p className='text-sm text-destructive py-6 text-center'>{loadError}</p>
    );
  }

  if (!summary || !agenda) {
    return (
      <div className='flex flex-col gap-5'>
        <div className='h-40 rounded-[var(--radius-card)] border border-border bg-card animate-pulse' />
        <div className='h-72 rounded-[var(--radius-card)] border border-border bg-card animate-pulse' />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-5'>
      <MeetingSummaryTemplateEditor
        teamId={teamId}
        resolved={summary}
        isReadOnly={isReadOnly}
      />
      <AgendaTemplateEditor
        teamId={teamId}
        resolved={agenda}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
