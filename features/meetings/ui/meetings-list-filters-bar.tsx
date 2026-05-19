'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { getTeams, getTeamUsers } from '@/features/teams/api/team';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import {
  hasActiveFilters,
  type MeetingScope,
  type MeetingsListFilters,
} from '../model/filters';

import type { OrganizationProps } from '@/entities/organization';
import type { TeamProps, TeamUserRecord } from '@/entities/team';
import type { DropdownOption } from '@/shared/ui/input/InputDropdown';

interface Props {
  filters: MeetingsListFilters;
  organizations: OrganizationProps[];
}

const SCOPE_OPTIONS: DropdownOption[] = [
  { value: 'all', label: 'All meetings' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

export function MeetingsListFiltersBar({ filters, organizations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const defaultOrgId =
    organizations[0]?.id == null ? '' : String(organizations[0].id);
  const [organizationId, setOrganizationId] = useState<string>(defaultOrgId);
  const [teams, setTeams] = useState<TeamProps[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUserRecord[]>([]);

  useEffect(() => {
    if (!organizationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeams([]);
      return;
    }

    let cancelled = false;

    getTeams(organizationId)
      .then((res) => {
        if (cancelled) return;
        setTeams(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (filters.team_id == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeamUsers([]);
      return;
    }

    let cancelled = false;

    getTeamUsers(filters.team_id)
      .then((users) => {
        if (cancelled) return;
        setTeamUsers(users);
      })
      .catch(() => {
        if (cancelled) return;
        setTeamUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.team_id]);

  const updateFilter = (next: Partial<MeetingsListFilters>) => {
    const params = new URLSearchParams(searchParams.toString());

    const merged: MeetingsListFilters = { ...filters, ...next };

    if (merged.scope === 'all') {
      params.delete('scope');
    } else {
      params.set('scope', merged.scope);
    }

    if (merged.team_id == null) {
      params.delete('team_id');
    } else {
      params.set('team_id', String(merged.team_id));
    }

    if (merged.user_id == null) {
      params.delete('user_id');
    } else {
      params.set('user_id', String(merged.user_id));
    }

    // Drop date param when entering filtered mode — the 3-day window logic
    // does not apply to a filtered list view.
    if (hasActiveFilters(merged)) {
      params.delete('date');
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const teamOptions: DropdownOption[] = [
    { value: '', label: 'All teams' },
    ...teams.map((t) => {
      return { value: String(t.id), label: t.name };
    }),
  ];

  const userOptions: DropdownOption[] = [
    { value: '', label: 'All participants' },
    ...teamUsers.map((tu) => {
      return {
        value: String(tu.user.id),
        label: tu.user.name || tu.user.email,
      };
    }),
  ];

  const orgOptions: DropdownOption[] = organizations.map((o) => {
    return {
      value: String(o.id),
      label: o.name,
    };
  });

  const showClear = hasActiveFilters(filters);

  const userDropdownDisabled =
    isPending || filters.team_id == null || teamUsers.length === 0;

  return (
    <div className='flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border bg-card'>
      <div className='w-44'>
        <InputDropdown
          label='Scope'
          options={SCOPE_OPTIONS}
          value={filters.scope}
          onChange={(value) => {
            return updateFilter({ scope: value as MeetingScope });
          }}
          searchable={false}
          disabled={isPending}
        />
      </div>

      {organizations.length > 1 && (
        <div className='w-56'>
          <InputDropdown
            label='Organization'
            options={orgOptions}
            value={organizationId}
            onChange={(value) => {
              return setOrganizationId(value as string);
            }}
            disabled={isPending}
          />
        </div>
      )}

      <div className='w-56'>
        <InputDropdown
          label='Team'
          options={teamOptions}
          value={filters.team_id == null ? '' : String(filters.team_id)}
          onChange={(value) => {
            const v = value as string;
            updateFilter({
              team_id: v === '' ? null : Number(v),
              user_id: null,
            });
          }}
          disabled={isPending || teams.length === 0}
        />
      </div>

      <div className='w-56'>
        <InputDropdown
          label='Participant'
          options={userOptions}
          value={filters.user_id == null ? '' : String(filters.user_id)}
          onChange={(value) => {
            const v = value as string;
            updateFilter({ user_id: v === '' ? null : Number(v) });
          }}
          disabled={userDropdownDisabled}
        />
      </div>

      {showClear && (
        <button
          type='button'
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('scope');
            params.delete('team_id');
            params.delete('user_id');
            startTransition(() => {
              router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
              });
            });
          }}
          className='text-sm text-muted-foreground hover:text-foreground transition-colors h-10 px-3'
          disabled={isPending}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
