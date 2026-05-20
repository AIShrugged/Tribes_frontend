'use client';

import { useFiltersContext } from '@/features/issues/model/filters-context';
import { IssueTypeToggle } from '@/features/issues/ui/issue-type-toggle';
import { IssuesPage } from '@/features/issues/ui/issues-page';

import type { Issue, PersonOption } from '@/features/issues/model/types';

interface IssuesListTabProps {
  initialIssues: Issue[];
  initialTotalCount: number;
  persons: PersonOption[];
}

export function IssuesListTab({
  initialIssues,
  initialTotalCount,
  persons,
}: IssuesListTabProps) {
  const {
    filters,
    filtersVersion,
    initialSort,
    initialOrder,
    setShowArchived,
    handleFiltersChange,
  } = useFiltersContext();

  const toggleType =
    filters.type === 'epic' || filters.type === 'task' ? filters.type : '';

  return (
    <>
      <div className='px-2 mb-3'>
        <IssueTypeToggle
          value={toggleType as '' | 'epic' | 'task'}
          onChange={(val) => {
            return handleFiltersChange({ type: val });
          }}
        />
      </div>
      <IssuesPage
        initialIssues={initialIssues}
        initialTotalCount={initialTotalCount}
        persons={persons}
        filters={filters}
        filtersVersion={filtersVersion}
        initialSort={initialSort}
        initialOrder={initialOrder}
        onShowArchivedChange={setShowArchived}
      />
    </>
  );
}
