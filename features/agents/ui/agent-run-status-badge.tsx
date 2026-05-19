import { Badge } from '@/shared/ui/badge';

function getVariant(
  status: string,
): React.ComponentProps<typeof Badge>['variant'] {
  const normalized = status.toLowerCase();

  if (normalized === 'completed' || normalized === 'success') return 'success';

  if (normalized === 'failed' || normalized === 'error') return 'destructive';

  if (normalized === 'processing' || normalized === 'running') return 'warning';

  return 'default';
}

interface AgentRunStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

/**
 * AgentRunStatusBadge — canonical status badge for agent task runs.
 * Accepts loose string status from the backend (normalized internally).
 * @param props - Component props.
 * @param props.status - Agent run status string.
 * @param props.className - Optional additional class names.
 */
export function AgentRunStatusBadge({
  status,
  className,
}: AgentRunStatusBadgeProps) {
  if (!status) return null;

  return (
    <Badge variant={getVariant(status)} className={className}>
      {status}
    </Badge>
  );
}
