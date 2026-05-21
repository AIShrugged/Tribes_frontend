import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueAuditLog } from '@/features/issues/ui/issue-audit-log';

import type { IssueAuditEvent } from '@/entities/issue';

function makeEvent(overrides: Partial<IssueAuditEvent> = {}): IssueAuditEvent {
  return {
    id: 1,
    field: 'status',
    old_value: 'open',
    new_value: 'done',
    user: { id: 1, name: 'Alice' },
    created_at: '2026-05-20T10:00:00Z',
    ...overrides,
  };
}

describe('IssueAuditLog', () => {
  it('renders nothing when events is empty', () => {
    const { container } = render(<IssueAuditLog events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Change history" heading', () => {
    render(<IssueAuditLog events={[makeEvent()]} />);
    expect(screen.getByText('Change history')).toBeInTheDocument();
  });

  it('displays user name', () => {
    render(
      <IssueAuditLog events={[makeEvent({ user: { id: 2, name: 'Bob' } })]} />,
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays human-readable field label for known fields', () => {
    render(<IssueAuditLog events={[makeEvent({ field: 'assignee_id' })]} />);
    expect(screen.getByText('Assignee')).toBeInTheDocument();
  });

  it('falls back to raw field name for unknown fields', () => {
    render(<IssueAuditLog events={[makeEvent({ field: 'custom_field' })]} />);
    expect(screen.getByText('custom_field')).toBeInTheDocument();
  });

  it('renders old and new values', () => {
    render(<IssueAuditLog events={[makeEvent()]} />);
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('shows max 10 events by default', () => {
    const events = Array.from({ length: 15 }, (_, i) => {
      return makeEvent({ id: i + 1 });
    });
    render(<IssueAuditLog events={events} />);
    expect(screen.getByText('Show 5 more')).toBeInTheDocument();
  });

  it('shows all events after clicking Show more', async () => {
    const user = userEvent.setup();
    const events = Array.from({ length: 12 }, (_, i) => {
      return makeEvent({
        id: i + 1,
        old_value: `old${i}`,
        new_value: `new${i}`,
      });
    });
    render(<IssueAuditLog events={events} />);
    await user.click(screen.getByText('Show 2 more'));
    expect(screen.queryByText(/show.*more/i)).not.toBeInTheDocument();
  });

  it('does not show "Show more" when events <= 10', () => {
    const events = Array.from({ length: 10 }, (_, i) => {
      return makeEvent({ id: i + 1 });
    });
    render(<IssueAuditLog events={events} />);
    expect(screen.queryByText(/show.*more/i)).not.toBeInTheDocument();
  });
});
