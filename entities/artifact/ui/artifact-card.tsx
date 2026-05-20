'use client';

import {
  BarChart2,
  BookMarked,
  ClipboardList,
  FileText,
  ListChecks,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import React from 'react';

import { DecisionLog } from '@/entities/artifact/ui/decision-log';
import { InsightCard } from '@/entities/artifact/ui/insight-card';
import { MeetingCard } from '@/entities/artifact/ui/meeting-card';
import { MethodologyCriteriaArtifactView } from '@/entities/artifact/ui/methodology-criteria-artifact';
import { PeopleList } from '@/entities/artifact/ui/people-list';
import { TaskTable } from '@/entities/artifact/ui/task-table';
import { TranscriptView } from '@/entities/artifact/ui/transcript-view';
import { Skeleton } from '@/shared/ui/layout/skeleton';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type {
  Artifact,
  ArtifactType,
  ChartArtifact,
  DecisionLogArtifact,
  InsightCardArtifact,
  MeetingCardArtifact,
  MethodologyCriteriaArtifact,
  PeopleListArtifact,
  TaskTableArtifact,
  TranscriptArtifact,
} from '@/entities/artifact/model/types';

// Recharts uses browser APIs (ResizeObserver) — defer to client
const ChartArtifactView = dynamic(
  () => {
    return import('@/entities/artifact/ui/chart-artifact').then((m) => {
      return { default: m.ChartArtifactView };
    });
  },
  {
    ssr: false,
    loading: () => {
      return <Skeleton className='h-40 rounded-md' />;
    },
  },
);

const TYPE_META: Record<
  ArtifactType,
  { label: string; icon: React.ReactNode }
> = {
  task_table: {
    label: 'Tasks',
    icon: <ClipboardList className='w-3.5 h-3.5' />,
  },
  meeting_card: {
    label: 'Meeting',
    icon: <Video className='w-3.5 h-3.5' />,
  },
  people_list: {
    label: 'People',
    icon: <Users className='w-3.5 h-3.5' />,
  },
  insight_card: {
    label: 'Insight',
    icon: <Zap className='w-3.5 h-3.5' />,
  },
  chart: {
    label: 'Chart',
    icon: <BarChart2 className='w-3.5 h-3.5' />,
  },
  transcript_view: {
    label: 'Transcript',
    icon: <FileText className='w-3.5 h-3.5' />,
  },
  decision_log: {
    label: 'Decisions',
    icon: <BookMarked className='w-3.5 h-3.5' />,
  },
  methodology_criteria: {
    label: 'Methodology',
    icon: <ListChecks className='w-3.5 h-3.5' />,
  },
};

const ARTIFACT_RENDERERS: {
  [K in ArtifactType]: (
    artifact: Extract<Artifact, { type: K }>,
  ) => React.ReactNode;
} = {
  task_table: (a: TaskTableArtifact) => {
    return <TaskTable data={a.data} />;
  },
  meeting_card: (a: MeetingCardArtifact) => {
    return <MeetingCard data={a.data} />;
  },
  people_list: (a: PeopleListArtifact) => {
    return <PeopleList data={a.data} />;
  },
  insight_card: (a: InsightCardArtifact) => {
    return <InsightCard data={a.data} />;
  },
  chart: (a: ChartArtifact) => {
    return <ChartArtifactView data={a.data} />;
  },
  transcript_view: (a: TranscriptArtifact) => {
    return <TranscriptView data={a.data} />;
  },
  decision_log: (a: DecisionLogArtifact) => {
    return <DecisionLog data={a.data} />;
  },
  methodology_criteria: (a: MethodologyCriteriaArtifact) => {
    return <MethodologyCriteriaArtifactView data={a.data} />;
  },
};

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  const renderer = ARTIFACT_RENDERERS[artifact.type] as
    | ((a: Artifact) => React.ReactNode)
    | undefined;

  if (!renderer) {
    return (
      <p className='text-xs text-muted-foreground py-4 text-center'>
        Unknown artifact type: {(artifact as Artifact & { type: string }).type}
      </p>
    );
  }

  return renderer(artifact);
}

// eslint-disable-next-line max-statements
export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const meta = TYPE_META[artifact.type] ?? { label: artifact.type, icon: null };
  const isGenerating = artifact.status === 'generating';
  const isFailed = artifact.status === 'failed';
  let statusClassName: string;

  if (isGenerating) {
    statusClassName = 'bg-amber-100 text-amber-700 animate-pulse';
  } else if (isFailed) {
    statusClassName = 'bg-destructive/10 text-destructive';
  } else {
    statusClassName = 'bg-primary/10 text-primary';
  }

  const nonGeneratingLabel = isFailed ? 'Failed' : meta.label;
  const statusLabel = isGenerating ? 'Generating…' : nonGeneratingLabel;
  let cardBody: React.ReactNode;

  if (isGenerating) {
    cardBody = (
      <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
        <SpinLoader size='sm' />
        Generating…
      </div>
    );
  } else if (isFailed) {
    cardBody = (
      <p className='text-sm text-destructive text-center py-4'>
        Failed to generate
      </p>
    );
  } else {
    cardBody = <ArtifactContent artifact={artifact} />;
  }

  return (
    <div className='bg-background border border-border rounded-[var(--radius-card)] overflow-hidden'>
      {/* Card header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-border/60'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-muted-foreground flex-shrink-0'>
            {meta.icon}
          </span>
          <span className='text-sm font-semibold text-foreground truncate'>
            {artifact.title}
          </span>
        </div>
        <span
          className={`flex-shrink-0 ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusClassName}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Card body */}
      <div className='px-4 py-3'>{cardBody}</div>
    </div>
  );
}
