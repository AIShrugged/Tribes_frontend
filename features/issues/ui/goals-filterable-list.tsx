'use client';

import clsx from 'clsx';
import { Target } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import { isGoalsFilter } from '@/features/issues/model/goals-summary';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import type { GoalsFilter } from '@/features/issues/model/goals-summary';
import type { ReactNode } from 'react';

export interface GoalsListItem {
  id: number;
  name: string;
  node: ReactNode;
}

const CHIPS: { key: GoalsFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'overdue', label: 'Overdue' },
];

interface GoalsFilterableListProps {
  summary: ReactNode;
  counts: Record<GoalsFilter, number>;
  items: GoalsListItem[];
  unlinked: ReactNode;
}

interface FilterChipsProps {
  active: GoalsFilter;
  counts: Record<GoalsFilter, number>;
  disabled: boolean;
  onSelect: (next: GoalsFilter) => void;
}

/**
 * buildFilterQuery — merges the chip filter into the current query string.
 * @param current - current search params string.
 * @param next - selected filter.
 * @returns the next query string.
 */
function buildFilterQuery(current: string, next: GoalsFilter): string {
  const params = new URLSearchParams(current);

  if (next === 'all') {
    params.delete('filter');
  } else {
    params.set('filter', next);
  }

  return params.toString();
}

/**
 * FilterChips — the All/Mine/Overdue chip row.
 * @param props - Component props.
 * @param props.active - currently active filter.
 * @param props.counts - per-chip counts.
 * @param props.disabled - whether a navigation is in flight.
 * @param props.onSelect - chip select handler.
 * @returns JSX element.
 */
function FilterChips({ active, counts, disabled, onSelect }: FilterChipsProps) {
  return (
    <>
      {CHIPS.map((chip) => {
        const isActive = active === chip.key;

        return (
          <button
            key={chip.key}
            type='button'
            onClick={() => {
              return onSelect(chip.key);
            }}
            disabled={disabled}
            aria-pressed={isActive}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              isActive
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-soft-text)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              disabled && 'opacity-60',
            )}
          >
            {chip.label} · {counts[chip.key].toString()}
          </button>
        );
      })}
    </>
  );
}

/**
 * GoalsFilterableList — client island holding the summary strip, filter chips
 * (URL-driven via ?filter=), client-side text search, and the (already
 * chip-filtered) epic cards. Text search filters in memory to avoid re-fetching
 * the whole card tree on every keystroke.
 * @param props - Component props.
 * @param props.summary - server-rendered summary strip node.
 * @param props.counts - chip counts over ALL epics.
 * @param props.items - chip-filtered epic cards.
 * @param props.unlinked - unlinked-tasks node (null when hidden by chip filter).
 * @returns JSX element.
 */
export function GoalsFilterableList({
  summary,
  counts,
  items,
  unlinked,
}: GoalsFilterableListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const rawFilter = searchParams.get('filter') ?? undefined;
  const activeFilter: GoalsFilter = isGoalsFilter(rawFilter)
    ? rawFilter
    : 'all';

  const setFilter = (next: GoalsFilter) => {
    const nextQuery = buildFilterQuery(searchParams.toString(), next);

    startTransition(() => {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    });
  };

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? items.filter((item) => {
        return item.name.toLowerCase().includes(trimmed);
      })
    : items;

  const isFiltering = trimmed !== '' || activeFilter !== 'all';
  const emptyTitle = isFiltering ? 'No goals match' : 'No open goals yet';
  const emptyDescription = isFiltering
    ? 'Try a different filter or search term.'
    : 'Create an epic to start tracking team goals.';

  return (
    <div className='space-y-4'>
      {summary}

      <div className='flex flex-wrap items-center gap-2'>
        <FilterChips
          active={activeFilter}
          counts={counts}
          disabled={isPending}
          onSelect={setFilter}
        />

        <input
          type='search'
          value={query}
          onChange={(e) => {
            return setQuery(e.target.value);
          }}
          placeholder='Search goals…'
          aria-label='Search goals'
          className='ml-auto w-48 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]'
        />
      </div>

      {visible.length > 0 ? (
        <div className='space-y-4'>
          {visible.map((item) => {
            return <div key={item.id}>{item.node}</div>;
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}

      {trimmed === '' && unlinked}
    </div>
  );
}
