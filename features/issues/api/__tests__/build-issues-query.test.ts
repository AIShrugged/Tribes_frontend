import { buildIssuesQuery } from '@/features/issues/model/build-issues-query';

jest.mock('@/shared/lib/httpClient', () => {
  return {
    httpClient: jest.fn(),
    httpClientList: jest.fn(),
  };
});

jest.mock('next/cache', () => {
  return { revalidatePath: jest.fn() };
});

jest.mock('next/navigation', () => {
  return { notFound: jest.fn(), redirect: jest.fn() };
});

function parseQuery(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe('buildIssuesQuery', () => {
  it('sends type=organization when type is "task"', () => {
    const qs = buildIssuesQuery({ type: 'task' });
    const params = parseQuery(qs);
    expect(params.get('type')).toBe('organization');
    expect(params.has('exclude_type')).toBe(false);
  });

  it('sends type=epic when type is "epic"', () => {
    const qs = buildIssuesQuery({ type: 'epic' });
    const params = parseQuery(qs);
    expect(params.get('type')).toBe('epic');
    expect(params.has('exclude_type')).toBe(false);
  });

  it('sends no type param when type is empty', () => {
    const qs = buildIssuesQuery({ type: '' });
    const params = parseQuery(qs);
    expect(params.has('type')).toBe(false);
    expect(params.has('exclude_type')).toBe(false);
  });

  it('sends author_id when provided', () => {
    const qs = buildIssuesQuery({ author_id: 42 });
    const params = parseQuery(qs);
    expect(params.get('author_id')).toBe('42');
  });

  it('omits author_id when not provided', () => {
    const qs = buildIssuesQuery({});
    const params = parseQuery(qs);
    expect(params.has('author_id')).toBe(false);
  });

  it('sends epic_id when provided', () => {
    const qs = buildIssuesQuery({ epic_id: 7 });
    const params = parseQuery(qs);
    expect(params.get('epic_id')).toBe('7');
  });

  it('sends status when provided', () => {
    const qs = buildIssuesQuery({ status: 'open' });
    const params = parseQuery(qs);
    expect(params.get('status')).toBe('open');
  });

  it('sets default offset and limit', () => {
    const qs = buildIssuesQuery({});
    const params = parseQuery(qs);
    expect(params.get('offset')).toBe('0');
    expect(params.get('limit')).toBe('10');
  });

  it('respects custom offset and limit', () => {
    const qs = buildIssuesQuery({ offset: 20, limit: 50 });
    const params = parseQuery(qs);
    expect(params.get('offset')).toBe('20');
    expect(params.get('limit')).toBe('50');
  });

  it('sends search when provided', () => {
    const qs = buildIssuesQuery({ search: 'hello' });
    const params = parseQuery(qs);
    expect(params.get('search')).toBe('hello');
  });

  it('sends code when provided', () => {
    const qs = buildIssuesQuery({ code: 'DEV-14' });
    const params = parseQuery(qs);
    expect(params.get('code')).toBe('DEV-14');
  });

  it('omits code when not provided', () => {
    const qs = buildIssuesQuery({});
    const params = parseQuery(qs);
    expect(params.has('code')).toBe(false);
  });

  it('forwards sort=number', () => {
    const qs = buildIssuesQuery({ sort: 'number', order: 'asc' });
    const params = parseQuery(qs);
    expect(params.get('sort')).toBe('number');
    expect(params.get('order')).toBe('asc');
  });

  it('sends unassigned=1 when unassigned is true', () => {
    const qs = buildIssuesQuery({ unassigned: true });
    const params = parseQuery(qs);
    expect(params.get('unassigned')).toBe('1');
  });

  it('sends exclude_archived=1 when flag is set', () => {
    const qs = buildIssuesQuery({ exclude_archived: true });
    const params = parseQuery(qs);
    expect(params.get('exclude_archived')).toBe('1');
  });
});
