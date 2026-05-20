import { renderHook } from '@testing-library/react';

import {
  FiltersContext,
  useFiltersContext,
} from '@/features/issues/model/filters-context';

import type { FiltersContextValue } from '@/features/issues/model/filters-context';

const defaultValue: FiltersContextValue = {
  filters: {
    organization_id: '',
    team_id: '',
    search: '',
    type: '',
    assignee_id: '',
    author_id: '',
    epic_id: '',
    status: '',
    show_archived: false,
  },
  filtersVersion: 0,
  columnsVersion: 0,
  initialSort: 'created_at',
  initialOrder: 'desc',
  setShowArchived: () => {},
  bumpColumnsVersion: () => {},
  handleFiltersChange: () => {},
};

describe('useFiltersContext', () => {
  it('throws when used outside FiltersContext.Provider', () => {
    expect(() => {
      renderHook(() => {
        return useFiltersContext();
      });
    }).toThrow('useFiltersContext must be used inside IssuesLayoutClient');
  });

  it('returns the context value when inside FiltersContext.Provider', () => {
    const { result } = renderHook(
      () => {
        return useFiltersContext();
      },
      {
        wrapper: ({ children }) => {
          return (
            <FiltersContext.Provider value={defaultValue}>
              {children}
            </FiltersContext.Provider>
          );
        },
      },
    );

    expect(result.current.filtersVersion).toBe(0);
    expect(result.current.initialSort).toBe('created_at');
    expect(result.current.initialOrder).toBe('desc');
  });

  it('reflects updated context value', () => {
    const custom: FiltersContextValue = {
      ...defaultValue,
      filtersVersion: 5,
      initialSort: 'name',
      initialOrder: 'asc',
    };

    const { result } = renderHook(
      () => {
        return useFiltersContext();
      },
      {
        wrapper: ({ children }) => {
          return (
            <FiltersContext.Provider value={custom}>
              {children}
            </FiltersContext.Provider>
          );
        },
      },
    );

    expect(result.current.filtersVersion).toBe(5);
    expect(result.current.initialSort).toBe('name');
    expect(result.current.initialOrder).toBe('asc');
  });
});
