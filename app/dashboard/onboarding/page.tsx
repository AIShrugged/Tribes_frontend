import { redirect } from 'next/navigation';

import { ROUTES } from '@/shared/lib/routes';

export const metadata = { title: 'Onboarding' };

export default function OnboardingPage() {
  redirect(ROUTES.ONBOARDING);
}
