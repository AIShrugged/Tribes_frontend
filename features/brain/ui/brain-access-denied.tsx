import { ShieldX } from 'lucide-react';

import { EmptyState } from '@/shared/ui/feedback/empty-state';

/**
 * Locked state shown when the current user manages no organization — the
 * second-brain endpoints are manager-only and return 403 otherwise.
 */
export function BrainAccessDenied() {
  return (
    <EmptyState
      icon={ShieldX}
      title='Доступно менеджерам организации'
      description='Раздел доступен только менеджерам организации. Обратитесь к администратору, если считаете, что доступ должен быть открыт.'
    />
  );
}
