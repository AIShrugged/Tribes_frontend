import { format, parseISO } from 'date-fns';
import {
  ArrowRight,
  Brain,
  CheckCheck,
  CheckCircle2,
  FilePlus2,
  Lightbulb,
  MessageSquarePlus,
  Play,
  RefreshCw,
  Wrench,
} from 'lucide-react';

import type {
  AddCommentPayload,
  BrainEvent,
  BrainEventGroup,
  BrainSuggestion,
  CreateIssuePayload,
  UpdateTaskStatusPayload,
} from '@/features/brain/model/types';
import type { LucideIcon } from 'lucide-react';

/** Badge variants used for status colors (subset of the Badge component's set). */
type StatusVariant = 'info' | 'success' | 'neutral' | 'danger' | 'warning';

/** Titles carry a `[BRAIN]` prefix — strip it for display (shown as a chip instead). */
const BRAIN_PREFIX = /^\s*\[BRAIN]\s*/i;

export function hasBrainPrefix(value: string | null | undefined): boolean {
  return typeof value === 'string' && BRAIN_PREFIX.test(value);
}

export function stripBrainPrefix(value: string | null | undefined): string {
  return (value ?? '').replace(BRAIN_PREFIX, '').trim();
}

/**
 * Formats an ISO timestamp as `dd.MM.yyyy HH:mm`; returns a dash on empty input.
 * @param value - ISO 8601 string.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  try {
    return format(parseISO(value), 'dd.MM.yyyy HH:mm');
  } catch {
    return value;
  }
}

/**
 * Formats an ISO date (with or without a time part) as `dd.MM.yyyy`; returns the
 * raw value on parse failure and a dash on empty input. Used for protocol/agenda
 * dates like `previous_date` and commitment `deadline`.
 * @param value - ISO 8601 date string.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';

  try {
    return format(parseISO(value), 'dd.MM.yyyy');
  } catch {
    return value;
  }
}

/** Shortens a run UUID to `xxxxxxxx…xxxx` for compact display. */
export function formatRunUuid(value: string | null | undefined): string {
  if (!value) return '—';

  if (value.length <= 12) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

// --- Suggestion status ---

export const SUGGESTION_STATUS_META: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  pending: { label: 'Ожидает', variant: 'info' },
  applied: { label: 'Применено', variant: 'success' },
  rejected: { label: 'Отклонено', variant: 'neutral' },
  failed: { label: 'Ошибка', variant: 'danger' },
  superseded: { label: 'Заменено', variant: 'neutral' },
  expired: { label: 'Истекло', variant: 'neutral' },
};

export function getStatusMeta(status: string): {
  label: string;
  variant: StatusVariant;
} {
  return (
    SUGGESTION_STATUS_META[status] ?? { label: status, variant: 'neutral' }
  );
}

// --- Suggestion key (action type) ---

export interface SuggestionKeyMeta {
  label: string;
  icon: LucideIcon;
}

export const SUGGESTION_KEY_META: Record<string, SuggestionKeyMeta> = {
  create_issue: { label: 'Создание задачи', icon: FilePlus2 },
  update_task_status: { label: 'Смена статуса', icon: RefreshCw },
  add_comment: { label: 'Комментарий', icon: MessageSquarePlus },
};

export function getKeyMeta(key: string): SuggestionKeyMeta {
  return SUGGESTION_KEY_META[key] ?? { label: key, icon: ArrowRight };
}

export function getKeyLabel(key: string): string {
  return getKeyMeta(key).label;
}

/**
 * Builds the human "what will happen" preview from a suggestion's payload.
 * @param suggestion - the suggestion to preview.
 */
export function getSuggestionPreview(suggestion: BrainSuggestion): string {
  if (suggestion.key === 'create_issue') {
    const payload = suggestion.payload as CreateIssuePayload;
    const name =
      stripBrainPrefix(payload?.name) || stripBrainPrefix(suggestion.title);

    return `Создать задачу: «${name}» (${payload?.type ?? '—'})`;
  }

  if (suggestion.key === 'update_task_status') {
    const payload = suggestion.payload as UpdateTaskStatusPayload;

    return `Задача #${payload?.issue_id ?? '—'} → статус «${payload?.status ?? '—'}»`;
  }

  if (suggestion.key === 'add_comment') {
    const payload = suggestion.payload as AddCommentPayload;

    return `Комментарий к задаче #${payload?.issue_id ?? '—'}`;
  }

  return stripBrainPrefix(suggestion.title);
}

/**
 * The comment body for an `add_comment` suggestion (else null). Rendered below
 * the preview — clamped in the card, full when expanded.
 * @param suggestion - the suggestion.
 */
export function getAddCommentText(suggestion: BrainSuggestion): string | null {
  if (suggestion.key !== 'add_comment') return null;

  const payload = suggestion.payload as AddCommentPayload;
  const text =
    typeof payload?.comment === 'string' ? payload.comment.trim() : '';

  return text || null;
}

/**
 * The confirmation question shown before approving, phrased per action type.
 * @param suggestion - the suggestion being approved.
 */
export function getApproveConfirmText(suggestion: BrainSuggestion): string {
  if (suggestion.key === 'create_issue') {
    const payload = suggestion.payload as CreateIssuePayload;
    const name =
      stripBrainPrefix(payload?.name) || stripBrainPrefix(suggestion.title);

    return `Создать задачу «${name}» (${payload?.type ?? '—'})?`;
  }

  if (suggestion.key === 'update_task_status') {
    const payload = suggestion.payload as UpdateTaskStatusPayload;

    return `Изменить статус задачи #${payload?.issue_id ?? '—'} на «${payload?.status ?? '—'}»?`;
  }

  if (suggestion.key === 'add_comment') {
    const payload = suggestion.payload as AddCommentPayload;

    return `Добавить комментарий к задаче #${payload?.issue_id ?? '—'}?`;
  }

  return 'Применить предложение?';
}

// --- Reasoning log event types ---

export interface BrainEventTypeMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  colorClass: string;
}

export const BRAIN_EVENT_TYPE_META: Record<string, BrainEventTypeMeta> = {
  cycle_start: {
    label: 'Начало цикла',
    icon: Play,
    colorClass: 'text-[var(--info)]',
  },
  reasoning: {
    label: 'Рассуждение',
    icon: Brain,
    colorClass: 'text-[var(--primary)]',
  },
  thinking: {
    label: 'Размышление',
    icon: Lightbulb,
    colorClass: 'text-[var(--warning)]',
  },
  tool_call: {
    label: 'Вызов инструмента',
    icon: Wrench,
    colorClass: 'text-[var(--muted-foreground)]',
  },
  tool_result: {
    label: 'Результат',
    icon: CheckCircle2,
    colorClass: 'text-[var(--success)]',
  },
  cycle_summary: {
    label: 'Итог цикла',
    icon: CheckCheck,
    colorClass: 'text-[var(--success)]',
  },
};

export function getEventTypeMeta(type: string): BrainEventTypeMeta {
  return (
    BRAIN_EVENT_TYPE_META[type] ?? {
      label: type,
      icon: ArrowRight,
      colorClass: 'text-[var(--muted-foreground)]',
    }
  );
}

/**
 * Groups a flat (newest-first) event list into per-run groups, preserving the
 * order runs first appear and sorting each group's events by `seq` ascending so
 * a loop pass reads top-to-bottom.
 * @param events - flat event list as returned by the API.
 */
export function groupEventsByRun(events: BrainEvent[]): BrainEventGroup[] {
  const groups: BrainEventGroup[] = [];
  const index = new Map<string, BrainEventGroup>();

  for (const event of events) {
    const runKey = event.run_uuid ?? '__no_run__';
    let group = index.get(runKey);

    if (!group) {
      group = { runUuid: event.run_uuid, events: [] };
      index.set(runKey, group);
      groups.push(group);
    }

    group.events.push(event);
  }

  for (const group of groups) {
    group.events.sort((a, b) => {
      return a.seq - b.seq;
    });
  }

  return groups;
}
