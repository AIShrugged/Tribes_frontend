import { render, screen, waitFor } from '@testing-library/react';

import { MeetingsCalendarFiltersBar } from '@/features/meetings/ui/meetings-calendar-filters-bar';

import type { TeamProps } from '@/entities/team';

const TEAM_API_MODULE = '@/entities/team/api/team';
const TOOLTIP_SELECT_TEAM = 'Select a team first';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: jest.fn(), replace: mockReplace };
    },
    usePathname: () => {
      return '/dashboard/meetings/calendar';
    },
    useSearchParams: () => {
      return {
        toString: () => {
          return 'month=2026-05-01';
        },
        get: jest.fn(),
      };
    },
  };
});

jest.mock('@/entities/team/api/team', () => {
  return {
    getTeamUsers: jest.fn(),
  };
});

jest.mock('sonner', () => {
  return {
    toast: {
      error: jest.fn(),
      success: jest.fn(),
    },
  };
});

const TEAMS: TeamProps[] = [
  {
    id: 1,
    name: 'Alpha',
    slug: 'alpha',
    is_default: false,
    employee_count: 0,
  },
  {
    id: 2,
    name: 'Beta',
    slug: 'beta',
    is_default: false,
    employee_count: 0,
  },
];

const TEAM_USERS = [
  {
    id: 11,
    team_id: 1,
    user: { id: 101, name: 'Alice', email: 'alice@example.com' },
  },
  {
    id: 12,
    team_id: 1,
    user: { id: 102, name: 'Bob', email: 'bob@example.com' },
  },
];

const DEFAULT_FILTERS = { team_id: null, user_id: null } as const;

function renderBar(
  filters: { team_id: number | null; user_id: number | null } = DEFAULT_FILTERS,
) {
  return render(
    <MeetingsCalendarFiltersBar
      filters={filters}
      cookieOrgId='10'
      initialTeams={TEAMS}
    />,
  );
}

async function waitForParticipantsIdle() {
  await waitFor(() => {
    expect(screen.getAllByRole('combobox')[1]).not.toHaveClass('opacity-60');
  });
}

describe('MeetingsCalendarFiltersBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getTeamUsers } = jest.requireMock(TEAM_API_MODULE);
    getTeamUsers.mockResolvedValue(TEAM_USERS);
  });

  it('renders two combobox dropdowns (Team and Participant)', () => {
    renderBar();

    const dropdowns = screen.getAllByRole('combobox');

    expect(dropdowns).toHaveLength(2);
  });

  it('shows "Select a team first" tooltip on Participant wrapper when no team selected', () => {
    renderBar({ team_id: null, user_id: null });

    expect(screen.getByTitle(TOOLTIP_SELECT_TEAM)).toBeInTheDocument();
  });

  it('calls getTeamUsers when team_id is set', async () => {
    const { getTeamUsers } = jest.requireMock(TEAM_API_MODULE);

    renderBar({ team_id: 1, user_id: null });

    await waitFor(() => {
      expect(getTeamUsers).toHaveBeenCalledWith(1);
    });
    await waitForParticipantsIdle();
  });

  it('removes "Select a team first" tooltip after team_id is set', async () => {
    renderBar({ team_id: 1, user_id: null });

    await waitForParticipantsIdle();
    expect(screen.queryByTitle(TOOLTIP_SELECT_TEAM)).not.toBeInTheDocument();
  });

  it('shows Clear filters button when team_id is active', async () => {
    renderBar({ team_id: 1, user_id: null });

    expect(
      screen.getByRole('button', { name: 'Clear filters' }),
    ).toBeInTheDocument();
    await waitForParticipantsIdle();
  });

  it('hides Clear filters button when no active filters', () => {
    renderBar({ team_id: null, user_id: null });

    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument();
  });

  it('shows Clear filters button when user_id is active', async () => {
    renderBar({ team_id: 1, user_id: 101 });

    expect(
      screen.getByRole('button', { name: 'Clear filters' }),
    ).toBeInTheDocument();
    await waitForParticipantsIdle();
  });

  it('calls toast.error when getTeamUsers rejects', async () => {
    const { getTeamUsers } = jest.requireMock(TEAM_API_MODULE);
    const { toast } = jest.requireMock('sonner');

    getTeamUsers.mockRejectedValueOnce(new Error('Network error'));

    renderBar({ team_id: 1, user_id: null });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load participants');
    });
    await waitForParticipantsIdle();
  });

  it('restores "Select a team first" tooltip when team_id becomes null', async () => {
    const { rerender } = renderBar({ team_id: 1, user_id: null });

    await waitForParticipantsIdle();
    expect(screen.queryByTitle(TOOLTIP_SELECT_TEAM)).not.toBeInTheDocument();

    rerender(
      <MeetingsCalendarFiltersBar
        filters={{ team_id: null, user_id: null }}
        cookieOrgId='10'
        initialTeams={TEAMS}
      />,
    );

    expect(screen.getByTitle(TOOLTIP_SELECT_TEAM)).toBeInTheDocument();
  });
});
