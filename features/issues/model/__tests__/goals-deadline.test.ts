import {
  formatDeadline,
  formatShortDate,
  formatTaskDue,
} from '../goals-deadline';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('formatDeadline', () => {
  it('returns empty/none for null', () => {
    expect(formatDeadline(null, NOW)).toEqual({ label: '', tone: 'none' });
  });

  it('marks far-future dates ok', () => {
    expect(formatDeadline('2026-06-28', NOW)).toEqual({
      label: 'Jun 28',
      tone: 'ok',
    });
  });

  it('warns within 3 days with a countdown', () => {
    expect(formatDeadline('2026-06-17', NOW)).toEqual({
      label: 'Jun 17 · 2 days left',
      tone: 'warn',
    });
  });

  it('warns today', () => {
    expect(formatDeadline('2026-06-15', NOW)).toEqual({
      label: 'Jun 15 · today',
      tone: 'warn',
    });
  });

  it('flags overdue as danger with day count', () => {
    expect(formatDeadline('2026-06-05', NOW)).toEqual({
      label: 'Jun 5 · 10 days overdue',
      tone: 'danger',
    });
  });

  it('uses singular day', () => {
    expect(formatDeadline('2026-06-16', NOW)).toEqual({
      label: 'Jun 16 · 1 day left',
      tone: 'warn',
    });
    expect(formatDeadline('2026-06-14', NOW)).toEqual({
      label: 'Jun 14 · 1 day overdue',
      tone: 'danger',
    });
  });
});

describe('formatTaskDue', () => {
  it('returns dash for null', () => {
    expect(formatTaskDue(null, NOW)).toEqual({ label: '—', tone: 'none' });
  });

  it('flags overdue danger', () => {
    expect(formatTaskDue('2026-06-09', NOW)).toEqual({
      label: 'Jun 9',
      tone: 'danger',
    });
  });

  it('flags today warn', () => {
    expect(formatTaskDue('2026-06-15', NOW)).toEqual({
      label: 'Today',
      tone: 'warn',
    });
  });

  it('marks soon (<=7d) as normal', () => {
    expect(formatTaskDue('2026-06-20', NOW)).toEqual({
      label: 'Jun 20',
      tone: 'normal',
    });
  });

  it('marks later as muted none', () => {
    expect(formatTaskDue('2026-06-30', NOW)).toEqual({
      label: 'Jun 30',
      tone: 'none',
    });
  });
});

describe('formatShortDate', () => {
  it('returns "MMM d" for a valid date with no countdown framing', () => {
    expect(formatShortDate('2026-06-05')).toBe('Jun 5');
  });

  it('returns empty string for null or malformed input', () => {
    expect(formatShortDate(null)).toBe('');
    expect(formatShortDate('not-a-date')).toBe('');
  });
});
