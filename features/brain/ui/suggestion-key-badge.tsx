import { Brain } from 'lucide-react';

import { getKeyMeta } from '@/features/brain/lib/format';
import { Badge } from '@/shared/ui/badge';

interface Props {
  suggestionKey: string;
}

/**
 * Action-type badge (Создание задачи / Смена статуса / Комментарий) with a
 * per-type icon, plus a "Brain" chip marking the source.
 */
export function SuggestionKeyBadge({ suggestionKey }: Props) {
  const { label, icon: Icon } = getKeyMeta(suggestionKey);

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='primary'>
        <Icon className='h-3 w-3' aria-hidden='true' />
        {label}
      </Badge>
      <Badge variant='neutral'>
        <Brain className='h-3 w-3' aria-hidden='true' />
        Brain
      </Badge>
    </div>
  );
}
