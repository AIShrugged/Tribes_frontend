import { Badge } from '@/shared/ui/badge';

import type { NormalizedUploadStatus } from '@/features/uploads/model/types';

const STATUS_BADGE: Record<
  NormalizedUploadStatus,
  { variant: 'primary' | 'success' | 'destructive'; label: string }
> = {
  processing: { variant: 'primary', label: 'Processing' },
  done: { variant: 'success', label: 'Done' },
  failed: { variant: 'destructive', label: 'Failed' },
};

export function UploadStatusBadge({
  status,
}: {
  status: NormalizedUploadStatus;
}) {
  const config = STATUS_BADGE[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
