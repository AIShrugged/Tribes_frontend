'use client';

import { Bot, BotOff, ChevronDown, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { switchBot } from '@/features/event/api/calendar-events';
import { Button } from '@/shared/ui/button';

import { useBotManage, type BotOrgOption } from '../model/bot-manage-context';

import { BotOrgPicker } from './bot-org-picker';
import { BotScopeMenu, type BotScope } from './bot-scope-menu';

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
 * Only the meeting creator sees it. The main button toggles the bot for this
 * meeting; the caret opens a scope menu to apply the change to the whole recurring
 * series (every future occurrence sharing the meeting link). Enabling requires
 * choosing which organization the bot is connected from: with a single org it is
 * applied silently, with several a picker is shown first. Disabling clears the org
 * binding.
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
  const [menu, setMenu] = useState<'none' | 'scope' | 'org'>('none');
  const [pendingScope, setPendingScope] = useState<BotScope>('single');
  const router = useRouter();

  // Only the organizer can manage the bot (backend enforces this too). A null
  // currentUserId never equals a numeric creatorUserId, so this also hides it
  // when the user is unknown.
  if (currentUserId !== creatorUserId) {
    return null;
  }

  const menuDirection = variant === 'block' ? 'up' : 'down';

  const applyBot = (
    next: boolean,
    scope: BotScope,
    organizationId?: number,
  ) => {
    setOptimisticBotAdded(next);
    setMenu('none');

    startTransition(async () => {
      const result = await switchBot(eventId, next, organizationId, scope);

      if (result.error) {
        setOptimisticBotAdded(!next); // revert on error
        toast.error(result.error);

        return;
      }

      router.refresh();
    });
  };

  // Resolve a toggle for the given scope: disabling applies immediately; enabling
  // needs the organization the bot is connected from (silent for one org, picker
  // for several).
  const beginToggle = (scope: BotScope) => {
    const next = !optimisticBotAdded;

    if (!next) {
      applyBot(false, scope);

      return;
    }

    if (organizations.length === 0) {
      toast.error('Join an organization before enabling the bot.');
      setMenu('none');

      return;
    }

    if (organizations.length === 1) {
      applyBot(true, scope, organizations[0].id);

      return;
    }

    setPendingScope(scope);
    setMenu('org');
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    beginToggle('single');
  };

  const handleCaretClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenu((prev) => {
      return prev === 'scope' ? 'none' : 'scope';
    });
  };

  return (
    <div className={variant === 'block' ? 'relative w-full' : 'relative'}>
      <div className='flex items-stretch gap-1'>
        <div className={variant === 'block' ? 'flex-1' : ''}>
          <BotTriggerButton
            variant={variant}
            added={optimisticBotAdded}
            disabled={isPending}
            onClick={handleTriggerClick}
          />
        </div>
        <button
          type='button'
          aria-label='Apply bot to the whole series'
          aria-haspopup='menu'
          aria-expanded={menu === 'scope'}
          disabled={isPending}
          onClick={handleCaretClick}
          className='inline-flex items-center justify-center self-stretch rounded-full border border-border px-2 text-muted-foreground transition-colors hover:bg-white/5 disabled:opacity-50'
        >
          <ChevronDown className='h-3.5 w-3.5' />
        </button>
      </div>

      {menu === 'scope' && (
        <BotScopeMenu
          added={optimisticBotAdded}
          direction={menuDirection}
          disabled={isPending}
          onSelect={(scope) => {
            return beginToggle(scope);
          }}
          onClose={() => {
            return setMenu('none');
          }}
        />
      )}

      {menu === 'org' && (
        <BotOrgPicker
          organizations={organizations}
          direction={menuDirection}
          disabled={isPending}
          onSelect={(orgId) => {
            return applyBot(true, pendingScope, orgId);
          }}
          onClose={() => {
            return setMenu('none');
          }}
        />
      )}
    </div>
  );
}
