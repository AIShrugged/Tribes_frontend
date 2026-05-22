import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('sonner', () => {
  return {
    toast: { success: jest.fn(), error: jest.fn() },
  };
});

jest.mock('@/features/teams/api/team', () => {
  return {
    sendInvite: jest.fn(),
  };
});

// Stub field renderer so we get a real input to interact with
jest.mock('@/shared/lib/fieldMapper', () => {
  return {
    VARIANT_MAPPER: {
      input: ({
        field,
        fieldState,
      }: {
        field: { name: string; value: string; onChange: (v: string) => void };
        fieldState: { error?: { message: string } };
      }) => {
        return (
          <div>
            <input
              data-testid={`field-${field.name}`}
              value={field.value}
              onChange={(e) => {
                field.onChange(e.target.value);
              }}
            />
            {fieldState.error && (
              <span data-testid={`error-${field.name}`}>
                {fieldState.error.message}
              </span>
            )}
          </div>
        );
      },
    },
  };
});

jest.mock('@/shared/ui/button/Button', () => {
  return {
    Button: ({
      children,
      disabled,
      loading,
    }: React.PropsWithChildren<{ disabled?: boolean; loading?: boolean }>) => {
      return (
        <button type='submit' disabled={disabled || loading}>
          {children}
        </button>
      );
    },
  };
});

import { toast } from 'sonner';

import { sendInvite } from '@/features/teams/api/team';
import TeamMemberAddForm from '@/features/teams/ui/team-member-add-form';

const mockSendInvite = sendInvite as jest.Mock;
const FIELD_EMAIL = 'field-email';
const TEST_EMAIL = 'test@example.com';
const user = userEvent.setup({ delay: null });

describe('TeamMemberAddForm', () => {
  const close = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendInvite.mockResolvedValue({
      data: { id: 1, email: TEST_EMAIL, status: 'pending' },
      error: null,
    });
  });

  it('renders the email input field', () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    expect(screen.getByTestId(FIELD_EMAIL)).toBeInTheDocument();
  });

  it('renders an Invite button', () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('Invite button is disabled when form is pristine', () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
  });

  it('enables Invite button after typing in email field', async () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    await user.type(screen.getByTestId(FIELD_EMAIL), 'user@example.com');
    expect(screen.getByRole('button', { name: 'Invite' })).not.toBeDisabled();
  });

  it('calls sendInvite with teamId and form data on submit', async () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    await user.type(screen.getByTestId(FIELD_EMAIL), TEST_EMAIL);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Invite' }));
    });
    expect(mockSendInvite).toHaveBeenCalledWith(7, { email: TEST_EMAIL });
  });

  it('shows success toast and calls close on success', async () => {
    render(<TeamMemberAddForm close={close} teamId={7} />);
    await user.type(screen.getByTestId(FIELD_EMAIL), TEST_EMAIL);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Invite' }));
    });
    expect(toast.success).toHaveBeenCalledWith('Invitation sent');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('sets field error when sendInvite returns an error', async () => {
    mockSendInvite.mockResolvedValue({
      data: null,
      error: 'Email already invited',
    });
    render(<TeamMemberAddForm close={close} teamId={7} />);
    await user.type(screen.getByTestId(FIELD_EMAIL), TEST_EMAIL);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Invite' }));
    });
    expect(screen.getByTestId('error-email')).toHaveTextContent(
      'Email already invited',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
