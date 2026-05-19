import {
  createOrganization,
  getOrganization,
  getOrganizations,
  setActiveOrganization,
} from '@/features/organization/api/organization';

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

const mockRedirect = jest.fn();

jest.mock('next/navigation', () => {
  return {
    /**
     *
     * @param {...any} args
     */
    redirect: (...args: unknown[]) => {
      return mockRedirect(...args);
    },
  };
});

const mockCookieSet = jest.fn();

jest.mock('next/headers', () => {
  return {
    cookies: jest.fn(() => {
      return Promise.resolve({
        get: jest.fn(),
        set: mockCookieSet,
      });
    }),
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

// revalidatePath is auto-mocked via __mocks__/next-cache.js

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 *
 * @param status
 * @param body
 */
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

const mockOrg = {
  id: 1,
  name: 'Acme Corp',
  slug: 'acme',
};

// ---------------------------------------------------------------------------
// Tests — getOrganizations
// ---------------------------------------------------------------------------
describe('getOrganizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns organizations list on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: [mockOrg] }));

    const result = await getOrganizations();

    expect(result.data).toEqual([mockOrg]);
  });

  it('fetches from correct URL', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: [] }));

    await getOrganizations();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/organizations?limit=50&offset=0',
      expect.anything(),
    );
  });

  it('redirects to logout on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(401, 'Unauthorized'));

    await expect(getOrganizations()).rejects.toThrow();

    expect(mockRedirect).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('throws on other non-ok status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(makeResponse(500, 'Error'));

    await expect(getOrganizations()).rejects.toThrow(
      'Failed to load organizations',
    );
  });

  it('throws when success=false in response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: false, error: 'No data' }),
      );

    await expect(getOrganizations()).rejects.toThrow('No data');
  });
});

// ---------------------------------------------------------------------------
// Tests — getOrganization
// ---------------------------------------------------------------------------
describe('getOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns single organization on success', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockOrg }));

    const result = await getOrganization('1');

    expect(result.data).toEqual(mockOrg);
  });

  it('builds correct URL with organization_id', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(200, { success: true, data: mockOrg }));

    await getOrganization('42');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/organizations/42',
      expect.anything(),
    );
  });

  it('throws on non-ok status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(404, 'Not found'));

    await expect(getOrganization('999')).rejects.toThrow(
      'Failed to load organization',
    );
  });

  it('throws when success=false', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: false, error: 'No org' }),
      );

    await expect(getOrganization('1')).rejects.toThrow('No org');
  });
});

// ---------------------------------------------------------------------------
// Tests — createOrganization
// ---------------------------------------------------------------------------
describe('createOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends POST to /organizations', async () => {
    // On success, createOrganization calls selectOrganizationAction which calls
    // getOrganization (GET) and then redirect. Both fetch calls must be mocked.
    const orgWithOnboarding = {
      ...mockOrg,
      id: 5,
      onboarded_at: '2026-01-01T00:00:00Z',
    };

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeResponse(201, { success: true, data: orgWithOnboarding }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { success: true, data: orgWithOnboarding }),
      );

    await createOrganization({ name: 'New Org' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/organizations',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('includes org data in request body', async () => {
    const orgWithOnboarding = {
      ...mockOrg,
      id: 5,
      onboarded_at: '2026-01-01T00:00:00Z',
    };

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeResponse(201, { success: true, data: orgWithOnboarding }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { success: true, data: orgWithOnboarding }),
      );

    await createOrganization({ name: 'Test Org' });

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.name).toBe('Test Org');
  });

  it('throws on failure', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(422, 'Validation error'));

    await expect(createOrganization({ name: 'Bad' })).rejects.toThrow(
      'Failed to create organization',
    );
  });

  it('throws when success=false in response', async () => {
    // When success=false the function throws the error from the response body
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse(200, { success: false, error: 'Duplicate name' }),
      );

    await expect(createOrganization({ name: 'Dup' })).rejects.toThrow(
      'Duplicate name',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — setActiveOrganization
// ---------------------------------------------------------------------------
describe('setActiveOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets organization_id cookie from FormData', async () => {
    const formData = new FormData();

    formData.append('organization_id', '7');

    await setActiveOrganization({ ok: false }, formData);

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'organization_id', value: '7' }),
    );
  });

  it('returns { ok: true }', async () => {
    const formData = new FormData();

    formData.append('organization_id', '3');

    const result = await setActiveOrganization({ ok: false }, formData);

    expect(result).toEqual({ ok: true });
  });
});
