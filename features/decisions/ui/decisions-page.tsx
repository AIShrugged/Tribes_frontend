'use client';

import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { getDecisions } from '@/features/decisions/api/decisions';
import { AddDecisionModal } from '@/features/decisions/ui/add-decision-modal';
import { DecisionDetailModal } from '@/features/decisions/ui/decision-detail-modal';
import { DecisionsTable } from '@/features/decisions/ui/decisions-table';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import type {
  Decision,
  DecisionFilters,
  DecisionSourceType,
} from '@/features/decisions/model/types';

const PAGE_SIZE = 20;

export function DecisionsPage({
  teamId,
  sourceTypeFilter,
}: {
  teamId: number;
  sourceTypeFilter?: DecisionSourceType | null;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(
    null,
  );

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [totalDecisions, setTotalDecisions] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, startLoadingMore] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filters: DecisionFilters = {
    source_type: sourceTypeFilter ?? null,
    search: debouncedSearch || null,
  };

  const loadGenRef = useRef(0);

  const loadInitial = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setIsLoading(true);
    try {
      const result = await getDecisions(teamId, filters, 0, PAGE_SIZE);
      if (gen !== loadGenRef.current) return;
      setDecisions(result.data ?? []);
      setTotalDecisions(result.totalCount);
    } catch {
      if (gen !== loadGenRef.current) return;
      toast.error('Failed to load data');
    } finally {
      if (gen === loadGenRef.current) setIsLoading(false);
    }
  }, [teamId, debouncedSearch, sourceTypeFilter]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      return clearTimeout(timer);
    };
  }, [search]);

  const hasMoreDecisions = decisions.length < totalDecisions;

  const loadMore = useCallback(() => {
    if (!hasMoreDecisions || isLoadingMore) return;

    startLoadingMore(async () => {
      try {
        const result = await getDecisions(
          teamId,
          filters,
          decisions.length,
          PAGE_SIZE,
        );
        setDecisions((prev) => {
          return [...prev, ...(result.data ?? [])];
        });
      } catch {
        toast.error('Failed to load more decisions');
      }
    });
  }, [
    teamId,
    decisions.length,
    hasMoreDecisions,
    isLoadingMore,
    debouncedSearch,
    sourceTypeFilter,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreDecisions && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '40px' },
    );

    observer.observe(el);

    return () => {
      return observer.disconnect();
    };
  }, [hasMoreDecisions, isLoadingMore, loadMore]);

  const isEmpty = decisions.length === 0;

  return (
    <div className='flex flex-col gap-6'>
      {/* Toolbar */}
      <CollapsibleSection
        label='Filters'
        icon={<SlidersHorizontal className='h-3.5 w-3.5' />}
        extraContent={
          <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
            <Button
              variant={BUTTON_VARIANT.primary}
              onClick={() => {
                return setIsModalOpen(true);
              }}
              className='flex items-center gap-1.5'
            >
              <Plus className='w-4 h-4' />
              Add decision
            </Button>
          </div>
        }
      >
        <div className='relative mb-2'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
          <input
            type='text'
            placeholder='Search decisions…'
            value={search}
            onChange={(e) => {
              return setSearch(e.target.value);
            }}
            className='h-10 w-full rounded-[var(--radius-button)] border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>
      </CollapsibleSection>

      {/* Loading state */}
      {isLoading && (
        <div className='flex flex-col gap-3'>
          {Array.from({ length: 6 }).map((_, i) => {
            return (
              <Skeleton key={i} className='h-10 rounded-[var(--radius-card)]' />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <p className='text-muted-foreground text-sm text-center py-16'>
          {debouncedSearch
            ? `Nothing found for "${debouncedSearch}"`
            : 'No decisions yet.'}
        </p>
      )}

      {/* Decisions section */}
      {!isLoading && decisions.length > 0 && (
        <section className='flex flex-col gap-3'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-foreground'>Decisions</h3>
            <span className='text-xs text-muted-foreground'>
              {totalDecisions} total
            </span>
          </div>
          <DecisionsTable
            decisions={decisions}
            onRowClick={setSelectedDecision}
          />
          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className='flex justify-center py-4'>
              <Skeleton className='h-8 w-32 rounded' />
            </div>
          )}
        </section>
      )}

      <AddDecisionModal
        teamId={teamId}
        isOpen={isModalOpen}
        onClose={() => {
          return setIsModalOpen(false);
        }}
        onCreated={() => {
          return void loadInitial();
        }}
      />

      <DecisionDetailModal
        decision={selectedDecision}
        onClose={() => {
          return setSelectedDecision(null);
        }}
      />
    </div>
  );
}
