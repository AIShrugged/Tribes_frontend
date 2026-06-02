import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrganizationDropdown from '@/features/organization/ui/organization-dropdown';

import type { OrganizationProps } from '@/entities/organization';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: mockPush, refresh: mockRefresh };
    },
  };
});

jest.mock('sonner', () => {
  return {
    toast: { success: jest.fn(), error: jest.fn() },
  };
});

jest.mock('@/features/organization/api/organization', () => {
  return {
    setActiveOrganization: jest.fn(() => {
      return { ok: true };
    }),
  };
});

const makeOrg = (
  id: number,
  name: string,
  role = 'admin',
): OrganizationProps => {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(/\s+/g, '-'),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pivot: { organization_id: id, role, user_id: 1 },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrganizationDropdown', () => {
  it('renders the active organization name', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp')]}
        organizationActiveId={1}
      />,
    );
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('does not show dropdown items by default', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp'), makeOrg(2, 'Beta Inc')]}
        organizationActiveId={1}
      />,
    );
    // Beta Inc should not be visible (dropdown closed)
    expect(
      screen.queryByRole('button', { name: /create/i }),
    ).not.toBeInTheDocument();
  });

  it('shows dropdown items when clicked', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp')]}
        organizationActiveId={1}
      />,
    );
    // Click the toggle button (the chevron/name row)
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText(/create/i)).toBeInTheDocument();
  });

  it('shows Create button in open dropdown', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp')]}
        organizationActiveId={1}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(
      screen.getByRole('button', { name: /\+ Create/i }),
    ).toBeInTheDocument();
  });

  it('navigates to /organization/create when Create button is clicked', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp')]}
        organizationActiveId={1}
      />,
    );
    await user.click(screen.getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /\+ Create/i }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/create'));
  });

  it('shows non-active org as a switch button', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp'), makeOrg(2, 'Beta Inc')]}
        organizationActiveId={1}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    // Beta Inc should appear as a submit button
    const betaBtn = screen.getByRole('button', { name: /Beta Inc/i });

    expect(betaBtn).toHaveAttribute('type', 'submit');
  });

  it('shows success toast after switching organization via form submit', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { success: jest.Mock };
    };
    const user = userEvent.setup({ delay: null });

    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp'), makeOrg(2, 'Beta Inc')]}
        organizationActiveId={1}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    // Submit the Beta Inc form
    const betaBtn = screen.getByRole('button', { name: /Beta Inc/i });

    await user.click(betaBtn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Switched to: Beta Inc');
    });
  });

  it('renders "Select organization" when no active org', () => {
    render(
      <OrganizationDropdown
        organizations={[makeOrg(1, 'Acme Corp')]}
        organizationActiveId={null}
      />,
    );
    expect(screen.getByText('Select organization')).toBeInTheDocument();
  });
});
