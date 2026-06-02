import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetArtifacts = jest.fn();

jest.mock('@/entities/artifact/api/artifacts', () => {
  return {
    getArtifacts: (...args: unknown[]) => {
      return mockGetArtifacts(...args);
    },
  };
});

jest.mock('@/shared/ui/layout/collapsed-side-panel', () => {
  return {
    CollapsedSidePanel: ({
      label,
      onExpand,
    }: {
      label: string;
      onExpand: () => void;
    }) => {
      return (
        <div data-testid='collapsed-panel'>
          <span>{label}</span>
          <button
            aria-label={`Expand ${label.toLowerCase()} panel`}
            onClick={onExpand}
          >
            Expand
          </button>
        </div>
      );
    },
  };
});

// Stub Lucide icons
jest.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => {
    return <span className={className} />;
  };

  return {
    BarChart2: Icon,
    ChevronLeft: Icon,
    ClipboardList: Icon,
    FileText: Icon,
    Loader2: Icon,
    RefreshCw: Icon,
    Sparkles: Icon,
    Users: Icon,
    Video: Icon,
    Zap: Icon,
  };
});

import { ArtifactPanel } from '@/features/chat/ui/artifact-panel';

import type { ArtifactsResponse } from '@/features/chat/model/types';

const ARTIFACT_ID = 'a1';
const ARTIFACT_TITLE = 'My Artifact';
const makeArtifacts = (type = 'task_table'): ArtifactsResponse => {
  return {
    layout: { items: [{ id: ARTIFACT_ID }] },
    artifacts: {
      a1: {
        id: ARTIFACT_ID,
        type: type as 'task_table',
        title: ARTIFACT_TITLE,
        status: 'ready',
        data: {} as never,
      },
    },
  };
};
const user = userEvent.setup({ delay: null });

describe('ArtifactPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetArtifacts.mockResolvedValue(makeArtifacts());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders "No artifacts yet" when initialArtifacts is null', () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={null} />);
    expect(screen.getByText('No artifacts yet')).toBeInTheDocument();
  });

  it('renders artifact title when initialArtifacts are provided', () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={makeArtifacts()} />);
    expect(screen.getByText(ARTIFACT_TITLE)).toBeInTheDocument();
  });

  it('shows artifact count badge', () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={makeArtifacts()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('collapses the panel when collapse button is clicked', async () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={makeArtifacts()} />);
    await user.click(
      screen.getByRole('button', { name: /collapse artifacts panel/i }),
    );
    expect(screen.queryByText(ARTIFACT_TITLE)).not.toBeInTheDocument();
  });

  it('expands the panel again after collapsing', async () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={makeArtifacts()} />);
    await user.click(
      screen.getByRole('button', { name: /collapse artifacts panel/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /expand artifacts panel/i }),
    );
    expect(screen.getByText(ARTIFACT_TITLE)).toBeInTheDocument();
  });

  it('calls getArtifacts and refreshes on Refresh button click', async () => {
    render(<ArtifactPanel chatId={1} initialArtifacts={makeArtifacts()} />);
    const refreshButton = screen.getByRole('button', {
      name: /refresh artifacts/i,
    });

    await user.click(refreshButton);
    await waitFor(() => {
      expect(mockGetArtifacts).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('renders generating status card with status badge', () => {
    const data: ArtifactsResponse = {
      layout: { items: [{ id: ARTIFACT_ID }] },
      artifacts: {
        a1: {
          id: ARTIFACT_ID,
          type: 'task_table',
          title: 'Loading...',
          status: 'generating',
          data: {} as never,
        },
      },
    };

    render(<ArtifactPanel chatId={1} initialArtifacts={data} />);
    // Status badge text (appears in both badge and card body while generating)
    expect(screen.getAllByText('Generating\u2026').length).toBeGreaterThan(0);
  });

  it('renders failed status card', () => {
    const data: ArtifactsResponse = {
      layout: { items: [{ id: ARTIFACT_ID }] },
      artifacts: {
        a1: {
          id: ARTIFACT_ID,
          type: 'task_table',
          title: 'Failed artifact',
          status: 'failed',
          data: {} as never,
        },
      },
    };

    render(<ArtifactPanel chatId={1} initialArtifacts={data} />);
    expect(screen.getByText('Failed to generate')).toBeInTheDocument();
  });
});
