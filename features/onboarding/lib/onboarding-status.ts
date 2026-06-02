import { format } from 'date-fns';

import { parseEventDate } from '@/shared/lib/dateFormatter';

export function formatOnboardingDate(onboardedAt: string): string {
  return format(parseEventDate(onboardedAt), 'dd.MM.yyyy HH:mm');
}

export function getOnboardingStatusText(onboardedAt?: string | null): string {
  if (!onboardedAt) return 'Onboarding has not been run yet';

  try {
    return `Last onboarding: ${formatOnboardingDate(onboardedAt)}`;
  } catch {
    return `Last onboarding: ${onboardedAt}`;
  }
}

export function getOnboardingActionLabel(onboardedAt?: string | null): string {
  return onboardedAt ? 'Update onboarding' : 'Run onboarding';
}
