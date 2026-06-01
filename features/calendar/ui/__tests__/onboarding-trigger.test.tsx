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
import OnboardingTrigger from '@/features/calendar/ui/onboarding-trigger';

const mockAttachCalendar = attachCalendar as jest.Mock;
const mockRedirectToExternal = redirectToExternal as jest.Mock;
const user = userEvent.setup({ delay: null });
const redirectUrl = 'https://accounts.google.com/oauth';

describe('OnboardingTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "No calendar connected." text', () => {
    render(<OnboardingTrigger organizationId={42} />);
    expect(screen.getByText('No calendar connected.')).toBeInTheDocument();
  });

  it('renders "Connect Google Calendar" button', () => {
    render(<OnboardingTrigger organizationId={42} />);
    expect(
      screen.getByRole('button', { name: 'Connect Google Calendar' }),
    ).toBeInTheDocument();
  });

  it('does not show pending message initially', () => {
    render(<OnboardingTrigger organizationId={42} />);
    expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument();
  });

  it('shows "Redirecting to Google..." while pending', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(<OnboardingTrigger organizationId={42} />);
    await user.click(screen.getByRole('button'));
    expect(
      await screen.findByText(/redirecting to google/i),
    ).toBeInTheDocument();
  });

  it('disables the button while pending', async () => {
    mockAttachCalendar.mockReturnValue(new Promise(() => {}));
    render(<OnboardingTrigger organizationId={42} />);
    await user.click(screen.getByRole('button'));
    expect(
      await screen.findByRole('button', { name: 'Connecting...' }),
    ).toBeDisabled();
  });

  it('calls attachCalendar with organizationId on click', async () => {
    mockAttachCalendar.mockResolvedValue(redirectUrl);
    render(<OnboardingTrigger organizationId={42} />);
    await user.click(screen.getByRole('button'));
    expect(mockAttachCalendar).toHaveBeenCalledWith(42);
    expect(mockRedirectToExternal).toHaveBeenCalledWith(redirectUrl);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows error message when attachCalendar throws', async () => {
    mockAttachCalendar.mockRejectedValue(new Error('OAuth failed'));
    render(<OnboardingTrigger organizationId={42} />);
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('OAuth failed')).toBeInTheDocument();
  });

  it('re-enables the button after an error', async () => {
    mockAttachCalendar.mockRejectedValue(new Error('fail'));
    render(<OnboardingTrigger organizationId={42} />);
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('fail')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});
