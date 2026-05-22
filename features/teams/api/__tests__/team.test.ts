'use server';

import {
  createTeam,
  deleteTeam,
  getTeams,
  sendInvite,
  updateTeam,
} from '@/features/teams/api/team';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('next/navigation', () => {
  return {
    redirect: jest.fn(),
  };
});

jest.mock('@/shared/lib/config', () => {
  return {
    API_URL: 'https://api.test',
  };
});

jest.mock('@/shared/lib/httpClient', () => {
  return {
    httpClient: jest.fn(),
    httpClientList: jest.fn(),
  };
});

import { httpClient, httpClientList } from '@/shared/lib/httpClient';

const mockHttpClient = jest.mocked(httpClient);
const mockHttpClientList = jest.mocked(httpClientList);

// revalidatePath is auto-mocked via __mocks__/next-cache.js

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockTeam = {
  id: 1,
  name: 'Alpha',
  slug: 'alpha',
  employee_count: 5,
  members: [],
};

// ---------------------------------------------------------------------------
// Tests — getTeams
// ---------------------------------------------------------------------------
describe('getTeams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls httpClientList with limit=100', async () => {
    mockHttpClientList.mockResolvedValue({ data: [mockTeam], totalCount: 1, hasMore: false });

    await getTeams('5');

    expect(mockHttpClientList).toHaveBeenCalledWith(
      'https://api.test/organizations/5/teams?limit=100',
    );
  });

  it('returns data and totalCount', async () => {
    mockHttpClientList.mockResolvedValue({ data: [mockTeam], totalCount: 1, hasMore: false });

    const result = await getTeams('5');

    expect(result.data).toEqual([mockTeam]);
    expect(result.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — deleteTeam
// ---------------------------------------------------------------------------
describe('deleteTeam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls httpClient with DELETE to correct URL', async () => {
    mockHttpClient.mockResolvedValue({ data: undefined });

    await deleteTeam(42);

    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://api.test/teams/42',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns { error: null } on success', async () => {
    mockHttpClient.mockResolvedValue({ data: undefined });

    const result = await deleteTeam(1);

    expect(result.error).toBeNull();
  });

  it('returns { error: string } on ServerError', async () => {
    const { ServerError } = await import('@/shared/lib/errors');

    mockHttpClient.mockRejectedValue(
      new ServerError('Not Found', {
        status: 404,
        responseBody: JSON.stringify({ message: 'Team not found' }),
      }),
    );

    const result = await deleteTeam(999);

    expect(result.error).toBe('Team not found');
    expect(result.data).toBeNull();
  });

  it('rethrows unexpected errors', async () => {
    mockHttpClient.mockRejectedValue(new Error('Network failure'));

    await expect(deleteTeam(1)).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// Tests — createTeam
// ---------------------------------------------------------------------------
describe('createTeam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls httpClient with POST to /teams', async () => {
    mockHttpClient.mockResolvedValue({ data: mockTeam });

    await createTeam('5', { name: 'Beta' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://api.test/teams',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('includes organization_id and name in body', async () => {
    mockHttpClient.mockResolvedValue({ data: mockTeam });

    await createTeam('7', { name: 'Gamma' });

    const [, options] = mockHttpClient.mock.calls[0] as [
      string,
      RequestInit & { body: string },
    ];
    const body = JSON.parse(options.body) as Record<string, unknown>;

    expect(body.organization_id).toBe('7');
    expect(body.name).toBe('Gamma');
  });

  it('includes Content-Type: application/json header', async () => {
    mockHttpClient.mockResolvedValue({ data: mockTeam });

    await createTeam('5', { name: 'Team' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('returns { error: null, data } on success', async () => {
    mockHttpClient.mockResolvedValue({ data: mockTeam });

    const result = await createTeam('5', { name: 'Team' });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockTeam);
  });

  it('returns { error: string } on ServerError', async () => {
    const { ServerError } = await import('@/shared/lib/errors');

    mockHttpClient.mockRejectedValue(
      new ServerError('Unprocessable Entity', {
        status: 422,
        responseBody: JSON.stringify({ message: 'Validation error' }),
      }),
    );

    const result = await createTeam('5', { name: 'T' });

    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it('returns default error message when response body is empty', async () => {
    const { ServerError } = await import('@/shared/lib/errors');

    mockHttpClient.mockRejectedValue(
      new ServerError('Internal Server Error', {
        status: 500,
        responseBody: '',
      }),
    );

    const result = await createTeam('5', { name: 'T' });

    expect(result.error).toBe('Failed to create team');
  });
});

// ---------------------------------------------------------------------------
// Tests — updateTeam
// ---------------------------------------------------------------------------
describe('updateTeam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpClient.mockResolvedValue({ data: mockTeam });
  });

  it('calls httpClient with PUT method and correct URL', async () => {
    await updateTeam(3, { name: 'Updated' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://api.test/teams/3',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('includes Content-Type: application/json header', async () => {
    await updateTeam(3, { name: 'Updated' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('resolves without error on success', async () => {
    await expect(updateTeam(3, { name: 'Updated' })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — sendInvite
// ---------------------------------------------------------------------------
describe('sendInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns data on success', async () => {
    const responseData = {
      id: 1,
      email: 'user@example.com',
      status: 'pending',
    };

    mockHttpClient.mockResolvedValue({ data: responseData });

    const result = await sendInvite(1, { email: 'user@example.com' });

    expect(result.data).toEqual(responseData);
    expect(result.error).toBeNull();
  });

  it('sends POST to correct URL', async () => {
    mockHttpClient.mockResolvedValue({
      data: { id: 1, email: 'a@b.com', status: 'pending' },
    });

    await sendInvite(3, { email: 'a@b.com' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://api.test/teams/3/invites',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com' }),
      }),
    );
  });

  it('sends member data in body', async () => {
    mockHttpClient.mockResolvedValue({
      data: { id: 1, email: 'member@example.com', status: 'pending' },
    });

    await sendInvite(1, { email: 'member@example.com' });

    expect(mockHttpClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ email: 'member@example.com' }),
      }),
    );
  });

  it('returns error when ServerError thrown', async () => {
    const { ServerError } = await import('@/shared/lib/errors');

    mockHttpClient.mockRejectedValue(
      new ServerError('User already in team', {
        status: 422,
        responseBody: JSON.stringify({ message: 'User already in team' }),
      }),
    );

    const result = await sendInvite(1, { email: 'a@b.com' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('User already in team');
  });

  it('returns default error message when no message in body', async () => {
    const { ServerError } = await import('@/shared/lib/errors');

    mockHttpClient.mockRejectedValue(
      new ServerError('Internal Server Error', {
        status: 500,
        responseBody: '',
      }),
    );

    const result = await sendInvite(1, { email: 'a@b.com' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('Failed to send invite');
  });
});
