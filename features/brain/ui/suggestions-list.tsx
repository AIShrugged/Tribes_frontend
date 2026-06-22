'use client';

import { Inbox, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { getBrainSuggestions } from '@/features/brain/api/suggestions';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

import { BrainFilterPills } from './brain-filter-pills';
import { SuggestionCard } from './suggestion-card';

import type { FilterOption } from './brain-filter-pills';
import type {
  BrainOrgOption,
  BrainSuggestion,
  SuggestionStatusFilter,
} from '@/features/brain/model/types';
import type { ReactNode } from 'react';

const STATUS_FILTERS: readonly FilterOption<SuggestionStatusFilter>[] = [
  { value: 'pending', label: 'Ожидают' },
  { value: 'applied', label: 'Применённые' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'all', label: 'Все' },
];

const KEY_FILTERS: readonly FilterOption<string>[] = [
  { value: '', label: 'Все типы' },
  { value: 'create_issue', label: 'Создание задачи' },
  { value: 'update_task_status', label: 'Смена статуса' },
];

interface Props {
  initialItems: BrainSuggestion[];
  initialTotalCount: number;
  organizations: BrainOrgOption[];
}

interface QueryState {
  status: SuggestionStatusFilter;
  key: string;
  orgId: number | undefined;
}

/**
 * The suggestions inbox: status/key/org filters, manual refresh, paginated
 * cards. Approve/reject happen per-card; the list updates the resolved row in
 * place and refetches on a 409 conflict.
 * @param root0 - props.
 * @param root0.initialItems - SSR-loaded pending suggestions.
 * @param root0.initialTotalCount - total pending count from the Items-Count header.
 * @param root0.organizations - managed orgs for the optional org filter.
 */
export function SuggestionsList({
  initialItems,
  initialTotalCount,
  organizations,
}: Props) {
  const [items, setItems] = useState<BrainSuggestion[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [status, setStatus] = useState<SuggestionStatusFilter>('pending');
  const [key, setKey] = useState('');
  const [orgId, setOrgId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(
    initialItems.length < initialTotalCount,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const runQuery = useCallback(async (next: QueryState) => {
    setIsLoading(true);
    setStatus(next.status);
    setKey(next.key);
    setOrgId(next.orgId);

    try {
      const result = await getBrainSuggestions({
        status: next.status,
        key: next.key || undefined,
        organizationId: next.orgId,
        page: 1,
      });

      setItems(result.data);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setPage(1);
    } catch {
      toast.error('Не удалось загрузить предложения');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const result = await getBrainSuggestions({
        status,
        key: key || undefined,
        organizationId: orgId,
        page: nextPage,
      });

      setItems((prev) => {
        return [...prev, ...result.data];
      });
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch {
      toast.error('Не удалось загрузить ещё');
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, status, key, orgId]);

  // Keep the resolved card visible (with its applied/failed result) but reflect
  // the new status; the row drops out of the pending view on the next refresh.
  const handleResolved = useCallback((updated: BrainSuggestion) => {
    setItems((prev) => {
      return prev.map((item) => {
        return item.id === updated.id ? updated : item;
      });
    });
  }, []);

  const handleConflict = useCallback(() => {
    runQuery({ status, key, orgId });
  }, [runQuery, status, key, orgId]);

  const showInitialSkeleton = isLoading && items.length === 0;

  let content: ReactNode;

  if (showInitialSkeleton) {
    content = <SkeletonList rows={4} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={Inbox}
        title='Пока нет предложений'
        description='Когда «второй мозг» предложит действие, оно появится здесь для подтверждения.'
      />
    );
  } else {
    content = (
      <div className='flex flex-col gap-4'>
        {items.map((item) => {
          return (
            <SuggestionCard
              key={item.id}
              suggestion={item}
              onResolved={handleResolved}
              onConflict={handleConflict}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-[var(--muted-foreground)]'>
          {status === 'pending'
            ? `Ожидают решения: ${totalCount}`
            : `Всего: ${totalCount}`}
        </p>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          fullWidth={false}
          loading={isLoading}
          loadingText='Обновляем…'
          leftIcon={<RefreshCw className='h-4 w-4' aria-hidden='true' />}
          onClick={() => {
            runQuery({ status, key, orgId });
          }}
        >
          Обновить
        </Button>
      </div>

      <div className='flex flex-col gap-3'>
        <BrainFilterPills
          options={STATUS_FILTERS}
          value={status}
          disabled={isLoading}
          ariaLabel='Фильтр по статусу'
          onChange={(value) => {
            runQuery({ status: value, key, orgId });
          }}
        />
        <BrainFilterPills
          options={KEY_FILTERS}
          value={key}
          disabled={isLoading}
          ariaLabel='Фильтр по типу действия'
          onChange={(value) => {
            runQuery({ status, key: value, orgId });
          }}
        />
        {organizations.length > 1 && (
          <select
            value={orgId ?? ''}
            disabled={isLoading}
            aria-label='Фильтр по организации'
            onChange={(event) => {
              const value = event.target.value;
              runQuery({
                status,
                key,
                orgId: value ? Number(value) : undefined,
              });
            }}
            className='w-fit rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
          >
            <option value=''>Все организации</option>
            {organizations.map((organization) => {
              return (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {content}

      {hasMore && items.length > 0 && (
        <div className='flex justify-center pt-2'>
          <Button
            type='button'
            variant='secondary'
            fullWidth={false}
            loading={isLoadingMore}
            loadingText='Загружаем…'
            onClick={loadMore}
          >
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  );
}
