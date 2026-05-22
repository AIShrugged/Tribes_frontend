'use client';

import { Pencil, Plus } from 'lucide-react';

import TeamCreateForm from '@/features/teams/ui/team-create-form';
import { useModal } from '@/shared/hooks/use-modal';
import { ROUTES } from '@/shared/lib/routes';
import { ButtonLink } from '@/shared/ui/button';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import ModalBody from '@/shared/ui/modal/modal-body';
import ModalHeader from '@/shared/ui/modal/modal-header';

import type { TeamProps } from '@/entities/team';

interface TeamsHeaderProps {
  teams: TeamProps[];
  selectedTeamId: number;
  onTeamChange: (id: number) => void;
  organizationId?: string;
}

/**
 * TeamsHeader — team selector dropdown, rename button, and "New Team" link.
 */
export default function TeamsHeader({
  teams,
  selectedTeamId,
  onTeamChange,
  organizationId = '',
}: TeamsHeaderProps) {
  const options = teams.map((t) => {
    return { value: String(t.id), label: t.name };
  });

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const { open, close } = useModal();

  const handleRename = () => {
    if (!selectedTeam || !open) return;
    open(
      <>
        <ModalHeader onClick={close} title='Rename team' />
        <ModalBody>
          <TeamCreateForm
            values={selectedTeam}
            organization_id={organizationId}
            onSuccess={() => { close(); }}
          />
        </ModalBody>
      </>,
    );
  };

  return (
    <div className='flex items-center gap-3 px-4 py-2 border-b border-border'>
      <div className='w-56 flex-shrink-0'>
        <InputDropdown
          options={options}
          value={String(selectedTeamId)}
          onChange={(val) => {
            onTeamChange(Number(val));
          }}
          placeholder='Select team'
          searchable={options.length > 5}
        />
      </div>

      {selectedTeam && (
        <button
          type='button'
          onClick={handleRename}
          aria-label='Rename team'
          className='text-muted-foreground hover:text-foreground transition-colors'
        >
          <Pencil className='size-4' />
        </button>
      )}

      <ButtonLink
        href={ROUTES.DASHBOARD.TEAMS_CREATE}
        size='xs'
        className='ml-auto'
        leftIcon={<Plus className='size-3.5' />}
      >
        New
      </ButtonLink>
    </div>
  );
}
