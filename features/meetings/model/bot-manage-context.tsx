'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';

export interface BotOrgOption {
  id: number;
  name: string;
}

export interface BotManageContextValue {
  /**
   * Authenticated user's id, or null when unknown. Used to gate the bot toggle
   * to the meeting creator (`creator_user_id === currentUserId`).
   */
  currentUserId: number | null;
  /**
   * Organizations the user belongs to — options for the "connect the bot from…"
   * picker shown before enabling. When exactly one, the toggle uses it silently.
   */
  organizations: BotOrgOption[];
}

const BotManageContext = createContext<BotManageContextValue>({
  currentUserId: null,
  organizations: [],
});

/**
 * Provides the data the bot toggle needs (current user id + org options) to any
 * in-tree consumer, so it does not have to be drilled through every meeting list
 * / calendar component. Mounted once in the dashboard layout.
 *
 * NOTE: components rendered in the modal portal (e.g. EventPopup) live outside
 * this provider — they must receive `currentUserId`/`organizations` as explicit
 * props instead.
 */
export function BotManageProvider({
  value,
  children,
}: PropsWithChildren<{ value: BotManageContextValue }>) {
  return <BotManageContext value={value}>{children}</BotManageContext>;
}

export function useBotManage(): BotManageContextValue {
  return useContext(BotManageContext);
}
