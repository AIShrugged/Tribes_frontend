import { render, screen } from '@testing-library/react';
import React from 'react';

import { OrganizationDescriptionTab } from '../organization-description-tab';

describe('OrganizationDescriptionTab', () => {
  it('renders the description text when context is present', () => {
    render(
      <OrganizationDescriptionTab context='We build HR tooling for teams.' />,
    );

    expect(
      screen.getByText('We build HR tooling for teams.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No description yet')).not.toBeInTheDocument();
  });

  it('shows the empty state when context is null', () => {
    render(<OrganizationDescriptionTab context={null} />);

    expect(screen.getByText('No description yet')).toBeInTheDocument();
  });

  it('shows the empty state when context is only whitespace', () => {
    render(<OrganizationDescriptionTab context='   ' />);

    expect(screen.getByText('No description yet')).toBeInTheDocument();
  });
});
