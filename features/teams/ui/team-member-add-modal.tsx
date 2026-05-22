import TeamMemberAddForm from '@/features/teams/ui/team-member-add-form';
import ModalBody from '@/shared/ui/modal/modal-body';
import ModalHeader from '@/shared/ui/modal/modal-header';

import type { ModalContextValue } from '@/shared/types/modal';

interface Props extends ModalContextValue {
  teamId: number;
}

/**
 * TeamMemberAddModal component.
 * @param props - Component props.
 * @param props.close
 * @param props.teamId
 */
export default function TeamMemberAddModal({ close, teamId }: Props) {
  return (
    <>
      <ModalHeader onClick={close} title={'Add member'} />
      <ModalBody>
        <p className={'text-[20px] mb-5'}>
          An invitation will be sent to the email address provided. The employee
          will need to sign in or create an account using this email to join the
          team
        </p>

        <TeamMemberAddForm close={close} teamId={teamId} />
      </ModalBody>
    </>
  );
}
