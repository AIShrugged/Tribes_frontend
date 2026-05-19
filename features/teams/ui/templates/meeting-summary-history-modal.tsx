'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  listMeetingSummaryTemplateVersions,
  restoreMeetingSummaryTemplateVersion,
} from '@/features/teams/api/meeting-summary-template';
import { Modal } from '@/shared/ui/modal';

import type {
  MeetingSummaryTemplate,
  MeetingSummaryTemplateVersion,
} from '@/features/teams/model/types';

interface Props {
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
  onRestored: (template: MeetingSummaryTemplate) => void;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}

export function MeetingSummaryHistoryModal({
  teamId,
  isOpen,
  onClose,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<MeetingSummaryTemplateVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listMeetingSummaryTemplateVersions(teamId)
      .then(setVersions)
      .catch(() => {
        return toast.error('Failed to load template history');
      })
      .finally(() => {
        return setIsLoading(false);
      });
  }, [isOpen, teamId]);

  const handleRestore = (version: number) => {
    setRestoringVersion(version);
    startTransition(async () => {
      const result = await restoreMeetingSummaryTemplateVersion(
        teamId,
        version,
      );
      setRestoringVersion(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        toast.success(`Restored from v${version}`);
        onRestored(result.data);
        onClose();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Meeting summary template history'
      size='lg'
    >
      {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

      {!isLoading && versions.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No previous versions yet. The first version is saved as soon as you
          make any change.
        </p>
      )}

      {!isLoading && versions.length > 0 && (
        <ol className='flex flex-col gap-4'>
          {versions.map((v) => {
            return (
              <li
                key={v.id}
                className='rounded-md border border-border bg-card p-4'
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-sm font-semibold text-foreground'>
                      Version {v.version}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      Replaced {formatDate(v.created_at)}
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      return handleRestore(v.version);
                    }}
                    disabled={restoringVersion !== null}
                    className='inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {restoringVersion === v.version ? 'Restoring…' : 'Restore'}
                  </button>
                </div>

                <div className='mt-3 flex flex-col gap-2'>
                  <div>
                    <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                      Sections
                    </span>
                    <p className='mt-0.5 text-xs text-foreground'>
                      {v.sections.join(' · ')}
                    </p>
                  </div>
                  {v.visible_sections !== null &&
                    v.visible_sections.length > 0 && (
                      <div>
                        <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                          Visible
                        </span>
                        <p className='mt-0.5 text-xs text-foreground'>
                          {v.visible_sections.join(' · ')}
                        </p>
                      </div>
                    )}
                  {v.prompt_override !== null && v.prompt_override !== '' && (
                    <div>
                      <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                        Prompt
                      </span>
                      <pre className='mt-0.5 max-h-40 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground'>
                        {v.prompt_override}
                      </pre>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
