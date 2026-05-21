import {
  hasActiveCalendarFilters,
  parseCalendarFilters,
  type MeetingsCalendarFilters,
} from '../filters';

describe('parseCalendarFilters', () => {
  it('returns null for both fields when params are absent', () => {
    expect(parseCalendarFilters({})).toEqual({ team_id: null, user_id: null });
  });

  it('parses a valid numeric team_id string', () => {
    expect(parseCalendarFilters({ team_id: '42' })).toEqual({
      team_id: 42,
      user_id: null,
    });
  });

  it('parses a valid numeric user_id string', () => {
    expect(parseCalendarFilters({ user_id: '7' })).toEqual({
      team_id: null,
      user_id: 7,
    });
  });

  it('parses both fields when both are present', () => {
    expect(parseCalendarFilters({ team_id: '42', user_id: '7' })).toEqual({
      team_id: 42,
      user_id: 7,
    });
  });

  it('returns null for a non-numeric team_id', () => {
    expect(parseCalendarFilters({ team_id: 'abc' })).toEqual({
      team_id: null,
      user_id: null,
    });
  });

  it('returns null for an empty string team_id', () => {
    expect(parseCalendarFilters({ team_id: '' })).toEqual({
      team_id: null,
      user_id: null,
    });
  });

  it('returns null for Infinity string (guarded by Number.isFinite)', () => {
    expect(parseCalendarFilters({ team_id: 'Infinity' })).toEqual({
      team_id: null,
      user_id: null,
    });
  });

  it('takes the first element when team_id is an array', () => {
    expect(parseCalendarFilters({ team_id: ['42', '99'] })).toEqual({
      team_id: 42,
      user_id: null,
    });
  });

  it('takes the first element when user_id is an array', () => {
    expect(parseCalendarFilters({ user_id: ['7', '8'] })).toEqual({
      team_id: null,
      user_id: 7,
    });
  });
});

describe('hasActiveCalendarFilters', () => {
  it('returns false when both fields are null', () => {
    const f: MeetingsCalendarFilters = { team_id: null, user_id: null };
    expect(hasActiveCalendarFilters(f)).toBe(false);
  });

  it('returns true when team_id is set', () => {
    const f: MeetingsCalendarFilters = { team_id: 42, user_id: null };
    expect(hasActiveCalendarFilters(f)).toBe(true);
  });

  it('returns true when user_id is set', () => {
    const f: MeetingsCalendarFilters = { team_id: null, user_id: 7 };
    expect(hasActiveCalendarFilters(f)).toBe(true);
  });

  it('returns true when both are set', () => {
    const f: MeetingsCalendarFilters = { team_id: 42, user_id: 7 };
    expect(hasActiveCalendarFilters(f)).toBe(true);
  });

  it('returns false for result of parseCalendarFilters with empty input', () => {
    expect(hasActiveCalendarFilters(parseCalendarFilters({}))).toBe(false);
  });
});
