import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'sonner';

jest.mock('@/features/calendar/api/source', () => {
  return {
    detachCalendar: jest.fn(),
  };
});

jest.mock('sonner', () => {
  return { toast: { success: jest.fn(), error: jest.fn() } };
});

import { detachCalendar } from '@/features/calendar/api/source';
import DetachCalendarButton from '@/features/calendar/ui/detach-calendar-button';

const mockDetachCalendar = detachCalendar as jest.Mock;
const user = userEvent.setup({ delay: null });

describe('DetachCalendarButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Disconnect calendar" button initially', () => {
    render(<DetachCalendarButton sourceId={1} />);
    expect(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    ).toBeInTheDocument();
  });

  it('shows confirmation step after clicking "Disconnect calendar"', async () => {
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    expect(await screen.findByText(/are you sure/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /yes, disconnect/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('cancels and returns to initial state', async () => {
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('calls detachCalendar with correct sourceId on confirm', async () => {
    mockDetachCalendar.mockResolvedValue({ data: undefined, error: null });
    render(<DetachCalendarButton sourceId={42} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: /yes, disconnect/i }),
    );
    expect(mockDetachCalendar).toHaveBeenCalledWith(42);
  });

  it('does not show an error toast on success (redirect happens server-side)', async () => {
    // redirect() in server action throws internally — the action never returns
    // a value to the client. We simulate that by returning no error.
    mockDetachCalendar.mockResolvedValue({ data: undefined, error: null });
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: /yes, disconnect/i }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockDetachCalendar.mockResolvedValue({
      data: null,
      error: 'Failed to disconnect Google Calendar. Please try again.',
    });
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: /yes, disconnect/i }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to disconnect Google Calendar. Please try again.',
      );
    });
  });

  it('shows "Disconnecting..." and disables buttons while pending', async () => {
    mockDetachCalendar.mockReturnValue(new Promise(() => {}));
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: /yes, disconnect/i }),
    );
    expect(await screen.findByText(/disconnecting/i)).toBeInTheDocument();
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('resets confirming state after error', async () => {
    mockDetachCalendar.mockResolvedValue({
      data: null,
      error: 'Some error',
    });
    render(<DetachCalendarButton sourceId={1} />);
    await user.click(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: /yes, disconnect/i }),
    );
    await waitFor(() => {
      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /disconnect calendar/i }),
    ).toBeInTheDocument();
  });
});
