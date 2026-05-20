import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('sonner', () => {
  return {
    toast: { success: jest.fn(), error: jest.fn() },
  };
});

jest.mock('lucide-react', () => {
  return {
    Copy: () => {
      return <span data-testid='copy-icon' />;
    },
  };
});

import { toast } from 'sonner';

import ButtonCopy from '@/shared/ui/button/button-copy';

const user = userEvent.setup({ delay: null });

describe('ButtonCopy', () => {
  const mockWriteText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockResolvedValue();
  });

  it('renders a button with copy icon', () => {
    render(<ButtonCopy copyText='hello' />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
  });

  it('calls clipboard.writeText with the given text on click', async () => {
    render(<ButtonCopy copyText='copy me' />);
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    expect(mockWriteText).toHaveBeenCalledWith('copy me');
  });

  it('shows success toast after copying', async () => {
    render(<ButtonCopy copyText='hello' />);
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    expect(toast.success).toHaveBeenCalledWith('Text copied');
  });

  it('passes different copyText values', async () => {
    render(<ButtonCopy copyText='different text' />);
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    expect(mockWriteText).toHaveBeenCalledWith('different text');
  });
});
