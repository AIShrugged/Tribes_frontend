'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getTeams } from '@/entities/team/api/team';
import {
  ISSUE_STATUS_OPTIONS,
  issueTypeOptionsFromOrgs,
} from '@/features/issues/model/types';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';
import { TenantScopeFields } from '@/shared/ui/input/tenant-scope-fields';

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
 * @param props.onChange - called when any filter changes.
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
    ...issueTypeOptionsFromOrgs(organizations),
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
  }, [searchValue]);

  const personOptions = [
    { value: '', label: 'All' },
    { value: 'unassigned', label: 'Unassigned' },
    ...persons.map((person) => {
      return {
        value: String(person.id),
        label: person.email ? `${person.name} (${person.email})` : person.name,
      };
    }),
  ];

  const authorOptions = [
    { value: '', label: 'Any author' },
    ...persons.map((person) => {
      return {
        value: String(person.id),
        label: person.email ? `${person.name} (${person.email})` : person.name,
      };
    }),
  ];

  const epicOptions = [
    { value: '', label: 'Any epic' },
    ...epics.map((epic) => {
      return { value: String(epic.id), label: epic.name };
    }),
  ];

  const hasAdvancedFilters =
    filters.author_id.length > 0 || filters.epic_id.length > 0;

  const advancedIndicator = hasAdvancedFilters ? (
    <span className='h-1.5 w-1.5 rounded-full bg-primary' />
  ) : null;

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

      <TenantScopeFields
        organizations={organizations}
        organizationId={filters.organization_id}
        teamId={filters.team_id}
        fetchTeams={getTeams}
        onOrganizationChange={(value) => {
          onChange({ organization_id: value, team_id: '' });
        }}
        onTeamChange={(value) => {
          onChange({ team_id: value });
        }}
        disabled={disabled}
      />

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

      <CollapsibleSection
        label='Advanced filters'
        defaultOpen={hasAdvancedFilters}
        extraContent={advancedIndicator}
      >
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
      </CollapsibleSection>
    </div>
  );
}
