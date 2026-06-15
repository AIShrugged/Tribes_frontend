import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export type GoalsTone = 'none' | 'normal' | 'ok' | 'warn' | 'danger';

/**
 * TONE_TEXT_CLASS maps a deadline/due tone to a Tailwind text-color class.
 * NOTE: the -500 palette classes are theme-invariant; verify warning/danger
 * legibility on the light surface (see plan Phase 6).
 */
export const TONE_TEXT_CLASS: Record<GoalsTone, string> = {
  none: 'text-[var(--muted-foreground)]',
  normal: 'text-[var(--foreground)]',
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  danger: 'text-red-500',
};

/**
 * parseDate — safe ISO parse that returns null for empty/malformed input.
 * @param dateStr - ISO date string or null.
 * @returns parsed Date or null.
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * formatShortDate — plain "MMM d" for a date, with no countdown/overdue framing.
 * Used for completed epics where the deadline is just historical context.
 * @param dueDate - ISO date string or null.
 * @returns "MMM d" or empty string.
 */
export function formatShortDate(dueDate: string | null): string {
  const due = parseDate(dueDate);

  return due ? format(due, 'MMM d') : '';
}

/**
 * formatDeadline — epic deadline label with countdown and tone.
 * future → "Jun 28" (ok); ≤3 days → "Jun 18 · 3 days left" (warn);
 * today → "Jun 18 · today" (warn); past → "Jun 5 · 10 days overdue" (danger);
 * null → empty label (none).
 * @param dueDate - ISO due date or null.
 * @param now - reference date (defaults to now).
 * @returns label and tone.
 */
export function formatDeadline(
  dueDate: string | null,
  now: Date = new Date(),
): { label: string; tone: GoalsTone } {
  const due = parseDate(dueDate);
  if (!due) return { label: '', tone: 'none' };

  const days = differenceInCalendarDays(due, now);
  const date = format(due, 'MMM d');

  if (days < 0) {
    const n = Math.abs(days);

    return {
      label: `${date} · ${n.toString()} ${n === 1 ? 'day' : 'days'} overdue`,
      tone: 'danger',
    };
  }
  if (days === 0) return { label: `${date} · today`, tone: 'warn' };
  if (days <= 3) {
    return {
      label: `${date} · ${days.toString()} ${days === 1 ? 'day' : 'days'} left`,
      tone: 'warn',
    };
  }

  return { label: date, tone: 'ok' };
}

/**
 * formatTaskDue — task row due cell label and tone.
 * overdue → danger; today → warn; soon (≤7d) → normal; later → muted; null → "—".
 * @param dueDate - ISO due date or null.
 * @param now - reference date (defaults to now).
 * @returns label and tone.
 */
export function formatTaskDue(
  dueDate: string | null,
  now: Date = new Date(),
): { label: string; tone: GoalsTone } {
  const due = parseDate(dueDate);
  if (!due) return { label: '—', tone: 'none' };

  const days = differenceInCalendarDays(due, now);
  const date = format(due, 'MMM d');

  if (days < 0) return { label: date, tone: 'danger' };
  if (days === 0) return { label: 'Today', tone: 'warn' };
  if (days <= 7) return { label: date, tone: 'normal' };

  return { label: date, tone: 'none' };
}
