import { format } from 'date-fns';

import { parseEventDate } from '@/shared/lib/dateFormatter';

export function formatOnboardingDate(onboardedAt: string): string {
  return format(parseEventDate(onboardedAt), 'dd.MM.yyyy HH:mm');
}

export function getOnboardingStatusText(onboardedAt?: string | null): string {
  if (!onboardedAt) return 'Онбординг ещё не проводился';

  try {
    return `Последний онбординг: ${formatOnboardingDate(onboardedAt)}`;
  } catch {
    return `Последний онбординг: ${onboardedAt}`;
  }
}

export function getOnboardingActionLabel(onboardedAt?: string | null): string {
  return onboardedAt ? 'Обновить онбординг' : 'Провести онбординг';
}
