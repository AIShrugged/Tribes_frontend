'use client';

import { useEffect, useRef, useState } from 'react';

import { useFiltersContext } from '@/features/issues/model/filters-context';
import { IssueTypeToggle } from '@/features/issues/ui/issue-type-toggle';
import { KanbanBoard, fetchKanbanIssues } from '@/features/kanban';

import type { OrganizationProps } from '@/entities/organization';
import type { IssueStatus, PersonOption } from '@/features/issues/model/types';
import type { KanbanCard, KanbanIssuesResult } from '@/features/kanban';

interface IssuesKanbanTabProps {
  initialResult: KanbanIssuesResult;
  organizations: OrganizationProps[];
  persons: PersonOption[];
}

/**
 * IssuesKanbanTab — client wrapper that reads filter context and renders KanbanBoard.
 * Refetches kanban data client-side when filters change.
 */
export function IssuesKanbanTab({
  initialResult,
  organizations,
  persons,
}: IssuesKanbanTabProps) {
  const {
    filters,
    filtersVersion,
    columnsVersion,
    setShowArchived,
    handleFiltersChange,
  } = useFiltersContext();
  const [columns, setColumns] = useState<Record<IssueStatus, KanbanCard[]>>(
    initialResult.columns,
  );
  const [isTruncated, setIsTruncated] = useState(initialResult.isTruncated);
  // Skip the first render only when SSR already provided data (full-page load).
  // On tab navigation initialColumns is empty, so we fetch immediately.
  const hasInitialData = Object.values(initialResult.columns).some((col) => {
    return col.length > 0;
  });
  const isFirstRender = useRef(hasInitialData);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let cancelled = false;

    const run = async () => {
      // author_id and epic_id are visible in the filter bar but not forwarded here —
      // the kanban API does not yet support these params (see issue #018).
      const result = await fetchKanbanIssues({
        organization_id: filters.organization_id
          ? Number(filters.organization_id)
          : null,
        team_id: filters.team_id ? Number(filters.team_id) : null,
        type: filters.type || undefined,
        assignee_id:
          filters.assignee_id && filters.assignee_id !== 'unassigned'
            ? Number(filters.assignee_id)
            : null,
        unassigned: filters.assignee_id === 'unassigned',
        search: filters.search || undefined,
      });

      if (cancelled) return;

      if (!result.error && result.data) {
        setColumns(result.data.columns);
        setIsTruncated(result.data.isTruncated);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filtersVersion, columnsVersion]);

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
      {isTruncated && (
        <div className='mx-2 mb-2 rounded-[var(--radius-card)] border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400'>
          Some issues are not shown — there are more than 500 open issues. Use
          filters to narrow the view.
        </div>
      )}
      <KanbanBoard
        columns={columns}
        organizations={organizations}
        persons={persons}
        filters={filters}
        onShowArchivedChange={setShowArchived}
      />
    </>
  );
}
