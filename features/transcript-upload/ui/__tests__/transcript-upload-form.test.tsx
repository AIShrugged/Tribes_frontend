import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TranscriptUploadForm } from '@/features/transcript-upload/ui/transcript-upload-form';

import type { CalendarEventListItem } from '@/entities/event';
import type { TeamProps } from '@/entities/team';

const mockUpload = jest.fn();
jest.mock('@/features/transcript-upload/api/upload-transcript', () => {
  return {
    uploadTranscript: (...args: unknown[]) => {
      return mockUpload(...args);
    },
  };
});

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => {
  return {
    toast: {
      success: (...args: unknown[]) => {
        return mockToastSuccess(...args);
      },
      error: (...args: unknown[]) => {
        return mockToastError(...args);
      },
    },
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return {
        push: (...args: unknown[]) => {
          return mockPush(...args);
        },
      };
    },
  };
});

const meetings: CalendarEventListItem[] = [
  {
    id: 42,
    title: 'Tribes tech sync',
    starts_at: '2026-05-01T10:00:00Z',
    ends_at: '2026-05-01T11:00:00Z',
    platform: 'google_meet',
    url: null,
    description: null,
    required_bot: false,
    has_summary: false,
  },
];

const teams: TeamProps[] = [
  { id: 7, slug: 'core', name: 'Core', is_default: false, employee_count: 3 },
];

function makeFile(name = 't.txt', size = 100, type = 'text/plain'): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('TranscriptUploadForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mode tabs and starts on existing-meeting mode', () => {
    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={teams}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /attach to existing meeting/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: /create new meeting/i }),
    ).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText(/transcript file/i)).toBeInTheDocument();
  });

  it('disables Mode B tab when user has zero teams', () => {
    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={[]}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /create new meeting/i }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows new-meeting fields after switching mode', async () => {
    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={teams}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('tab', { name: /create new meeting/i }),
    );

    expect(screen.getByText(/meeting title/i)).toBeInTheDocument();
    expect(screen.getByText(/^start$/i)).toBeInTheDocument();
    expect(screen.getByText(/^end$/i)).toBeInTheDocument();
  });

  it('rejects oversized files with a toast', async () => {
    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={teams}
        onClose={() => {}}
      />,
    );

    const oversized = makeFile('big.txt', 10 * 1024 * 1024 + 1);
    const fileInput = screen.getByLabelText(/transcript file/i, {
      selector: 'input',
    }) as HTMLInputElement;

    await userEvent.upload(fileInput, oversized);

    expect(mockToastError).toHaveBeenCalledWith('File exceeds 10 MB');
  });

  it('on successful submit, shows toast and redirects', async () => {
    mockUpload.mockResolvedValue({
      data: {
        calendar_event_id: 100,
        transcript_entries_count: 5,
        participants_count: 2,
      },
      error: null,
    });

    const onClose = jest.fn();
    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={teams}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByText(/select a meeting|tribes/i));
    const option = await screen.findByText(/Tribes tech sync —/i);
    await userEvent.click(option);

    const fileInput = screen.getByLabelText(/transcript file/i, {
      selector: 'input',
    }) as HTMLInputElement;
    await userEvent.upload(fileInput, makeFile('valid.txt', 100));

    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    await screen.findByRole('button', { name: /uploading|^upload$/i });

    expect(mockUpload).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Transcript uploaded'),
    );
    expect(mockPush).toHaveBeenCalledWith('/dashboard/meetings/100/transcript');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows English error message for NO_SOURCE error code', async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: 'no source',
      errorCode: 'NO_SOURCE',
    });

    render(
      <TranscriptUploadForm
        meetings={meetings}
        teams={teams}
        onClose={() => {}}
      />,
    );

    await userEvent.click(screen.getByText(/select a meeting|tribes/i));
    const option = await screen.findByText(/Tribes tech sync —/i);
    await userEvent.click(option);

    const fileInput = screen.getByLabelText(/transcript file/i, {
      selector: 'input',
    }) as HTMLInputElement;
    await userEvent.upload(fileInput, makeFile('valid.txt', 100));

    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    await screen.findByRole('button', { name: /^upload$/i });

    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Connect your calendar'),
    );
  });
});
