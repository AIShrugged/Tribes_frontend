'use client';

import { RefreshCw } from 'lucide-react';
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

interface TemplatesState {
  key: string;
  summary: MeetingSummaryTemplateResolved | null;
  agenda: AgendaTemplateResolved | null;
  loadError: string | null;
}

export function TemplatesTab({ teamId, isReadOnly }: Props) {
  const [templates, setTemplates] = useState<TemplatesState>({
    key: '',
    summary: null,
    agenda: null,
    loadError: null,
  });
  const [retryCount, setRetryCount] = useState(0);
  const stateKey = `${teamId}:${retryCount}`;
  const isCurrentState = templates.key === stateKey;
  const summary = isCurrentState ? templates.summary : null;
  const agenda = isCurrentState ? templates.agenda : null;
  const loadError = isCurrentState ? templates.loadError : null;

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMeetingSummaryTemplate(teamId), getAgendaTemplate(teamId)])
      .then(([s, a]) => {
        if (cancelled) return;
        setTemplates({
          key: stateKey,
          summary: s,
          agenda: a,
          loadError: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Failed to load templates';
        setTemplates({
          key: stateKey,
          summary: null,
          agenda: null,
          loadError: message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, stateKey]);

  if (loadError) {
    return (
      <div
        role='alert'
        className='flex flex-col items-center gap-3 py-10 text-center'
      >
        <p className='text-sm text-destructive'>{loadError}</p>
        <button
          type='button'
          onClick={() => {
            setRetryCount((c) => {
              return c + 1;
            });
          }}
          className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <RefreshCw className='size-3.5' />
          Retry
        </button>
      </div>
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
