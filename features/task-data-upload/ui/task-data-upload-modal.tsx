'use client';

import { useEffect, useState } from 'react';

import { getTeams } from '@/entities/team/api/team';
import { TaskDataUploadForm } from '@/features/task-data-upload/ui/task-data-upload-form';
import { Modal } from '@/shared/ui/modal/modal';

import type { TeamProps } from '@/entities/team';

export function TaskDataUploadModal({
  isOpen,
  onClose,
  organizationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string | null;
}) {
  const [teams, setTeams] = useState<TeamProps[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isLoading = isOpen && teams === null && loadError === null;

  useEffect(() => {
    if (!isOpen || teams !== null) return;

    let cancelled = false;

    const load = async () => {
      try {
        const teamsResult = organizationId
          ? await getTeams(organizationId)
          : { data: [] as TeamProps[] };
        if (cancelled) return;
        setTeams(teamsResult.data);
      } catch {
        if (cancelled) return;
        setLoadError('Failed to load data. Please try again.');
      }
    };

    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, teams, organizationId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title='Upload task data' size='md'>
      {isLoading && (
        <div className='p-6 text-center text-sm text-muted-foreground'>
          Loading…
        </div>
      )}
      {loadError && (
        <div className='p-6 text-center text-sm text-destructive'>
          {loadError}
        </div>
      )}
      {!isLoading && !loadError && teams !== null && (
        <TaskDataUploadForm teams={teams} onClose={onClose} />
      )}
    </Modal>
  );
}
