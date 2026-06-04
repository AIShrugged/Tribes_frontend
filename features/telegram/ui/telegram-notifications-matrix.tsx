'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { NOTIFICATION_EVENT_TYPES } from '@/entities/team-notification-setting';
import {
  setEventMinutesBefore,
  syncChatNotifications,
} from '@/features/telegram/api/telegram-notifications';

import type {
  NotificationEventType,
  TeamNotificationSetting,
} from '@/entities/team-notification-setting';
import type { TelegramChatRegistration } from '@/entities/telegram';

const DEFAULT_MINUTES_BEFORE = 60;
const MIN_MINUTES_BEFORE = 5;
const MAX_MINUTES_BEFORE = 1440;

interface Props {
  teamId: number;
  settings: TeamNotificationSetting[];
  availableChats: TelegramChatRegistration[];
}

interface EventState {
  // Single recipient per event — null means "don't send" (no setting row).
  selectedChatId: number | null;
  minutesBefore: number | null;
}

function registrationId(setting: TeamNotificationSetting): number | null {
  return setting.notifiable?.data?.id ?? setting.notifiable?.id ?? null;
}

function deriveState(
  settings: TeamNotificationSetting[],
): Record<string, EventState> {
  const state: Record<string, EventState> = {};

  for (const event of NOTIFICATION_EVENT_TYPES) {
    const rows = settings.filter((s) => {
      return s.event_type === event.value && s.channel_type === 'telegram';
    });
    // Single-select: if legacy data has multiple recipients, show the first; the next
    // save collapses it to one.
    const selectedRow = rows.find((row) => {
      return registrationId(row) !== null;
    });

    state[event.value] = {
      selectedChatId: selectedRow ? registrationId(selectedRow) : null,
      minutesBefore: rows[0]?.minutes_before ?? null,
    };
  }

  return state;
}

function chatLabel(chat: TelegramChatRegistration): string {
  const base = chat.chat_title ?? `Chat #${chat.id}`;
  return chat.topic_title ? `${base} · ${chat.topic_title}` : base;
}

export function TelegramNotificationsMatrix({
  teamId,
  settings,
  availableChats,
}: Props) {
  const [state, setState] = useState<Record<string, EventState>>(() => {
    return deriveState(settings);
  });

  // Reconcile with the server's canonical state after each revalidate.
  useEffect(() => {
    setState(deriveState(settings));
  }, [settings]);

  const patchEvent = (eventValue: string, patch: Partial<EventState>) => {
    setState((prev) => {
      return { ...prev, [eventValue]: { ...prev[eventValue], ...patch } };
    });
  };

  const selectChat = async (event: NotificationEventType, rawValue: string) => {
    const chatId = rawValue === '' ? null : Number(rawValue);
    const previous = state[event.value].selectedChatId;

    patchEvent(event.value, { selectedChatId: chatId });

    const result = await syncChatNotifications(
      teamId,
      event.value,
      chatId === null ? [] : [chatId],
    );
    if (result.error) {
      patchEvent(event.value, { selectedChatId: previous });
      toast.error(result.error);
    }
  };

  const saveMinutes = async (
    event: NotificationEventType,
    raw: string,
  ): Promise<void> => {
    const value = raw === '' ? null : Number(raw);

    if (
      value !== null &&
      (Number.isNaN(value) ||
        value < MIN_MINUTES_BEFORE ||
        value > MAX_MINUTES_BEFORE)
    ) {
      toast.error(
        `Time must be between ${MIN_MINUTES_BEFORE} and ${MAX_MINUTES_BEFORE} min`,
      );
      return;
    }

    const previous = state[event.value].minutesBefore;
    patchEvent(event.value, { minutesBefore: value });

    const result = await setEventMinutesBefore(teamId, event.value, value);
    if (result.error) {
      patchEvent(event.value, { minutesBefore: previous });
      toast.error(result.error);
    } else {
      toast.success('Saved');
    }
  };

  return (
    <div className='flex flex-col gap-3'>
      <div>
        <h1 className='text-2xl font-semibold text-foreground'>
          Notifications
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Choose which notifications to send and to which chat. Chats come from
          the «Telegram chats» tab.
        </p>
      </div>

      {availableChats.length === 0 ? (
        <p className='rounded-[var(--radius-card)] border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground'>
          No linked chats. Add a chat in the «Telegram chats» tab to configure
          notifications.
        </p>
      ) : (
        NOTIFICATION_EVENT_TYPES.map((event) => {
          const eventState = state[event.value];
          const hasChat = eventState.selectedChatId !== null;

          return (
            <div
              key={event.value}
              className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4'
            >
              <div className='flex items-start gap-3 min-w-0'>
                <Bell className='mt-0.5 size-4 flex-shrink-0 text-muted-foreground' />
                <div className='min-w-0'>
                  <p className='text-sm font-medium text-foreground'>
                    {event.label}
                  </p>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    {event.description}
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-2 ps-7'>
                <label
                  className='text-xs text-muted-foreground'
                  htmlFor={`chat-${event.value}`}
                >
                  Chat:
                </label>
                <select
                  id={`chat-${event.value}`}
                  aria-label={`Chat for «${event.label}»`}
                  value={
                    eventState.selectedChatId === null
                      ? ''
                      : String(eventState.selectedChatId)
                  }
                  onChange={(e) => {
                    return selectChat(event, e.target.value);
                  }}
                  className='h-8 min-w-56 rounded-[var(--radius-button)] border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
                >
                  <option value=''>— Do not send —</option>
                  {availableChats.map((chat) => {
                    return (
                      <option key={chat.id} value={String(chat.id)}>
                        {chatLabel(chat)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {event.hasMinutesBefore && (
                <div className='flex items-center gap-2 ps-7'>
                  <label
                    className='text-xs text-muted-foreground'
                    htmlFor={`minutes-${event.value}`}
                  >
                    Minutes before the meeting:
                  </label>
                  <input
                    id={`minutes-${event.value}`}
                    type='number'
                    min={MIN_MINUTES_BEFORE}
                    max={MAX_MINUTES_BEFORE}
                    step={5}
                    disabled={!hasChat}
                    placeholder={String(
                      event.defaultMinutesBefore ?? DEFAULT_MINUTES_BEFORE,
                    )}
                    value={eventState.minutesBefore ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = v === '' ? null : Number(v);
                      patchEvent(event.value, {
                        minutesBefore: n !== null && Number.isNaN(n) ? null : n,
                      });
                    }}
                    onBlur={(e) => {
                      return saveMinutes(event, e.target.value);
                    }}
                    className='h-7 w-20 rounded-[var(--radius-button)] border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40'
                  />
                  <span className='text-xs text-muted-foreground'>
                    default{' '}
                    {event.defaultMinutesBefore ?? DEFAULT_MINUTES_BEFORE}
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
