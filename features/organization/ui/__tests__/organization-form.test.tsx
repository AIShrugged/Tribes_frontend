import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockCreateOrganization = jest.fn().mockResolvedValue({});
const mockRefresh = jest.fn();

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({
      href,
      children,
    }: React.PropsWithChildren<{ href: string }>) => {
      return <a href={href}>{children}</a>;
    },
  };
});

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { refresh: mockRefresh };
    },
  };
});

jest.mock('@/features/organization/api/organization', () => {
  return {
    createOrganization: (...args: unknown[]) => {
      return mockCreateOrganization(...args);
    },
    updateOrganization: jest.fn().mockResolvedValue({}),
    setActiveOrganization: jest.fn().mockResolvedValue({ ok: true }),
    previewOrganizationCode: jest.fn().mockResolvedValue(null),
  };
});

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
      variant,
      form,
      type: btnType = 'submit',
    }: React.PropsWithChildren<{
      disabled?: boolean;
      loading?: boolean;
      variant?: string;
      form?: string;
      type?: string;
    }>) => {
      return (
        <button
          type={btnType as 'submit' | 'button' | 'reset'}
          disabled={disabled || loading}
          data-variant={variant}
          form={form}
        >
          {children}
        </button>
      );
    },
  };
});

import OrganizationForm from '@/features/organization/ui/organization-form';

import type { OrganizationProps } from '@/entities/organization';

const existingOrg: OrganizationProps = {
  id: 5,
  name: 'Acme Corp',
  slug: 'acme-corp',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  pivot: { organization_id: 5, role: 'admin', user_id: 1 },
};
const FIELD_NAME = 'field-name';
const user = userEvent.setup({ delay: null });

describe('OrganizationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateOrganization.mockResolvedValue({});
  });

  it('renders the name input field', () => {
    render(<OrganizationForm />);
    expect(screen.getByTestId(FIELD_NAME)).toBeInTheDocument();
  });

  it('shows Save and Back buttons in create mode (no values)', () => {
    render(<OrganizationForm />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows only Save button in edit mode', () => {
    render(<OrganizationForm values={existingOrg} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    // Back button should not appear in edit mode
    expect(
      screen.queryByRole('button', { name: /back/i }),
    ).not.toBeInTheDocument();
  });

  it('pre-fills name for existing organization', () => {
    render(<OrganizationForm values={existingOrg} />);
    expect(screen.getByTestId(FIELD_NAME)).toHaveValue('Acme Corp');
  });

  it('Save button is disabled when form is not dirty', () => {
    render(<OrganizationForm />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save after typing a name', async () => {
    render(<OrganizationForm />);
    await user.type(screen.getByTestId(FIELD_NAME), 'New Org');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls createOrganization on submit', async () => {
    render(<OrganizationForm />);
    await user.type(screen.getByTestId(FIELD_NAME), 'New Company');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(mockCreateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Company' }),
      );
    });
  });

  it('shows field error when createOrganization throws', async () => {
    mockCreateOrganization.mockRejectedValue(new Error('Already exists'));
    render(<OrganizationForm />);
    await user.type(screen.getByTestId(FIELD_NAME), 'Dup Co');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByTestId('error-name')).toHaveTextContent(
      'Already exists',
    );
  });

  it('surfaces a 422 code field error from the create result', async () => {
    mockCreateOrganization.mockResolvedValue({
      data: null,
      error: 'The code has already been taken.',
      fieldErrors: { code: 'The code has already been taken.' },
    });
    render(<OrganizationForm />);
    await user.type(screen.getByTestId(FIELD_NAME), 'Dup Co');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(
      await screen.findByText('The code has already been taken.'),
    ).toBeInTheDocument();
  });
});
