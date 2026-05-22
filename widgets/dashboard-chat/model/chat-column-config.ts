export const CHAT_COLUMN_HIDDEN_PATHS = ['/dashboard/chat'] as const;

export function isChatColumnHidden(pathname: string) {
  return CHAT_COLUMN_HIDDEN_PATHS.some(
    (p) => {return pathname === p || pathname.startsWith(`${p}/`)},
  );
}
