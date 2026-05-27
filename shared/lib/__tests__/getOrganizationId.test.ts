import { getOrganizationId } from '@/shared/lib/getOrganizationId';

const mockRedirect = jest.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

jest.mock('next/navigation', () => {
  return {
    redirect: (path: string) => {
      return mockRedirect(path);
    },
  };
});

const mockCookiesGet = jest.fn();

jest.mock('next/headers', () => {
  return {
    cookies: jest.fn().mockImplementation(async () => {
      return {
        get: mockCookiesGet,
      };
    }),
  };
});

jest.mock('react', () => {
  return {
    ...jest.requireActual<typeof import('react')>('react'),
    cache: (fn: unknown) => {
      return fn;
    },
  };
});

describe('getOrganizationId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns organization_id as number when cookie exists', async () => {
    mockCookiesGet.mockReturnValue({ value: '42' });

    const result = await getOrganizationId();

    expect(result).toBe(42);
  });

  it('redirects to login when cookie is absent', async () => {
    mockCookiesGet.mockImplementation(() => {});

    await expect(getOrganizationId()).rejects.toThrow('REDIRECT:');
  });

  it('redirects to login when cookie value is non-numeric', async () => {
    mockCookiesGet.mockReturnValue({ value: 'abc' });

    await expect(getOrganizationId()).rejects.toThrow('REDIRECT:');
  });

  it('redirects to login when cookie value is zero', async () => {
    mockCookiesGet.mockReturnValue({ value: '0' });

    await expect(getOrganizationId()).rejects.toThrow('REDIRECT:');
  });

  it('redirects to login when cookie value is negative', async () => {
    mockCookiesGet.mockReturnValue({ value: '-1' });

    await expect(getOrganizationId()).rejects.toThrow('REDIRECT:');
  });

  it('calls cookies().get with organization_id key', async () => {
    mockCookiesGet.mockReturnValue({ value: '7' });

    await getOrganizationId();

    expect(mockCookiesGet).toHaveBeenCalledWith('organization_id');
  });
});
