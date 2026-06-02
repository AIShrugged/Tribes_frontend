import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProfileForm } from '@/features/user-profile/ui/ProfileForm';

import type { UserProps } from '@/entities/user';
import type { ActionResult } from '@/shared/types/server-action';

const mockUpdateProfile = jest.fn((): Promise<ActionResult> => {
  return Promise.resolve({ data: undefined, error: null });
});

jest.mock('@/features/user-profile/api/profile', () => {
  return {
    updateProfile: (...args: Parameters<typeof mockUpdateProfile>) => {
      return mockUpdateProfile(...args);
    },
  };
});

jest.mock('sonner', () => {
  return {
    toast: { error: jest.fn(), success: jest.fn() },
  };
});

const makeUser = (overrides?: Partial<UserProps>): UserProps => {
  return {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    email_verified_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
};
const user = userEvent.setup({ delay: null });

describe('ProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({ data: undefined, error: null });
  });
  it('renders name input with user value', () => {
    render(<ProfileForm user={makeUser()} />);
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
  });

  it('does not render an email input', () => {
    render(<ProfileForm user={makeUser()} />);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('renders the Save button', () => {
    render(<ProfileForm user={makeUser()} />);
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('disables Save button when form is not dirty', () => {
    render(<ProfileForm user={makeUser()} />);
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeDisabled();
  });

  it('enables Save button after editing name', async () => {
    render(<ProfileForm user={makeUser()} />);
    const nameInput = screen.getByDisplayValue('Jane Doe');

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Jane Smith');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).not.toBeDisabled();
  });

  it('shows required validation error on empty name', async () => {
    render(<ProfileForm user={makeUser()} />);
    const nameInput = screen.getByDisplayValue('Jane Doe');

    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('calls updateProfile with new name on submit', async () => {
    render(<ProfileForm user={makeUser()} />);
    const nameInput = screen.getByDisplayValue('Jane Doe');

    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'Jane Smith' });
    });
  });

  it('shows success toast on successful update', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { success: jest.Mock };
    };

    render(<ProfileForm user={makeUser()} />);
    await user.clear(screen.getByDisplayValue('Jane Doe'));
    await user.type(screen.getByRole('textbox'), 'New Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Profile updated successfully',
      );
    });
  });

  it('shows error toast when updateProfile returns error', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { error: jest.Mock };
    };

    mockUpdateProfile.mockResolvedValue({ data: null, error: 'Server error' });
    render(<ProfileForm user={makeUser()} />);
    await user.clear(screen.getByDisplayValue('Jane Doe'));
    await user.type(screen.getByRole('textbox'), 'Bad Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });
});
