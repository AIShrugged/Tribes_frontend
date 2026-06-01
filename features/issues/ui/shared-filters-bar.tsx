'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ISSUE_STATUS_OPTIONS } from '@/features/issues/model/types';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import type { EpicOption } from '@/entities/issue';
import type { OrganizationProps } from '@/entities/organization';
import type {
  IssueStatus,
  PersonOption,
  SharedFilters,
} from '@/features/issues/model/types';

interface SharedFiltersBarProps {
  filters: SharedFilters;
  organizations: OrganizationProps[];
  persons: PersonOption[];
  epics: EpicOption[];
  onChange: (patch: Partial<SharedFilters>) => void;
  disabled?: boolean;
  hasTypeToggle?: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...ISSUE_STATUS_OPTIONS,
];

/**
 * SharedFiltersBar renders the filter controls shared across Tasktracker and Kanban tabs.
 * @param props - component props.
 * @param props.filters - current filter values.
 * @param props.organizations - organizations list.
 * @param props.persons - persons list for assignee dropdown.
 * @param props.onChange - called when any filter changes. Must be a stable reference (useCallback).
 * @param props.disabled - disables all controls when true.
 * @returns JSX element.
 */
export function SharedFiltersBar({
  filters,
  organizations,
  persons,
  epics,
  onChange,
  disabled,
  hasTypeToggle = false,
}: SharedFiltersBarProps) {
  const typeOptions = [
    { value: '', label: 'Any type' },
    { value: 'organization', label: 'Task' },
    { value: 'epic', label: 'Epic' },
  ];

  const [searchValue, setSearchValue] = useState(filters.search);

  // Debounce search: propagate 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ search: searchValue });
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchValue, onChange]);

  const mappedPersons = persons.map((person) => {
    return {
      value: String(person.id),
      label: person.email ? `${person.name} (${person.email})` : person.name,
    };
  });

  const personOptions = [
    { value: '', label: 'All' },
    { value: 'unassigned', label: 'Unassigned' },
    ...mappedPersons,
  ];

  const authorOptions = [{ value: '', label: 'Any author' }, ...mappedPersons];

  const organizationOptions = organizations.map((organization) => {
    return {
      value: String(organization.id),
      label: organization.name,
    };
  });

  const epicOptions = [
    { value: '', label: 'Any epic' },
    ...epics.map((epic) => {
      return { value: String(epic.id), label: epic.name };
    }),
  ];

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            placeholder='Search by name...'
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
            }}
            disabled={disabled}
            className='h-10 w-full rounded-[var(--radius-button)] border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>

        <InputDropdown
          label='Assignee'
          options={personOptions}
          value={filters.assignee_id}
          onChange={(value) => {
            onChange({ assignee_id: value as string });
          }}
          searchable
          disabled={disabled}
        />
      </div>

      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
        <InputDropdown
          label='Organization'
          options={organizationOptions}
          value={filters.organization_id}
          onChange={(value) => {
            onChange({ organization_id: value as string });
          }}
          searchable
          disabled={disabled}
        />
      </div>

      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
        <InputDropdown
          label='Status'
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(value) => {
            onChange({ status: value as IssueStatus | '' });
          }}
          disabled={disabled}
        />
        {!hasTypeToggle && (
          <InputDropdown
            label='Type'
            options={typeOptions}
            value={filters.type}
            onChange={(value) => {
              onChange({ type: value as string });
            }}
            disabled={disabled}
          />
        )}
      </div>

      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
        <InputDropdown
          label='Author'
          options={authorOptions}
          value={filters.author_id}
          onChange={(value) => {
            onChange({ author_id: value as string });
          }}
          searchable
          disabled={disabled}
        />
        <InputDropdown
          label='Epic'
          options={epicOptions}
          value={filters.epic_id}
          onChange={(value) => {
            onChange({ epic_id: value as string });
          }}
          searchable
          disabled={disabled}
        />
      </div>
    </div>
  );
}
