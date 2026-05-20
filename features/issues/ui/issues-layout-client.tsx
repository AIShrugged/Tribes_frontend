'use client';

import { SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IssueCreateButton } from '@/features/issues';
import { FiltersContext } from '@/features/issues/model/filters-context';
import { FilterPresetsPanel } from '@/features/issues/ui/filter-presets-panel';
import {
  isIssueStatus,
  isIssueSortField,
  isSortOrder,
  isIssueType,
} from '@/features/issues/model/types';
import { SharedFiltersBar } from '@/features/issues/ui/shared-filters-bar';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';

import type { EpicOption } from '@/entities/issue';
import type { OrganizationProps } from '@/entities/organization';
import type {
  IssueSortField,
  PersonOption,
  SharedFilters,
  SortOrder,
} from '@/features/issues/model/types';

type IssuesLayoutClientProps = React.PropsWithChildren<{
  organizations: OrganizationProps[];
  persons: PersonOption[];
  epics: EpicOption[];
  currentUserId: number | null;
  cookieOrgId: string;
}>;

const KEEP_WHEN_EMPTY = new Set(['assignee_id']);
const STALE_PARAMS = ['assignee'] as const;

/**
 * IssuesLayoutClient — client component that owns filter state and URL sync
 * for the issues section. Provides filters via context to sub-route pages.
 * Filter state is initialized from URL search params on mount.
 */
export function IssuesLayoutClient({
  organizations,
  persons,
  epics,
  currentUserId,
  cookieOrgId,
  children,
}: IssuesLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Lazy state init from URL params — runs only on first render.
  // When assignee_id is absent from URL, default to the current user.
  const [initialFilters] = useState<SharedFilters>(() => {
    const statusRaw = searchParams.get('status') ?? '';
    const typeRaw = searchParams.get('type') ?? '';
    const assigneeIdRaw = searchParams.has('assignee_id')
      ? (searchParams.get('assignee_id') ?? '')
      : (currentUserId?.toString() ?? '');

    return {
      organization_id: searchParams.get('organization_id') ?? cookieOrgId,
      team_id: searchParams.get('team_id') ?? '',
      search: searchParams.get('search') ?? '',
      type: isIssueType(typeRaw) ? typeRaw : '',
      assignee_id: assigneeIdRaw,
      author_id: searchParams.get('author_id') ?? '',
      epic_id: searchParams.get('epic_id') ?? '',
      status: isIssueStatus(statusRaw) ? statusRaw : '',
      show_archived: searchParams.get('show_archived') === '1',
    };
  });

  const [initialSort] = useState<IssueSortField>(() => {
    const raw = searchParams.get('sort') ?? '';

    return isIssueSortField(raw) ? raw : 'created_at';
  });

  const [initialOrder] = useState<SortOrder>(() => {
    const raw = searchParams.get('order') ?? '';

    return isSortOrder(raw) ? raw : 'desc';
  });

  const [filters, setFilters] = useState<SharedFilters>(initialFilters);
  const [filtersVersion, setFiltersVersion] = useState(0);
  const columnsVersionRef = useRef(0);
  const [columnsVersion, setColumnsVersion] = useState(0);
  const isFirstFiltersRender = useRef(true);

  // Mid-render org-change detection: when cookieOrgId prop changes (after router.refresh()
  // delivers new Server Component props), reset org and team filters immediately.
  // columnsVersion is bumped in a useEffect below (refs cannot be written during render).
  const [prevCookieOrgId, setPrevCookieOrgId] = useState(cookieOrgId);
  if (cookieOrgId !== prevCookieOrgId) {
    setPrevCookieOrgId(cookieOrgId);
    setFilters((prev) => {
      return { ...prev, organization_id: cookieOrgId, team_id: '' };
    });
    setFiltersVersion((v) => {
      return v + 1;
    });
  }

  // On mount: remove stale legacy params and write default assignee_id if absent.
  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString());
    let dirty = false;

    for (const stale of STALE_PARAMS) {
      if (current.has(stale)) {
        current.delete(stale);
        dirty = true;
      }
    }

    if (!searchParams.has('assignee_id') && currentUserId !== null) {
      current.set('assignee_id', String(currentUserId));
      dirty = true;
    }

    if (dirty) {
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
    }
  }, []);

  useEffect(() => {
    columnsVersionRef.current += 1;
    setColumnsVersion(columnsVersionRef.current);
  }, [prevCookieOrgId]);

  const updateUrl = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const stale of STALE_PARAMS) {
        params.delete(stale);
      }

      for (const [key, value] of Object.entries(patch)) {
        if (value || KEEP_WHEN_EMPTY.has(key)) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleFiltersChange = useCallback((patch: Partial<SharedFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.type === 'epic' && prev.type !== 'epic') {
        next.epic_id = '';
      }
      return next;
    });
    setFiltersVersion((v) => {
      return v + 1;
    });
    columnsVersionRef.current += 1;
    setColumnsVersion(columnsVersionRef.current);
  }, []);

  const setShowArchived = useCallback((value: boolean) => {
    setFilters((prev) => {
      return { ...prev, show_archived: value };
    });
  }, []);

  const bumpColumnsVersion = useCallback(() => {
    columnsVersionRef.current += 1;
    setColumnsVersion(columnsVersionRef.current);
  }, []);

  useEffect(() => {
    if (isFirstFiltersRender.current) {
      isFirstFiltersRender.current = false;
      return;
    }

    updateUrl({
      organization_id: filters.organization_id,
      team_id: filters.team_id,
      search: filters.search,
      type: filters.type,
      assignee_id: filters.assignee_id,
      author_id: filters.author_id,
      epic_id: filters.epic_id,
      status: filters.status,
      show_archived: filters.show_archived ? '1' : '',
    });
  }, [filters, updateUrl]);

  const contextValue = useMemo(() => {
    return {
      filters,
      filtersVersion,
      columnsVersion,
      initialSort,
      initialOrder,
      setShowArchived,
      bumpColumnsVersion,
      handleFiltersChange,
    };
  }, [
    filters,
    filtersVersion,
    columnsVersion,
    initialSort,
    initialOrder,
    setShowArchived,
    bumpColumnsVersion,
    handleFiltersChange,
  ]);

  return (
    <FiltersContext.Provider value={contextValue}>
      <div className='flex flex-col'>
        <div className='px-2 pt-4 shrink-0'>
          <CollapsibleSection
            label='Filters'
            icon={<SlidersHorizontal className='h-3.5 w-3.5' />}
            extraContent={
              <div className='flex items-center gap-2'>
                <FilterPresetsPanel
                  currentFilters={filters}
                  onApply={handleFiltersChange}
                />
                <IssueCreateButton />
              </div>
            }
          >
            <SharedFiltersBar
              key={filters.organization_id}
              filters={filters}
              organizations={organizations}
              persons={persons}
              epics={epics}
              onChange={handleFiltersChange}
              hasTypeToggle
            />
          </CollapsibleSection>
        </div>

        <div className={'mt-4'}>{children}</div>
      </div>
    </FiltersContext.Provider>
  );
}
