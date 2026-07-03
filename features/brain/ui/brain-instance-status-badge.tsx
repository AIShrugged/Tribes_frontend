import { Loader2 } from 'lucide-react';

import { brainInstanceStatusMeta } from '@/features/brain/lib/instance-status';
import { Badge } from '@/shared/ui/badge';

import type { SecondBrainStatus } from '@/features/brain/model/types';

interface Props {
  status: SecondBrainStatus;
}

/**
 * Status pill for a second-brain instance. Transitional states (pending /
 * stopping / stopped) show a spinner; stable states show a status dot.
 * @param props - Component props.
 * @param props.status - the instance status.
 */
export function BrainInstanceStatusBadge({ status }: Props) {
  const { label, variant, isTransitional } = brainInstanceStatusMeta(status);

  return (
    <Badge variant={variant} dot={!isTransitional}>
      {isTransitional && (
        <Loader2 className='h-3 w-3 animate-spin' aria-hidden='true' />
      )}
      {label}
    </Badge>
  );
}
