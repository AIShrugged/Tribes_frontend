import { render, screen } from '@testing-library/react';
import React from 'react';

import { OrganizationDescriptionTab } from '../organization-description-tab';

describe('OrganizationDescriptionTab', () => {
  it('renders the org name heading and description text when context is present', () => {
    render(
      <OrganizationDescriptionTab
        name='Acme Inc.'
        context='We build HR tooling for teams.'
      />,
    );

    expect(screen.getByText('About')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Acme Inc.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('We build HR tooling for teams.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No description yet')).not.toBeInTheDocument();
  });

  it('splits the description into separate paragraphs on blank lines', () => {
    render(
      <OrganizationDescriptionTab
        context={'First paragraph.\n\nSecond one.'}
      />,
    );

    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second one.')).toBeInTheDocument();
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
