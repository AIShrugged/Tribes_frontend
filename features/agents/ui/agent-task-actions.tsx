'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  deleteAgentProfile,
  deleteAgentTask,
  dispatchAgentTask,
  updateAgentTask,
} from '@/features/agents/api/agents';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button, ButtonLink } from '@/shared/ui/button';

interface BaseProps {
  backHref: string;
}

export function AgentProfileActions({
  id,
  backHref,
}: BaseProps & { id: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div className='flex flex-wrap gap-3'>
      <ButtonLink href={backHref} variant='secondary'>
        Back to profiles
      </ButtonLink>
      <Button
        type='button'
        variant={BUTTON_VARIANT.danger}
        fullWidth={false}
        loading={isPending}
        onClick={() => {
          if (!isConfirmingDelete) {
            setIsConfirmingDelete(true);

            return;
          }

          startTransition(async () => {
            const result = await deleteAgentProfile(id);

            if (result.error) {
              toast.error(result.error);

              return;
            }

            toast.success('Agent profile deleted');
            router.push(backHref);
            router.refresh();
          });
        }}
      >
        {isConfirmingDelete ? 'Confirm delete' : 'Delete'}
      </Button>
      {isConfirmingDelete ? (
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          fullWidth={false}
          onClick={() => {
            setIsConfirmingDelete(false);
          }}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

export function AgentTaskActions({
  id,
  enabled,
  backHref,
}: BaseProps & {
  id: number;
  enabled: boolean;
}) {
  const router = useRouter();
  const [isDispatchPending, startDispatch] = useTransition();
  const [isTogglePending, startToggle] = useTransition();
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div className='flex flex-wrap gap-3'>
      <ButtonLink
        href={`${ROUTES.DASHBOARD.AGENT_TASKS}/${id}/config`}
        variant='secondary'
      >
        Edit
      </ButtonLink>
      <Button
        type='button'
        fullWidth={false}
        loading={isDispatchPending}
        onClick={() => {
          startDispatch(async () => {
            const result = await dispatchAgentTask(id);

            if (result.error !== null) {
              toast.error(result.error);

              return;
            }

            toast.success('Task dispatched');
            router.refresh();
          });
        }}
      >
        Run now
      </Button>
      <Button
        type='button'
        variant={BUTTON_VARIANT.secondary}
        fullWidth={false}
        loading={isTogglePending}
        onClick={() => {
          startToggle(async () => {
            const result = await updateAgentTask(id, { enabled: !enabled });

            if (result.error !== null) {
              toast.error(result.error);

              return;
            }

            toast.success(enabled ? 'Task disabled' : 'Task enabled');
            router.refresh();
          });
        }}
      >
        {enabled ? 'Disable' : 'Enable'}
      </Button>
      <Button
        type='button'
        variant={BUTTON_VARIANT.danger}
        fullWidth={false}
        loading={isDeletePending}
        onClick={() => {
          if (!isConfirmingDelete) {
            setIsConfirmingDelete(true);

            return;
          }

          setIsDeletePending(true);
          deleteAgentTask(id)
            .then((result) => {
              if (result.error) {
                toast.error(result.error);

                return;
              }

              toast.success('Agent task deleted');
              router.push(backHref);
              router.refresh();
            })
            .catch(() => {
              toast.error('Failed to delete agent task');
            })
            .finally(() => {
              setIsConfirmingDelete(false);
              setIsDeletePending(false);
            });
        }}
      >
        {isConfirmingDelete ? 'Confirm delete' : 'Delete'}
      </Button>
      {isConfirmingDelete ? (
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          fullWidth={false}
          onClick={() => {
            setIsConfirmingDelete(false);
          }}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
