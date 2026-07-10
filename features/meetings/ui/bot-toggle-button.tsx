'use client';

import { Bot, BotOff, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { switchBot } from '@/features/event/api/calendar-events';
import { Button } from '@/shared/ui/button';

import { useBotManage, type BotOrgOption } from '../model/bot-manage-context';

import { BotOrgPicker } from './bot-org-picker';

interface BotTriggerButtonProps {
  variant: 'pill' | 'block';
  added: boolean;
  disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function BotTriggerButton({
  variant,
  added,
  disabled,
  onClick,
}: BotTriggerButtonProps) {
  if (variant === 'block') {
    return (
      <Button
        onClick={onClick}
        disabled={disabled}
        loading={disabled}
        aria-label={added ? 'remove bot' : 'add bot'}
      >
        <div className='flex items-center gap-3'>
          {added ? <Minus size={24} /> : <Plus size={24} />}
          <span>{added ? 'remove bot' : 'add bot'}</span>
        </div>
      </Button>
    );
  }

  return (
    <Button
      variant='pill'
      size='xs'
      fullWidth={false}
      disabled={disabled}
      leftIcon={
        added ? <BotOff className='h-3 w-3' /> : <Bot className='h-3 w-3' />
      }
      onClick={onClick}
    >
      {added ? 'Remove bot' : 'Add bot'}
    </Button>
  );
}

interface BotToggleButtonProps {
  eventId: number;
  isBotAdded: boolean;
  /** Meeting creator id — only the creator may manage the bot. */
  creatorUserId: number;
  /**
   * Explicit overrides for consumers rendered outside the BotManageProvider tree
   * (e.g. EventPopup, which renders in the app-root modal portal). When omitted,
   * the values come from context.
   */
  currentUserId?: number | null;
  organizations?: BotOrgOption[];
  /** 'pill' for cards/popovers, 'block' for the full-width modal footer button. */
  variant?: 'pill' | 'block';
}

/**
 * BotToggleButton — enables/disables the recording bot for a calendar event.
 *
 * Only the meeting creator sees it. Enabling requires choosing which organization
 * the bot is connected from: with a single org it is applied silently, with
 * several a picker is shown first. Disabling clears the org binding.
 */
export function BotToggleButton({
  eventId,
  isBotAdded,
  creatorUserId,
  currentUserId: currentUserIdProp,
  organizations: organizationsProp,
  variant = 'pill',
}: BotToggleButtonProps) {
  const ctx = useBotManage();
  const currentUserId = currentUserIdProp ?? ctx.currentUserId;
  const organizations = organizationsProp ?? ctx.organizations;

  const [isPending, startTransition] = useTransition();
  const [optimisticBotAdded, setOptimisticBotAdded] = useState(isBotAdded);
  const [pickerOpen, setPickerOpen] = useState(false);
  const router = useRouter();

  // Only the organizer can manage the bot (backend enforces this too). A null
  // currentUserId never equals a numeric creatorUserId, so this also hides it
  // when the user is unknown.
  if (currentUserId !== creatorUserId) {
    return null;
  }

  const applyBot = (next: boolean, organizationId?: number) => {
    setOptimisticBotAdded(next);
    setPickerOpen(false);

    startTransition(async () => {
      const result = await switchBot(eventId, next, organizationId);

      if (result.error) {
        setOptimisticBotAdded(!next); // revert on error
        toast.error(result.error);

        return;
      }

      router.refresh();
    });
  };

  const handleToggle = () => {
    if (optimisticBotAdded) {
      applyBot(false);

      return;
    }

    // Enabling — the backend needs the org the bot is connected from.
    if (organizations.length === 0) {
      toast.error('Join an organization before enabling the bot.');

      return;
    }

    if (organizations.length === 1) {
      applyBot(true, organizations[0].id);

      return;
    }

    setPickerOpen((prev) => {
      return !prev;
    });
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggle();
  };

  return (
    <div className={variant === 'block' ? 'relative w-full' : 'relative'}>
      <BotTriggerButton
        variant={variant}
        added={optimisticBotAdded}
        disabled={isPending}
        onClick={handleTriggerClick}
      />
      {pickerOpen && (
        <BotOrgPicker
          organizations={organizations}
          direction={variant === 'block' ? 'up' : 'down'}
          disabled={isPending}
          onSelect={(orgId) => {
            return applyBot(true, orgId);
          }}
          onClose={() => {
            return setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
