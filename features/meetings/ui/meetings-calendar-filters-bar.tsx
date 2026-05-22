'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { getTeamUsers } from '@/entities/team/api/team';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import {
  hasActiveCalendarFilters,
  type MeetingsCalendarFilters,
} from '../model/filters';

import type { TeamProps, TeamUserRecord } from '@/entities/team';
import type { DropdownOption } from '@/shared/ui/input/InputDropdown';

export function MeetingsCalendarFiltersBar({
  filters,
  initialTeams,
}: {
  filters: MeetingsCalendarFilters;
  cookieOrgId: string;
  initialTeams: TeamProps[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [teamUsers, setTeamUsers] = useState<TeamUserRecord[]>([]);
  const [isLoadingTeamUsers, setIsLoadingTeamUsers] = useState(false);

  useEffect(() => {
    if (filters.team_id == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeamUsers([]);
      return;
    }

    let cancelled = false;

    setIsLoadingTeamUsers(true);
    setTeamUsers([]);

    getTeamUsers(filters.team_id)
      .then((users) => {
        if (cancelled) return;
        setTeamUsers(users);
      })
      .catch(() => {
        if (cancelled) return;
        setTeamUsers([]);
        toast.error('Failed to load participants');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTeamUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.team_id]);

  const updateFilter = (key: 'team_id' | 'user_id', value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
      if (key === 'team_id') params.delete('user_id');
    } else {
      params.delete(key);
      if (key === 'team_id') params.delete('user_id');
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const teamOptions: DropdownOption[] = [
    { value: '', label: 'All teams' },
    ...initialTeams.map((t) => {
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

  const userDropdownDisabled =
    isPending || filters.team_id == null || isLoadingTeamUsers;

  return (
    <div className='flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border bg-card'>
      <div className='w-full sm:w-48'>
        <InputDropdown
          label='Team'
          options={teamOptions}
          value={filters.team_id == null ? '' : String(filters.team_id)}
          onChange={(value) => {
            const v = value as string;
            updateFilter('team_id', v);
          }}
          searchable={false}
          disabled={isPending}
        />
      </div>

      <div
        className='w-full sm:w-48'
        title={filters.team_id == null ? 'Select a team first' : undefined}
      >
        <InputDropdown
          label='Participant'
          options={userOptions}
          value={filters.user_id == null ? '' : String(filters.user_id)}
          onChange={(value) => {
            const v = value as string;
            updateFilter('user_id', v);
          }}
          searchable={false}
          disabled={userDropdownDisabled}
        />
      </div>

      {hasActiveCalendarFilters(filters) && (
        <button
          type='button'
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
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
