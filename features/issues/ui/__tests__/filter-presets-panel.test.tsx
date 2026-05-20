import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FilterPresetsPanel } from '@/features/issues/ui/filter-presets-panel';

import type { SharedFilters } from '@/features/issues/model/types';

const defaultFilters: SharedFilters = {
  organization_id: '1',
  team_id: '',
  search: '',
  type: '',
  assignee_id: '',
  author_id: '',
  epic_id: '',
  status: '',
  show_archived: false,
};

jest.mock('@/shared/ui/popup/Popup', () => {
  return {
    Popup: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => {
      return open ? <div data-testid='popup'>{children}</div> : null;
    },
  };
});

beforeEach(() => {
  localStorage.clear();
});

describe('FilterPresetsPanel', () => {
  it('renders the Saved button', () => {
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /saved/i, hidden: true })).toBeInTheDocument();
  });

  it('opens popup when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('shows "No saved filters" when presets are empty', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    expect(screen.getByText('No saved filters')).toBeInTheDocument();
  });

  it('saves and displays a preset', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    await user.type(screen.getByPlaceholderText('Preset name...'), 'My preset');
    await user.click(screen.getByLabelText('Save current filters'));
    expect(screen.getByText('My preset')).toBeInTheDocument();
  });

  it('persists preset to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    await user.type(screen.getByPlaceholderText('Preset name...'), 'Persistent');
    await user.click(screen.getByLabelText('Save current filters'));
    const stored = localStorage.getItem('issues_filter_presets_v1');
    expect(stored).toContain('Persistent');
  });

  it('calls onApply when a preset is clicked', async () => {
    const onApply = jest.fn();
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel currentFilters={defaultFilters} onApply={onApply} />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    await user.type(screen.getByPlaceholderText('Preset name...'), 'Quick');
    await user.click(screen.getByLabelText('Save current filters'));
    await user.click(screen.getByText('Quick'));
    expect(onApply).toHaveBeenCalledWith(defaultFilters);
  });

  it('deletes a preset', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    await user.type(screen.getByPlaceholderText('Preset name...'), 'ToDelete');
    await user.click(screen.getByLabelText('Save current filters'));
    await user.click(screen.getByLabelText('Delete preset "ToDelete"'));
    expect(screen.queryByText('ToDelete')).not.toBeInTheDocument();
  });

  it('does not save when name is empty and Save button is disabled', async () => {
    const user = userEvent.setup();
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Saved filters'));
    const saveBtn = screen.getByLabelText('Save current filters');
    expect(saveBtn).toBeDisabled();
  });

  it('loads presets from localStorage on mount', async () => {
    const localUser = userEvent.setup();
    const envelope = {
      version: 1,
      presets: [
        { id: 'abc', name: 'Saved preset', filters: defaultFilters },
      ],
    };
    localStorage.setItem('issues_filter_presets_v1', JSON.stringify(envelope));

    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await localUser.click(screen.getByLabelText('Saved filters'));
    await screen.findByText('Saved preset');
  });

  it('discards outdated localStorage schema gracefully', async () => {
    const localUser = userEvent.setup();
    localStorage.setItem(
      'issues_filter_presets_v1',
      JSON.stringify({ version: 99, presets: [{ id: 'x', name: 'Old' }] }),
    );
    render(
      <FilterPresetsPanel
        currentFilters={defaultFilters}
        onApply={jest.fn()}
      />,
    );
    await localUser.click(screen.getByLabelText('Saved filters'));
    expect(screen.queryByText('Old')).not.toBeInTheDocument();
  });
});