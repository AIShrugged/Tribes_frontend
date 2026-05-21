import { format } from 'date-fns';

import { parseEventDate } from '@/shared/lib/dateFormatter';

/**
 * getWeekdayAndDay.
 * @param dateString - dateString.
 * @returns Result.
 */
export function getWeekdayAndDay(dateString: string) {
  const date = parseEventDate(dateString);

  return {
    weekday: format(date, 'eee'),
    day: format(date, 'd'),
  };
}
