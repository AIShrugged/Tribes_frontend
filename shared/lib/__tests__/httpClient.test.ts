import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

jest.mock('@/shared/lib/getAuthToken', () => {
  return {
    getAuthHeaders: jest.fn().mockResolvedValue({
      Authorization: 'Bearer test-token',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
  };
});

jest.mock('next/navigation', () => {
  return {
    redirect: jest.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
  };
});

jest.mock('@/shared/api/session', () => {
  return { clearSession: jest.fn().mockResolvedValue(void 0) };
});

const makeResponse = (
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
): Response => {
  const { status = 200, headers = {} } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (key: string) => {
        return headers[key] ?? null;
      },
    },
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
};
const API_RESOURCE_URL = 'https://api/resource';
const API_LIST_URL = 'https://api/list';
// Assign a stable jest.fn() to globalThis.fetch before all tests.
const mockFetch = jest.fn();

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

describe('httpClient', () => {
  it('returns data on successful response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: true, data: { id: 1, name: 'Test' } }),
    );

    const result = await httpClient<{ id: number; name: string }>(
      API_RESOURCE_URL,
    );

    expect(result.data).toEqual({ id: 1, name: 'Test' });
  });

  it('throws ServerError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ message: 'Not Found' }, { status: 404 }),
    );

    await expect(httpClient(API_RESOURCE_URL)).rejects.toBeInstanceOf(
      ServerError,
    );
  });

  it('ServerError contains correct status', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ message: 'Error' }, { status: 500 }),
    );

    await expect(httpClient(API_RESOURCE_URL)).rejects.toMatchObject({
      status: 500,
    });
  });

  it('throws ServerError when success is false', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: false, data: null, error: 'Bad data' }),
    );

    await expect(httpClient(API_RESOURCE_URL)).rejects.toBeInstanceOf(
      ServerError,
    );
  });

  it('throws ServerError with error message from API response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: false, data: null, error: 'Custom error' }),
    );

    await expect(httpClient(API_RESOURCE_URL)).rejects.toMatchObject({
      message: 'Custom error',
    });
  });

  it('redirects to logout on 401', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ message: 'Unauthorized' }, { status: 401 }),
    );

    await expect(httpClient(API_RESOURCE_URL)).rejects.toThrow(
      'REDIRECT:/api/auth/logout',
    );
  });

  it('passes custom method to fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ success: true, data: {} }));

    await httpClient(API_RESOURCE_URL, { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledWith(
      API_RESOURCE_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('merges auth headers with custom headers', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ success: true, data: {} }));

    await httpClient(API_RESOURCE_URL, {
      headers: { 'X-Custom': 'value' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      API_RESOURCE_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Custom': 'value',
        }),
      }),
    );
  });
});

describe('httpClientList', () => {
  it('returns data array and totalCount from Items-Count header', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(
        { success: true, data: [{ id: 1 }, { id: 2 }] },
        { headers: { 'Items-Count': '10' } },
      ),
    );

    const result = await httpClientList<{ id: number }>(API_LIST_URL);

    expect(result.data).toHaveLength(2);
    expect(result.totalCount).toBe(10);
  });

  it('hasMore is true when loaded count is less than totalCount', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(
        { success: true, data: [{ id: 1 }] },
        { headers: { 'Items-Count': '5' } },
      ),
    );

    const result = await httpClientList<{ id: number }>(API_LIST_URL);

    expect(result.hasMore).toBe(true);
  });

  it('hasMore is false when loaded count equals totalCount', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(
        { success: true, data: [{ id: 1 }, { id: 2 }] },
        { headers: { 'Items-Count': '2' } },
      ),
    );

    const result = await httpClientList<{ id: number }>(API_LIST_URL);

    expect(result.hasMore).toBe(false);
  });

  it('totalCount defaults to 0 when Items-Count header is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ success: true, data: [] }));

    const result = await httpClientList<unknown>(API_LIST_URL);

    expect(result.totalCount).toBe(0);
  });

  it('throws ServerError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ message: 'Error' }, { status: 500 }),
    );

    await expect(httpClientList(API_LIST_URL)).rejects.toBeInstanceOf(
      ServerError,
    );
  });

  it('redirects on 401', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ message: 'Unauthorized' }, { status: 401 }),
    );

    await expect(httpClientList(API_LIST_URL)).rejects.toThrow(
      'REDIRECT:/api/auth/logout',
    );
  });
});
