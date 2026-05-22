import { render, screen } from '@testing-library/react';

import TeamMemberAddModal from '@/features/teams/ui/team-member-add-modal';

jest.mock('@/features/teams/ui/team-member-add-form', () => {
  return {
    __esModule: true,
    default: () => {
      return <div data-testid='add-member-form' />;
    },
  };
});

jest.mock('@/shared/ui/modal/modal-header', () => {
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => {
      return <div data-testid='modal-header'>{title}</div>;
    },
  };
});

jest.mock('@/shared/ui/modal/modal-body', () => {
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => {
      return <div>{children}</div>;
    },
  };
});

describe('TeamMemberAddModal', () => {
  it('renders "Add member" title', () => {
    render(<TeamMemberAddModal close={jest.fn()} teamId={7} />);
    expect(screen.getByTestId('modal-header')).toHaveTextContent('Add member');
  });

  it('renders the add member form', () => {
    render(<TeamMemberAddModal close={jest.fn()} teamId={7} />);
    expect(screen.getByTestId('add-member-form')).toBeInTheDocument();
  });

  it('renders invitation instructions text', () => {
    render(<TeamMemberAddModal close={jest.fn()} teamId={7} />);
    expect(screen.getByText(/invitation will be sent/i)).toBeInTheDocument();
  });
});
