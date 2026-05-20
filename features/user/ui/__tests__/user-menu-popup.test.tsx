import { render, screen, fireEvent } from '@testing-library/react';

import { UserMenuPopup } from '@/features/user/ui/user-menu-popup';

import type { UserProps } from '@/entities/user';

const mockPush = jest.fn();

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: mockPush };
    },
  };
});

jest.mock('@/shared/api/session', () => {
  return {
    logout: jest.fn().mockResolvedValue(),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

const mockUser: UserProps = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  email_verified_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('UserMenuPopup', () => {
  it('renders Profile menu item', () => {
    render(<UserMenuPopup close={jest.fn()} user={mockUser} />);
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });

  it('renders Log out menu item', () => {
    render(<UserMenuPopup close={jest.fn()} user={mockUser} />);
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('navigates to profile on Profile click', async () => {
    render(<UserMenuPopup close={jest.fn()} user={mockUser} />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    // Wait for transition
    await new Promise((r) => {
      return setTimeout(r, 50);
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/profile');
  });

  it('calls close when Log out is clicked', async () => {
    const close = jest.fn();

    render(<UserMenuPopup close={close} user={mockUser} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await new Promise((r) => {
      return setTimeout(r, 50);
    });
    expect(close).toHaveBeenCalled();
  });
});
