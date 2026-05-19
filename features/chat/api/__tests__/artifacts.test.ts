import { getArtifacts } from '@/entities/artifact/api/artifacts';
import { ServerError } from '@/shared/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockClearSession = jest.fn();
const mockRedirect = jest.fn();

jest.mock('@/shared/api/session', () => {
  return {
    clearSession: (...args: unknown[]) => {
      return mockClearSession(...args);
    },
  };
});

jest.mock('next/navigation', () => {
  return {
    redirect: (...args: unknown[]) => {
      return mockRedirect(...args);
    },
  };
});

jest.mock('@/shared/lib/config', () => {
  return {
    API_URL: 'https://api.test',
  };
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
function makeResponse(status: number, body: unknown): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    url: 'https://api.test',
    text: jest.fn(() => {
      return Promise.resolve(bodyText);
    }),
    json: jest.fn(() => {
      return Promise.resolve(body);
    }),
    headers: {
      get: jest.fn(() => {
        return null;
      }),
    },
  } as unknown as Response;
}

const mockArtifacts = {
  artifacts: {},
  layout: { items: [] },
};

// ---------------------------------------------------------------------------
// Tests — getArtifacts
// ---------------------------------------------------------------------------
describe('getArtifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns artifact data on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockArtifacts }),
      );

    const result = await getArtifacts(1);

    expect(result).toEqual(mockArtifacts);
  });

  it('fetches from correct URL with chatId', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockArtifacts }),
      );

    await getArtifacts(42);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/42/artifacts',
      expect.anything(),
    );
  });

  it('returns null on 404 (no artifacts)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(404, 'Not found'));

    const result = await getArtifacts(1);

    expect(result).toBeNull();
  });

  it('redirects to logout on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    // In test env, redirect() is mocked (doesn't throw), so httpClient continues
    // and throws ServerError — getArtifacts re-throws it since status !== 404
    await expect(getArtifacts(1)).rejects.toBeInstanceOf(ServerError);

    expect(mockRedirect).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('throws ServerError on other non-ok status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(makeResponse(500, 'Error'));

    await expect(getArtifacts(1)).rejects.toBeInstanceOf(ServerError);
  });

  it('throws ServerError when success=false in response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: false, data: null }));

    await expect(getArtifacts(1)).rejects.toBeInstanceOf(ServerError);
  });

  it('returns null when data is null in response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    const result = await getArtifacts(1);

    expect(result).toBeNull();
  });
});
