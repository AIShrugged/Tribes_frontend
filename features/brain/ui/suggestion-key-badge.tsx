import { Brain } from 'lucide-react';

import { getKeyLabel } from '@/features/brain/lib/format';
import { Badge } from '@/shared/ui/badge';

interface Props {
  suggestionKey: string;
}

/** Action-type badge (Создание задачи / Смена статуса) plus a "Brain" chip. */
export function SuggestionKeyBadge({ suggestionKey }: Props) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='primary'>{getKeyLabel(suggestionKey)}</Badge>
      <Badge variant='neutral'>
        <Brain className='h-3 w-3' aria-hidden='true' />
        Brain
      </Badge>
    </div>
  );
}
