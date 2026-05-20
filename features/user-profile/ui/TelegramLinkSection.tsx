'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { unlinkIdentity } from '@/features/user-profile/api/identities';
import { generateTelegramLink } from '@/features/user-profile/api/telegram-link';
import { useTelegramLinkPoll } from '@/features/user-profile/hooks/use-telegram-link-poll';
import { Button } from '@/shared/ui/button/Button';

import type { ProfileIdentity } from '@/entities/user';
import type { TelegramLinkData } from '@/features/user-profile/model/types';

type LinkState = 'idle' | 'awaiting' | 'connected' | 'expired';

const ALLOWED_TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

function validateTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_TELEGRAM_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function formatMmSs(ms: number): string {
  if (!Number.isFinite(ms)) return '00:00';
  const clamped = Math.max(0, ms);
  const m = Math.floor(clamped / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MILESTONE_MESSAGES: Record<number, string> = {
  300: '5 minutes remaining to connect Telegram.',
  60: '1 minute remaining to connect Telegram.',
  30: '30 seconds remaining to connect Telegram.',
};

export function TelegramLinkSection({
  initialTelegramIdentity,
}: {
  initialTelegramIdentity: ProfileIdentity | null;
}) {
  const [state, setStateInternal] = useState<LinkState>(
    initialTelegramIdentity ? 'connected' : 'idle',
  );
  const [identity, setIdentity] = useState<ProfileIdentity | null>(
    initialTelegramIdentity,
  );
  const [linkData, setLinkData] = useState<TelegramLinkData | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const stateRef = useRef<LinkState>(initialTelegramIdentity ? 'connected' : 'idle');

  const transition = useCallback((next: LinkState) => {
    stateRef.current = next;
    setStateInternal(next);
  }, []);

  const handleLinked = useCallback(
    (linked: ProfileIdentity) => {
      setIdentity(linked);
      transition('connected');
      setStatusMessage('Telegram account successfully connected.');
    },
    [transition],
  );

  useTelegramLinkPoll(state === 'awaiting', handleLinked);

  useEffect(() => {
    if (state !== 'awaiting' || !linkData) return;

    const expiresAt = new Date(linkData.expires_at).getTime();

    function tick() {
      if (stateRef.current !== 'awaiting') return;

      if (!Number.isFinite(expiresAt)) {
        transition('expired');
        setStatusMessage('Link has expired. Request a new one.');
        return;
      }

      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setRemainingMs(0);
        transition('expired');
        setStatusMessage('Link has expired. Request a new one.');
        return;
      }
      setRemainingMs(remaining);

      const secs = Math.floor(remaining / 1000);
      const milestone = MILESTONE_MESSAGES[secs];
      if (milestone) setStatusMessage(milestone);
    }

    const intervalId = setInterval(tick, 1000);
    tick();

    return () => {return clearInterval(intervalId)};
  }, [state, linkData, transition]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateTelegramLink();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLinkData(result.data);
      setStatusMessage('Telegram link generated. Open Telegram to complete linking.');
      transition('awaiting');
    });
  }

  function handleUnlink() {
    if (!identity) return;
    startTransition(async () => {
      const result = await unlinkIdentity(identity.id);
      if (result.error) {
        toast.error(result.error);
        if (result.error.includes('already unlinked')) {
          setIdentity(null);
          transition('idle');
        }
        return;
      }
      setIdentity(null);
      setLinkData(null);
      transition('idle');
      toast.success('Telegram account disconnected.');
    });
  }

  function handleCopy() {
    if (!linkData) return;
    navigator.clipboard.writeText(linkData.link_url).catch(() => {
      toast.error('Could not copy to clipboard');
    });
  }

  const isUrgent = remainingMs > 0 && remainingMs <= 60_000;

  if (state === 'connected' && identity) {
    return (
      <div className='space-y-4'>
        <div>
          <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
          <p className='text-sm text-[var(--muted-foreground)] mt-0.5'>
            Your personal Telegram account is linked.
          </p>
        </div>
        <div className='flex items-center justify-between gap-4 p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--secondary)]'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='text-green-500 text-sm shrink-0'>✓</span>
            <div className='min-w-0'>
              <p className='text-sm font-medium text-[var(--foreground)]'>Telegram Connected</p>
              <p className='text-xs text-[var(--muted-foreground)] truncate'>
                Account ID: {identity.channel_identifier}
              </p>
            </div>
          </div>
          <Button
            variant='secondary'
            size='sm'
            fullWidth={false}
            loading={isPending}
            loadingText='Disconnecting…'
            onClick={handleUnlink}
            disabled={isPending}
          >
            Disconnect
          </Button>
        </div>
        <div aria-live='assertive' aria-atomic='true' className='sr-only'>
          {statusMessage}
        </div>
      </div>
    );
  }

  if (state === 'awaiting') {
    if (!linkData) {
      return (
        <div className='space-y-2'>
          <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
          <p className='text-sm text-[var(--muted-foreground)]'>Generating link…</p>
        </div>
      );
    }

    if (!validateTelegramUrl(linkData.link_url)) {
      return (
        <div className='space-y-4'>
          <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
          <div
            role='alert'
            className='p-3 rounded-[var(--radius)] border border-destructive/50 bg-destructive/10 text-sm text-destructive'
          >
            Invalid link received from server.{' '}
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className='underline disabled:opacity-50'
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className='space-y-4'>
        <div>
          <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
          <p className='text-sm text-[var(--muted-foreground)] mt-0.5'>
            Open the link in Telegram to complete linking. The bot will confirm automatically.
          </p>
        </div>
        <div className='p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--secondary)] space-y-3'>
          <div className='flex items-center gap-2'>
            <a
              href={linkData.link_url}
              target='_blank'
              rel='noopener noreferrer'
              aria-label='Open Telegram to complete account linking'
              className='flex-1 text-center text-sm font-medium h-9 px-5 py-2 rounded-[var(--radius-button)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity'
            >
              Open in Telegram
            </a>
            <button
              onClick={handleCopy}
              className='text-sm h-9 px-3 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors shrink-0'
            >
              Copy link
            </button>
          </div>
          <div className='flex items-center justify-between text-sm text-[var(--muted-foreground)]'>
            <span>Waiting for confirmation…</span>
            <div
              role='timer'
              aria-atomic='true'
              aria-label='Link expiry countdown'
              className={`font-mono tabular-nums${isUrgent ? ' text-destructive font-medium' : ''}`}
            >
              {formatMmSs(remainingMs)}
            </div>
          </div>
        </div>
        <div aria-live='polite' aria-atomic='true' className='sr-only'>
          {statusMessage}
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className='space-y-4'>
        <div>
          <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
          <p className='text-sm text-[var(--muted-foreground)] mt-0.5'>
            Connect your personal Telegram account.
          </p>
        </div>
        <div
          role='alert'
          className='p-3 rounded-[var(--radius)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]'
        >
          The link has expired.
        </div>
        <div className='w-auto'>
          <Button
            variant='secondary'
            size='sm'
            fullWidth={false}
            loading={isPending}
            loadingText='Generating…'
            onClick={handleGenerate}
            disabled={isPending}
          >
            Get new link
          </Button>
        </div>
        <div aria-live='assertive' aria-atomic='true' className='sr-only'>
          {statusMessage}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-sm font-medium text-[var(--foreground)]'>Telegram</p>
        <p className='text-sm text-[var(--muted-foreground)] mt-0.5'>
          Connect your personal Telegram account to receive notifications and interact with Tribes via Telegram.
        </p>
      </div>
      <div className='w-auto'>
        <Button
          variant='primary'
          size='sm'
          fullWidth={false}
          loading={isPending}
          loadingText='Generating link…'
          onClick={handleGenerate}
          disabled={isPending}
        >
          Connect Telegram
        </Button>
      </div>
    </div>
  );
}
