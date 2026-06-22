import { getStatusMeta } from '@/features/brain/lib/format';
import { Badge } from '@/shared/ui/badge';

interface Props {
  status: string;
}

/** Status pill for a suggestion (pending/applied/rejected/failed/…). */
export function SuggestionStatusBadge({ status }: Props) {
  const { label, variant } = getStatusMeta(status);

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
