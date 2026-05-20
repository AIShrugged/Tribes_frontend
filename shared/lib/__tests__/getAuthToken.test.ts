import { getAuthHeaders } from '@/shared/lib/getAuthToken';

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

describe('getAuthHeaders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns auth headers when token exists', async () => {
    mockCookiesGet.mockReturnValue({ value: 'my-secret-token' });

    const headers = await getAuthHeaders();

    expect(headers.Authorization).toBe('Bearer my-secret-token');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws Unauthorized when token is absent', async () => {
    mockCookiesGet.mockReturnValue();

    await expect(getAuthHeaders()).rejects.toThrow('Unauthorized');
  });

  it('throws Unauthorized when token value is empty string', async () => {
    mockCookiesGet.mockReturnValue({ value: '' });

    await expect(getAuthHeaders()).rejects.toThrow('Unauthorized');
  });

  it('calls cookies().get with token key', async () => {
    mockCookiesGet.mockReturnValue({ value: 'tok' });

    await getAuthHeaders();

    expect(mockCookiesGet).toHaveBeenCalledWith('token');
  });
});
