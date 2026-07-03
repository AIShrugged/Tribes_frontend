'use client';

import { AlertTriangle, KeyRound, RotateCcw } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  disableBrainInstance,
  enableBrainInstance,
} from '@/features/brain/api/instances';
import { useBrainInstancePoll } from '@/features/brain/hooks/use-brain-instance-poll';
import { formatDateTime } from '@/features/brain/lib/format';
import {
  claudeAuthTypeLabel,
  isTransitionalStatus,
} from '@/features/brain/lib/instance-status';
import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal/modal';

import { BrainCredentialForm } from './brain-credential-form';
import { BrainInstanceStatusBadge } from './brain-instance-status-badge';

import type {
  EnableBrainPayload,
  SecondBrainInstance,
} from '@/features/brain/model/types';

type FormMode = 'hidden' | 'enable' | 'rotate';

interface Props {
  instance: SecondBrainInstance;
  organizationName: string;
}

/**
 * One managed organization's second-brain control: status badge, on/off toggle,
 * credential form (first enable + rotation), error/retry, and a disable confirm.
 * Enable/disable are async — the card polls until the status stabilizes.
 * @param props - Component props.
 * @param props.instance - the initial instance snapshot.
 * @param props.organizationName - display name of the organization.
 */
export function BrainInstanceCard({
  instance: initialInstance,
  organizationName,
}: Props) {
  const [instance, setInstance] = useState(initialInstance);
  const [formMode, setFormMode] = useState<FormMode>('hidden');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchId = useId();

  useBrainInstancePoll(instance, setInstance);

  const { status } = instance;
  const transitional = isTransitionalStatus(status);
  const hasCredential = instance.claude_auth_type !== null;
  const busy = isPending || transitional;

  const reEnable = () => {
    startTransition(async () => {
      const result = await enableBrainInstance(instance.organization_id, {});

      if (result.error !== null) {
        toast.error(result.error);

        return;
      }

      setInstance(result.data);
      toast.success('Включаем «второй мозг»…');
    });
  };

  const handleToggle = (next: boolean) => {
    if (busy) return;

    if (next) {
      if (hasCredential) {
        reEnable();
      } else {
        setFormMode('enable');
      }

      return;
    }

    setConfirmOpen(true);
  };

  const handleDisable = () => {
    startTransition(async () => {
      const result = await disableBrainInstance(instance.organization_id);

      if (result.error !== null) {
        toast.error(result.error);

        return;
      }

      setInstance(result.data);
      setConfirmOpen(false);
      toast.success('Выключаем «второй мозг»…');
    });
  };

  const handleCredentialSubmit = async (payload: EnableBrainPayload) => {
    const result = await enableBrainInstance(instance.organization_id, payload);

    if (result.error !== null) {
      toast.error(result.error);

      return { fieldErrors: result.fieldErrors };
    }

    setInstance(result.data);
    setFormMode('hidden');
    toast.success(
      formMode === 'rotate'
        ? 'Доступ к Claude обновлён'
        : 'Включаем «второй мозг»…',
    );
  };

  const handleRetry = () => {
    if (hasCredential) {
      reEnable();
    } else {
      setFormMode('enable');
    }
  };

  return (
    <div className='flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--divider)] bg-[var(--surface)] p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2 font-medium text-[var(--foreground)]'>
          <KeyRound
            className='h-4 w-4 text-[var(--muted-foreground)]'
            aria-hidden='true'
          />
          {organizationName}
        </div>
        <BrainInstanceStatusBadge status={status} />
      </div>

      <div className='flex items-center justify-between gap-4'>
        <label
          htmlFor={switchId}
          className='flex flex-col gap-0.5 text-sm text-[var(--foreground)]'
        >
          Второй мозг
          <span className='text-xs text-[var(--muted-foreground)]'>
            {instance.enabled
              ? 'Работает для этой организации'
              : 'Включите, чтобы «второй мозг» помогал этой организации'}
          </span>
        </label>
        <Switch
          id={switchId}
          checked={instance.enabled}
          loading={busy}
          disabled={formMode !== 'hidden'}
          onCheckedChange={handleToggle}
        />
      </div>

      {status === 'error' && instance.last_error && (
        <div
          role='alert'
          className='flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-3'
        >
          <div className='flex items-start gap-2 text-sm text-[var(--danger)]'>
            <AlertTriangle
              className='mt-0.5 h-4 w-4 shrink-0'
              aria-hidden='true'
            />
            <span>{instance.last_error}</span>
          </div>
          <div>
            <Button
              type='button'
              variant={BUTTON_VARIANT.secondary}
              size={BUTTON_SIZE.sm}
              fullWidth={false}
              loading={isPending}
              leftIcon={<RotateCcw className='h-4 w-4' aria-hidden='true' />}
              onClick={handleRetry}
            >
              Повторить
            </Button>
          </div>
        </div>
      )}

      {hasCredential && (
        <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs'>
          <dt className='text-[var(--muted-foreground)]'>Доступ к Claude</dt>
          <dd className='text-[var(--foreground)]'>
            {claudeAuthTypeLabel(instance.claude_auth_type)}
          </dd>
          {instance.last_started_at && (
            <>
              <dt className='text-[var(--muted-foreground)]'>Включён</dt>
              <dd className='text-[var(--foreground)]'>
                {formatDateTime(instance.last_started_at)}
              </dd>
            </>
          )}
        </dl>
      )}

      {formMode !== 'hidden' && (
        <BrainCredentialForm
          defaultAuthType={
            formMode === 'rotate' ? instance.claude_auth_type : undefined
          }
          submitLabel={formMode === 'rotate' ? 'Сохранить' : 'Включить'}
          onSubmit={handleCredentialSubmit}
          onCancel={() => {
            setFormMode('hidden');
          }}
        />
      )}

      {status === 'running' && formMode === 'hidden' && (
        <div>
          <Button
            type='button'
            variant={BUTTON_VARIANT.ghost}
            size={BUTTON_SIZE.sm}
            fullWidth={false}
            leftIcon={<KeyRound className='h-4 w-4' aria-hidden='true' />}
            onClick={() => {
              setFormMode('rotate');
            }}
          >
            Изменить доступ к Claude
          </Button>
        </div>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!isPending) setConfirmOpen(false);
        }}
        title='Выключить «второй мозг»?'
      >
        <div className='flex flex-col gap-4'>
          <p className='text-sm text-[var(--muted-foreground)]'>
            «Второй мозг» перестанет помогать организации{' '}
            <span className='font-semibold text-[var(--foreground)]'>
              {organizationName}
            </span>
            . Доступ к Claude сохранится — можно быстро включить снова.
          </p>
          <div className='flex flex-col gap-2 pt-1'>
            <Button
              type='button'
              variant={BUTTON_VARIANT.danger}
              loading={isPending}
              loadingText='Выключаем…'
              onClick={handleDisable}
            >
              Выключить
            </Button>
            <Button
              type='button'
              variant={BUTTON_VARIANT.secondary}
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
