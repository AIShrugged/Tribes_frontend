import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React, { type PropsWithChildren, Suspense } from 'react';

import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { MenuSidebar, SidebarFooter } from '@/features/menu';
import { OrganizationSelector, getOrganization } from '@/features/organization';
import { User, getUser } from '@/features/user';
import { updateThemePreference } from '@/features/user-profile/api/preferences';
import { ROUTES } from '@/shared/lib/routes';
import { TribesLogo } from '@/shared/ui/brand';
import {
  DashboardChatColumn,
  DashboardChatLoader,
  MobileChatDrawerLoader,
} from '@/widgets/dashboard-chat';
import MobileSidebar from '@/widgets/layout/ui/mobile-sidebar';

import type { Theme } from '@/entities/user';

export default async function Layout({ children }: PropsWithChildren) {
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get('tribes-theme')?.value;
  const theme: Theme =
    rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : 'dark';

  const isOnboarded = cookieStore.get('org_onboarded')?.value === '1';
  const orgIdFromCookie = cookieStore.get('organization_id')?.value;
  const skippedOrgId = cookieStore.get('onboarding_skipped')?.value;
  const hasSkipped =
    skippedOrgId !== undefined && skippedOrgId === orgIdFromCookie;

  if (!isOnboarded && !hasSkipped && orgIdFromCookie) {
    const { data: org } = await getOrganization(orgIdFromCookie);

    if (!org?.onboarded_at) {
      redirect(ROUTES.ONBOARDING);
    }
  }

  let showOnboardingCta = false;

  if (!isOnboarded && hasSkipped && orgIdFromCookie) {
    try {
      const { data: ctaOrg } = await getOrganization(orgIdFromCookie);

      showOnboardingCta = !ctaOrg?.onboarded_at;
    } catch {
      // silently skip — do not block layout render
    }
  }

  const { data: user } = await getUser();

  return (
    <ThemeProvider initialTheme={theme}>
      <div className='flex h-screen overflow-hidden bg-background'>
        {/* Desktop sidebar — hidden below lg */}
        <aside
          className='hidden lg:flex flex-col sidebar-width flex-shrink-0 border-r relative z-10'
          style={{
            background: 'var(--chrome-bg)',
            borderColor: 'var(--chrome-border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo slot */}
          <div
            className='flex items-center h-[var(--topbar-height)] px-6 flex-shrink-0'
            style={{ borderBottom: '1px solid var(--chrome-border)' }}
          >
            <TribesLogo />
          </div>
          {/* Navigation */}
          <div className='flex-1 overflow-y-auto py-3 px-3'>
            <MenuSidebar />
          </div>
          {/* Sidebar footer */}
          <div
            className='flex-shrink-0 px-3 py-3'
            style={{ borderTop: '1px solid var(--chrome-border)' }}
          >
            <SidebarFooter
              currentPreferences={user?.preferences ?? {}}
              onThemeChange={updateThemePreference}
            />
          </div>
        </aside>

        {/* Main area */}
        <div className='flex flex-col flex-1 min-w-0 relative z-10'>
          {/* Top bar */}
          <header
            className='flex items-center justify-between h-[var(--topbar-height)] px-4 flex-shrink-0 relative z-20'
            style={{
              background: 'var(--chrome-bg-header)',
              borderBottom: '1px solid var(--chrome-border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className='flex items-center gap-2 min-w-0 flex-1'>
              {/* Mobile sidebar trigger — visible below lg */}
              <MobileSidebar>
                <MenuSidebar />
              </MobileSidebar>
              <OrganizationSelector />
            </div>
            <div className='flex items-center gap-2 flex-shrink-0'>
              {showOnboardingCta && (
                <Link
                  href={ROUTES.DASHBOARD.PROFILE_ONBOARDING}
                  className='inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-violet-500/50 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition-colors flex-shrink-0'
                >
                  Setup org
                </Link>
              )}
              <User />
            </div>
          </header>

          {/* Scrollable content */}
          <main className='flex-1 overflow-y-auto p-2 min-h-0'>{children}</main>
        </div>

        {/* Chat panel — third column, hidden on xl- screens and /dashboard/chat */}
        <DashboardChatColumn>
          <DashboardChatLoader />
        </DashboardChatColumn>
      </div>

      {/* Mobile chat FAB + bottom-sheet drawer — parallel stream, never blocks page render */}
      <Suspense fallback={null}>
        <MobileChatDrawerLoader />
      </Suspense>
    </ThemeProvider>
  );
}
