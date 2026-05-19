'use client';

import { createContext, useContext } from 'react';

import type {
  IssueSortField,
  SharedFilters,
  SortOrder,
} from '@/features/issues/model/types';

export interface FiltersContextValue {
  filters: SharedFilters;
  filtersVersion: number;
  columnsVersion: number;
  initialSort: IssueSortField;
  initialOrder: SortOrder;
  setShowArchived: (value: boolean) => void;
  bumpColumnsVersion: () => void;
  handleFiltersChange: (patch: Partial<SharedFilters>) => void;
}

export const FiltersContext = createContext<FiltersContextValue | null>(null);

/**
 * useFiltersContext — consume shared filter state from IssuesLayoutClient.
 * Must be used inside IssuesLayoutClient.
 */
export function useFiltersContext(): FiltersContextValue {
  const ctx = useContext(FiltersContext);

  if (!ctx) {
    throw new Error('useFiltersContext must be used inside IssuesLayoutClient');
  }

  return ctx;
}
