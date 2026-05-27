import {
  createChat,
  deleteChat,
  getChats,
  updateChatTitle,
} from '@/features/chat/api/chats';

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
    url: 'https://api.test/chats',
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

const mockChat = {
  id: 1,
  title: 'Test Chat',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests — getChats
// ---------------------------------------------------------------------------
describe('getChats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns data, totalCount, and hasMore on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(
          200,
          { success: true, data: [mockChat] },
          { 'Items-Count': '25' },
        ),
      );

    const result = await getChats(42, 0, 20);

    expect(result.data).toEqual([mockChat]);
    expect(result.totalCount).toBe(25);
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore=false when all chats are loaded', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(
          200,
          { success: true, data: [mockChat] },
          { 'Items-Count': '1' },
        ),
      );

    const result = await getChats(42, 0, 20);

    expect(result.hasMore).toBe(false);
  });

  it('uses default offset=0 and limit=20', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: [] }, { 'Items-Count': '0' }),
      );

    await getChats(42);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats?organization_id=42&offset=0&limit=20',
      expect.anything(),
    );
  });

  it('includes pagination and organization_id in query', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: true, data: [] }, { 'Items-Count': '0' }),
      );

    await getChats(123, 40, 20);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats?organization_id=123&offset=40&limit=20',
      expect.anything(),
    );
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(getChats(42)).rejects.toThrow();
  });

  it('throws on other non-ok status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, 'Internal Server Error'));

    await expect(getChats(42)).rejects.toThrow();
  });

  it('throws when success=false in response body', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: false, error: 'Something broke' }),
      );

    await expect(getChats(42)).rejects.toThrow('Something broke');
  });

  it('defaults totalCount to 0 when Items-Count header is absent', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: [] }));

    const result = await getChats(42);

    expect(result.totalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — createChat
// ---------------------------------------------------------------------------
describe('createChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ActionResult with chat data on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    const result = await createChat({ title: 'My Chat', organization_id: 42 });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockChat);
  });

  it('sends title in request body', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await createChat({ title: 'Hello Chat', organization_id: 42 });

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.title).toBe('Hello Chat');
  });

  it('sends organization_id in request body when provided', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await createChat({ title: 'Scoped Chat', organization_id: 42 });

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.organization_id).toBe(42);
  });

  it('omits title when no title is given', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await createChat({ organization_id: 42 });

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body).not.toHaveProperty('title');
  });

  it('uses POST method', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await createChat({ organization_id: 42 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(createChat({ organization_id: 42 })).rejects.toThrow();
  });

  it('returns ActionResult with error on server failure', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(422, JSON.stringify({ message: 'Creation failed' })),
      );

    const result = await createChat({ title: 'Bad Chat' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('Creation failed');
  });

  it('returns organization_id validation errors from 422 response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeResponse(
        422,
        JSON.stringify({
          message: 'The organization id field is required.',
          errors: {
            organization_id: ['The organization id field is required.'],
          },
        }),
      ),
    );

    const result = await createChat({ title: 'Bad Chat' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('The organization id field is required.');
    if (result.error) {
      expect(result.fieldErrors).toEqual({
        organization_id: 'The organization id field is required.',
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — updateChatTitle
// ---------------------------------------------------------------------------
describe('updateChatTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends PATCH request to correct URL', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await updateChatTitle(42, 'Updated Title');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/42',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('sends title in request body', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockChat }));

    await updateChatTitle(42, 'My New Title');

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.title).toBe('My New Title');
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(updateChatTitle(1, 'title')).rejects.toThrow();
  });

  it('throws on server failure', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(422, JSON.stringify({ message: 'Update failed' })),
      );

    await expect(updateChatTitle(1, 'title')).rejects.toThrow('Update failed');
  });
});

// ---------------------------------------------------------------------------
// Tests — deleteChat
// ---------------------------------------------------------------------------
describe('deleteChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends DELETE request to correct URL', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    await deleteChat(99);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/chats/99',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('resolves without error on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: null }));

    await expect(deleteChat(1)).resolves.toBeUndefined();
  });

  it('redirects on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(deleteChat(1)).rejects.toThrow();
  });

  it('throws on failure', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(404, JSON.stringify({ message: 'Chat not found' })),
      );

    await expect(deleteChat(999)).rejects.toThrow();
  });
});
