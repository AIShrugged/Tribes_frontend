import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/features/calendar/api/calendar', () => {
  return {
    attachCalendar: jest.fn(),
  };
});

jest.mock('@/features/calendar/lib/navigation', () => {
  return {
    redirectToExternal: jest.fn(),
  };
});

import { attachCalendar } from '@/features/calendar/api/calendar';
import { redirectToExternal } from '@/features/calendar/lib/navigation';
import { AttachCalendarButton } from '@/features/calendar/ui/attach-calendar-button';

const mockAttachCalendar = attachCalendar as jest.Mock;
const mockRedirectToExternal = redirectToExternal as jest.Mock;
const user = userEvent.setup({ delay: null });
const redirectUrl = 'https://accounts.google.com/oauth';

describe('AttachCalendarButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children as button label', () => {
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('renders default label when no children provided', () => {
    render(<AttachCalendarButton organizationId={42} />);
    expect(
      screen.getByRole('button', { name: 'Connect Calendar' }),
    ).toBeInTheDocument();
  });

  it('calls attachCalendar with organizationId on click', async () => {
    mockAttachCalendar.mockResolvedValue(redirectUrl);
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(mockAttachCalendar).toHaveBeenCalledWith(42);
    expect(mockRedirectToExternal).toHaveBeenCalledWith(redirectUrl);
  });

  it('navigates to the redirect URL on success', async () => {
    mockAttachCalendar.mockResolvedValue(redirectUrl);
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(mockRedirectToExternal).toHaveBeenCalledWith(redirectUrl);
    // No error should appear after successful navigation
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows "Connecting..." text while pending', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(
      await screen.findByRole('button', { name: 'Connecting...' }),
    ).toBeInTheDocument();
  });

  it('disables the button while pending', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(
      await screen.findByRole('button', { name: 'Connecting...' }),
    ).toBeDisabled();
  });

  it('prevents double-click: only calls attachCalendar once', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    const button = screen.getByRole('button');
    await user.click(button);
    // Button is now disabled; second click is a no-op
    await user.click(button);
    expect(mockAttachCalendar).toHaveBeenCalledTimes(1);
  });

  it('shows error message on failure', async () => {
    mockAttachCalendar.mockRejectedValue(new Error('OAuth failed'));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('OAuth failed')).toBeInTheDocument();
  });

  it('shows fallback error for non-Error throws', async () => {
    mockAttachCalendar.mockRejectedValue('unexpected string');
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('re-enables button after error', async () => {
    mockAttachCalendar.mockRejectedValue(new Error('fail'));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('fail')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('does not show error initially', () => {
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows pendingText while pending when provided', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(
      <AttachCalendarButton
        organizationId={42}
        pendingText='Redirecting to Google...'
      >
        Connect
      </AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(
      await screen.findByText('Redirecting to Google...'),
    ).toBeInTheDocument();
  });

  it('does not show pendingText when not provided', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(
      <AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>,
    );
    await user.click(screen.getByRole('button'));
    expect(
      screen.queryByText('Redirecting to Google...'),
    ).not.toBeInTheDocument();
  });

  it('applies className to the button', () => {
    render(
      <AttachCalendarButton organizationId={42} className='my-custom-class'>
        Connect
      </AttachCalendarButton>,
    );
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });
});
