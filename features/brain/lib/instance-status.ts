import type {
  ClaudeAuthType,
  SecondBrainStatus,
} from '@/features/brain/model/types';

/** Badge variants used for instance status colors (subset of the Badge set). */
type StatusVariant = 'info' | 'success' | 'neutral' | 'danger' | 'warning';

export interface BrainInstanceStatusMeta {
  label: string;
  variant: StatusVariant;
  /** Coming-up / going-down states — drive the poller and the badge spinner. */
  isTransitional: boolean;
}

/**
 * Transitional statuses: the container is still settling, so the UI keeps
 * polling `GET /brain/instances/{org}` until it reaches a stable state.
 */
export const TRANSITIONAL_STATUSES: readonly SecondBrainStatus[] = [
  'pending',
  'stopping',
  'stopped',
];

export function isTransitionalStatus(status: SecondBrainStatus): boolean {
  return TRANSITIONAL_STATUSES.includes(status);
}

const STATUS_META: Record<SecondBrainStatus, BrainInstanceStatusMeta> = {
  disabled: { label: 'Выключен', variant: 'neutral', isTransitional: false },
  pending: { label: 'Запускается…', variant: 'info', isTransitional: true },
  running: { label: 'Работает', variant: 'success', isTransitional: false },
  stopping: { label: 'Выключается…', variant: 'warning', isTransitional: true },
  stopped: { label: 'Остановлен', variant: 'warning', isTransitional: true },
  error: { label: 'Ошибка', variant: 'danger', isTransitional: false },
};

/**
 * Maps an instance status to its display label, Badge variant, and whether it
 * is transitional. Falls back to a neutral pill for any unknown status.
 * @param status - the instance status.
 */
export function brainInstanceStatusMeta(
  status: SecondBrainStatus,
): BrainInstanceStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status,
      variant: 'neutral',
      isTransitional: false,
    }
  );
}

/** Human label for the active Claude auth mode (`claude_auth_type`). */
export function claudeAuthTypeLabel(
  type: ClaudeAuthType | null | undefined,
): string {
  if (type === 'oauth') return 'Подписка Claude';
  if (type === 'api_key') return 'API-ключ Anthropic';

  return '—';
}
