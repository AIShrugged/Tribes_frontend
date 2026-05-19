import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ROUTES } from '@/shared/lib/routes';

/**
 * Clears the auth session cookies and redirects to the login page.
 * Called by httpClient on any 401 response.
 */
export async function GET() {
  const cookieStore = await cookies();

  cookieStore.delete('token');
  cookieStore.delete('organization_id');

  return NextResponse.redirect(
    new URL(
      ROUTES.AUTH.LOGIN,
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8080',
    ),
  );
}
