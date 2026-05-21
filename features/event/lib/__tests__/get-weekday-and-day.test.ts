import { getWeekdayAndDay } from '@/features/event/lib/get-weekday-and-day';

describe('getWeekdayAndDay', () => {
  it('returns correct weekday and day for a Monday', () => {
    // 2024-03-11 is a Monday
    const result = getWeekdayAndDay('2024-03-11 09:00:00');

    expect(result.weekday).toBe('Mon');
    expect(result.day).toBe('11');
  });

  it('returns correct weekday and day for a Friday', () => {
    // 2024-03-15 is a Friday
    const result = getWeekdayAndDay('2024-03-15 14:30:00');

    expect(result.weekday).toBe('Fri');
    expect(result.day).toBe('15');
  });

  it('returns correct weekday and day for a Sunday', () => {
    // 2024-03-17 is a Sunday
    const result = getWeekdayAndDay('2024-03-17 00:00:00');

    expect(result.weekday).toBe('Sun');
    expect(result.day).toBe('17');
  });

  it('returns day without leading zero', () => {
    const result = getWeekdayAndDay('2024-03-05 10:00:00');

    expect(result.day).toBe('5');
  });

  it('returns three-letter abbreviated weekday', () => {
    const { weekday } = getWeekdayAndDay('2024-03-11 09:00:00');

    expect(weekday).toHaveLength(3);
  });

  it('handles ISO 8601 format with Z suffix', () => {
    // 2024-03-11 is a Monday
    const result = getWeekdayAndDay('2024-03-11T09:00:00.000000Z');

    expect(result.weekday).toBe('Mon');
    expect(result.day).toBe('11');
  });

  it('handles ISO 8601 format without microseconds', () => {
    // 2024-03-15 is a Friday
    const result = getWeekdayAndDay('2024-03-15T14:30:00Z');

    expect(result.weekday).toBe('Fri');
    expect(result.day).toBe('15');
  });
});
