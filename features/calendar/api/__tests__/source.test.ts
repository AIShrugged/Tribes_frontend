import { detachCalendar, getSources } from '@/features/calendar/api/source';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('next/cache', () => {
  return { revalidatePath: jest.fn() };
});

jest.mock('next/navigation', () => {
  return { redirect: jest.fn() };
});

jest.mock('@/shared/lib/config', () => {
  return { API_URL: 'https://api.test' };
});

jest.mock('@/shared/lib/getAuthToken', () => {
  return {
    getAuthHeaders: jest.fn(() => {
      return Promise.resolve({ Authorization: 'Bearer test-token' });
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param status
 * @param body
 */
function makeResponse(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: (_name: string) => null },
    text: () => {
      return Promise.resolve(text);
    },
    json: () => {
      return Promise.resolve(
        typeof body === 'string' ? JSON.parse(text) : body,
      );
    },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// getSources
// ---------------------------------------------------------------------------

describe('getSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sources on success', async () => {
    const sources = [
      {
        id: 1,
        user_id: 1,
        external_id: 'alice@gmail.com',
        identity: 'alice@gmail.com',
        type: 'google_calendar',
        auth_type: 'oauth2',
        is_connected: true,
      },
    ];

    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: sources }));

    const result = await getSources();

    expect(result).toEqual(sources);
  });

  it('returns empty array on API error', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, 'Server Error'));

    const result = await getSources();

    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    const result = await getSources();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detachCalendar
// ---------------------------------------------------------------------------

describe('detachCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls DELETE /sources/{id} and redirects on success', async () => {
    const { redirect } = await import('next/navigation');

    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    await detachCalendar(42);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/sources/42',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard/meetings/calendar');
  });

  it('calls revalidatePath for meetings calendar and profile calendar on success', async () => {
    const { revalidatePath } = await import('next/cache');

    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    await detachCalendar(1);

    expect(revalidatePath).toHaveBeenCalledWith(
      '/dashboard/meetings/calendar',
      'layout',
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      '/dashboard/profile/calendar',
      'layout',
    );
  });

  it('returns error result on 404', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(404, { message: 'Not found' }));

    const result = await detachCalendar(99);

    expect(result.error).toBe(
      'Failed to disconnect Google Calendar. Please try again.',
    );
    expect(result.data).toBeNull();
  });

  it('returns error result on 500', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, 'Internal Server Error'));

    const result = await detachCalendar(1);

    expect(result.error).toBe(
      'Failed to disconnect Google Calendar. Please try again.',
    );
  });

  it('does not call revalidatePath or redirect on failure', async () => {
    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');

    globalThis.fetch = jest.fn().mockResolvedValue(makeResponse(500, 'error'));

    await detachCalendar(1);

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
