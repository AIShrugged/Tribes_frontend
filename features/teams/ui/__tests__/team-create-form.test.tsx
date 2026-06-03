import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TeamCreateForm from '@/features/teams/ui/team-create-form';

import type { TeamProps } from '@/entities/team';

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: mockPush, back: jest.fn() };
    },
  };
});

jest.mock('sonner', () => {
  return {
    toast: { success: jest.fn(), error: jest.fn() },
  };
});

const mockCreateTeam = jest.fn().mockResolvedValue({ data: { id: 1 } });
const mockUpdateTeam = jest.fn().mockResolvedValue({ data: {} });
const mockPush = jest.fn();

jest.mock('@/features/teams/api/team', () => {
  return {
    createTeam: (...args: unknown[]) => {
      return mockCreateTeam(...args);
    },
    updateTeam: (...args: unknown[]) => {
      return mockUpdateTeam(...args);
    },
  };
});

const blankTeam = {
  id: 0,
  name: '',
  slug: '',
  is_default: false,
  employee_count: 0,
  members: [],
} as TeamProps;
const existingTeam: TeamProps = {
  id: 42,
  name: 'Engineering',
  slug: 'engineering',
  is_default: false,
  employee_count: 3,
  members: [],
};
const user = userEvent.setup({ delay: null });

describe('TeamCreateForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTeam.mockResolvedValue({ data: { id: 1 } });
    mockUpdateTeam.mockResolvedValue({ data: {} });
  });
  it('renders the name input', () => {
    render(<TeamCreateForm values={blankTeam} organization_id='1' />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders "Save" submit button', () => {
    render(<TeamCreateForm values={blankTeam} organization_id='1' />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('pre-fills name for existing team', () => {
    render(<TeamCreateForm values={existingTeam} organization_id='1' />);
    expect(screen.getByRole('textbox')).toHaveValue('Engineering');
  });

  it('submit button is disabled when form is not dirty for edit', () => {
    render(<TeamCreateForm values={existingTeam} organization_id='1' />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables submit button after user edits name', async () => {
    render(<TeamCreateForm values={blankTeam} organization_id='1' />);
    await user.type(screen.getByRole('textbox'), 'New Team');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls createTeam and navigates on successful create', async () => {
    render(<TeamCreateForm values={blankTeam} organization_id='org-5' />);
    await user.type(screen.getByRole('textbox'), 'New Team');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(mockCreateTeam).toHaveBeenCalledWith(
        'org-5',
        expect.objectContaining({ name: 'New Team' }),
      );
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/teams'));
    });
  });

  it('shows error toast when createTeam returns result.error', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { error: jest.Mock };
    };

    mockCreateTeam.mockResolvedValue({ error: 'Name already taken' });
    render(<TeamCreateForm values={blankTeam} organization_id='1' />);
    await user.type(screen.getByRole('textbox'), 'Dup Team');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Name already taken');
    });
  });

  it('shows error toast when createTeam throws', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { error: jest.Mock };
    };

    mockCreateTeam.mockRejectedValue(new Error('Network failure'));
    render(<TeamCreateForm values={blankTeam} organization_id='1' />);
    await user.type(screen.getByRole('textbox'), 'Fail Team');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network failure');
    });
  });

  it('calls updateTeam and navigates on successful edit', async () => {
    render(<TeamCreateForm values={existingTeam} organization_id='1' />);
    const input = screen.getByRole('textbox');

    await user.clear(input);
    await user.type(input, 'Updated Name');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(mockUpdateTeam).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ name: 'Updated Name' }),
      );
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/teams'));
    });
  });
});
