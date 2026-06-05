import { render, screen } from '@testing-library/react';
import React from 'react';

import { OrganizationTabsNav } from '../organization-tabs-nav';

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
    }: React.PropsWithChildren<{ href: string }>) => {
      return <a href={href}>{children}</a>;
    },
  };
});

jest.mock('next/navigation', () => {
  return {
    usePathname: () => {
      return '/dashboard/organization/2/people';
    },
    useSearchParams: () => {
      return new URLSearchParams('');
    },
  };
});

describe('OrganizationTabsNav', () => {
  it('renders People, Goals and Description tabs with org-scoped hrefs', () => {
    render(<OrganizationTabsNav organizationId={2} />);

    const people = screen.getByRole('link', { name: 'People' });
    const goals = screen.getByRole('link', { name: 'Goals' });
    const description = screen.getByRole('link', { name: 'Description' });

    expect(people).toHaveAttribute('href', '/dashboard/organization/2/people');
    expect(goals).toHaveAttribute('href', '/dashboard/organization/2/goals');
    expect(description).toHaveAttribute(
      'href',
      '/dashboard/organization/2/description',
    );
  });
});
