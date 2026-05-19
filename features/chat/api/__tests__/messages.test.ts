import {
  getMessages,
  pollRun,
  sendMessage,
} from '@/features/chat/api/messages';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockClearSession = jest.fn();

jest.mock('@/shared/api/session', () => {
  return {
    /**
     *
     * @param {...any} args
     */
    clearSession: (...args: unknown[]) => {
      return mockClearSession(...args);
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
/**
 *
 * @param status
 * @param body
 * @param headers
 */
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
    url: 'https://api.test',
    text: jest.fn(() => {
      return Promise.resolve(bodyText);
    }),
    json: jest.fn(() => {
      return Promise.resolve(body);
    }),
    headers: {
      /**
       *
       * @param key
       */
      get: (key: string) => {
        return headers[key] ?? null;
      },
    },
  } as unknown as Response;
}

const mockMessage = {
  id: 10,
  chat_id: 1,
  role: 'user',
  content: 'Hello',
  created_at: '2024-01-01T00:00:00Z',
};
const mockAgentRun = {
  uuid: 'run-uuid-123',
  status: 'completed',
  message: mockMessage,
};

// ---------------------------------------------------------------------------
// Tests — getMessages
// ---------------------------------------------------------------------------
describe('getMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns data, totalCount, and hasMore on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(
          200,
          { success: true, data: [mockMessage] },
          { 'Items-Count': '100' },
        ),
      );

    const result = await getMessages(1, 0, 50);

    expect(result.data).toEqual([mockMessage]);
    expect(result.totalCount).toBe(100);
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore=false when all messages loaded', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(
          200,
          { success: true, data: [mockMessage] },
          { 'Items-Count': '1' },
        ),
      );

    const result = await getMessages(1, 0, 50);

    expect(result.hasMore).toBe(false);
  });

  it('builds correct URL with chatId, offset, and limit', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: [] }, { 'Items-Count': '0' }),
      );

    await getMessages(42, 10, 25);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/42/messages?offset=10&limit=25',
      expect.anything(),
    );
  });

  it('uses defaults offset=0 and limit=50', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: [] }, { 'Items-Count': '0' }),
      );

    await getMessages(5);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/5/messages?offset=0&limit=50',
      expect.anything(),
    );
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(getMessages(1)).rejects.toThrow();
  });

  it('throws on non-ok status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, 'Server error'));

    await expect(getMessages(1)).rejects.toThrow();
  });

  it('throws when success=false in response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: false, error: 'Not found' }),
      );

    await expect(getMessages(1)).rejects.toThrow('Not found');
  });

  it('defaults totalCount to 0 when header absent', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: [] }));

    const result = await getMessages(1);

    expect(result.totalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — sendMessage
// ---------------------------------------------------------------------------
describe('sendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ActionResult with message data on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockMessage }),
      );

    const result = await sendMessage(1, 'Hello!');

    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockMessage);
  });

  it('sends POST to correct URL', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockMessage }),
      );

    await sendMessage(7, 'content');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/7/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends content in request body', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockMessage }),
      );

    await sendMessage(1, 'My message text');

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.content).toBe('My message text');
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(sendMessage(1, 'hi')).rejects.toThrow();
  });

  it('returns ActionResult with error on server failure', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(422, JSON.stringify({ message: 'Send failed' })),
      );

    const result = await sendMessage(1, 'hi');

    expect(result.data).toBeNull();
    expect(result.error).toBe('Send failed');
  });

  it('returns ActionResult with default error when body has no message', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(422, JSON.stringify({})));

    const result = await sendMessage(1, 'hi');

    expect(result.data).toBeNull();
    expect(result.error).toBe('Failed to send message');
  });
});

// ---------------------------------------------------------------------------
// Tests — pollRun
// ---------------------------------------------------------------------------
describe('pollRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns run data on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockAgentRun }),
      );

    const result = await pollRun(1, 'run-uuid-123');

    expect(result).toEqual(mockAgentRun);
  });

  it('builds correct URL with chatId and runUuid', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: mockAgentRun }),
      );

    await pollRun(3, 'my-run-uuid');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/3/runs/my-run-uuid',
      expect.anything(),
    );
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(pollRun(1, 'uuid')).rejects.toThrow();
  });

  it('throws on non-ok status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, 'Poll error'));

    await expect(pollRun(1, 'uuid')).rejects.toThrow();
  });
});
