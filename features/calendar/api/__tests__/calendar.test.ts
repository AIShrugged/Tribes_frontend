import { attachCalendar } from '@/features/calendar/api/calendar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/shared/lib/config', () => {
  return { API_URL: 'https://api.test' };
});

jest.mock('@/shared/lib/httpClient', () => {
  return {
    httpClient: jest.fn(),
  };
});

jest.mock('@/shared/lib/errors', () => {
  const actual = jest.requireActual('@/shared/lib/errors');
  return actual;
});

import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

const mockHttpClient = httpClient as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('attachCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns redirect URL on success', async () => {
    mockHttpClient.mockResolvedValue({
      data: { redirect: 'https://accounts.google.com/oauth' },
    });

    const url = await attachCalendar(42);

    expect(url).toBe('https://accounts.google.com/oauth');
    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://api.test/google/oauth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ organization_id: 42 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('throws "already connected" error for SOURCE_ALREADY_EXISTS', async () => {
    mockHttpClient.mockRejectedValue(
      new ServerError('error', {
        status: 422,
        responseBody: JSON.stringify({
          meta: { error_code: 'SOURCE_ALREADY_EXISTS' },
        }),
      }),
    );

    await expect(attachCalendar(42)).rejects.toThrow(
      'Google Calendar is already connected to your account.',
    );
  });

  it('throws user-friendly error on generic server failure', async () => {
    mockHttpClient.mockRejectedValue(
      new ServerError('error', { status: 500, responseBody: '{}' }),
    );

    await expect(attachCalendar(42)).rejects.toThrow(
      'Failed to connect Google Calendar. Please try again.',
    );
  });

  it('handles HTML 5xx response body gracefully', async () => {
    mockHttpClient.mockRejectedValue(
      new ServerError('error', {
        status: 500,
        responseBody:
          '<!DOCTYPE html><html><body>Internal Server Error</body></html>',
      }),
    );

    await expect(attachCalendar(42)).rejects.toThrow(
      'Failed to connect Google Calendar. Please try again.',
    );
  });

  it('throws generic error when meta is missing error_code', async () => {
    mockHttpClient.mockRejectedValue(
      new ServerError('error', {
        status: 422,
        responseBody: JSON.stringify({ meta: {} }),
      }),
    );

    await expect(attachCalendar(42)).rejects.toThrow(
      'Failed to connect Google Calendar. Please try again.',
    );
  });

  it('does not throw "already connected" for unrelated JSON errors', async () => {
    mockHttpClient.mockRejectedValue(
      new ServerError('error', {
        status: 400,
        responseBody: JSON.stringify({
          meta: { error_code: 'SOME_OTHER_ERROR' },
        }),
      }),
    );

    await expect(attachCalendar(42)).rejects.toThrow(
      'Failed to connect Google Calendar. Please try again.',
    );
  });

  it('re-throws non-ServerError errors', async () => {
    const unexpected = new TypeError('network error');
    mockHttpClient.mockRejectedValue(unexpected);

    await expect(attachCalendar(42)).rejects.toThrow(unexpected);
  });

  it('throws when data.redirect is missing from successful response', async () => {
    mockHttpClient.mockResolvedValue({ data: {} });

    await expect(attachCalendar(42)).rejects.toThrow(
      'Failed to connect Google Calendar. Please try again.',
    );
  });
});
