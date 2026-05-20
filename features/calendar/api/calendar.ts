'use server';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

export async function attachCalendar(organizationId: number): Promise<string> {
  try {
    const { data } = await httpClient<{ redirect: string }>(
      `${API_URL}/google/oauth`,
      {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!data?.redirect) {
      throw new Error('Failed to connect Google Calendar. Please try again.');
    }

    return data.redirect;
  } catch (error) {
    if (error instanceof ServerError) {
      let errorCode: string | undefined;

      try {
        const json = JSON.parse(error.responseBody ?? '') as {
          meta?: { error_code?: string };
        };

        errorCode = json.meta?.error_code;
      } catch {
        // Non-JSON body (e.g. HTML 5xx) — ignore
      }

      if (errorCode === 'SOURCE_ALREADY_EXISTS') {
        throw new Error(
          'Google Calendar is already connected to your account.',
        );
      }

      throw new Error('Failed to connect Google Calendar. Please try again.');
    }

    throw error;
  }
}
