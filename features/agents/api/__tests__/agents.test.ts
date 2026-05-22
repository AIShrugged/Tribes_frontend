import { getAgentTasks } from '@/features/agents/api/agent-tasks';

const mockRedirect = jest.fn();

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
      return Promise.resolve({
        Authorization: 'Bearer test-token',
      });
    }),
  };
});

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    url: 'https://api.test/agent-tasks',
    text: jest.fn(() => {
      return Promise.resolve(bodyText);
    }),
    json: jest.fn(() => {
      return Promise.resolve(body);
    }),
    headers: {
      get: (key: string) => {
        return headers[key] ?? null;
      },
    },
  } as unknown as Response;
}

describe('getAgentTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps loading additional pages when Items-Count is missing and the page is full', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, {
        success: true,
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      }),
    );

    const result = await getAgentTasks(0, 3);

    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(true);
  });

  it('stops when Items-Count is missing and the page is not full', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, {
        success: true,
        data: [{ id: 1 }, { id: 2 }],
      }),
    );

    const result = await getAgentTasks(0, 3);

    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
