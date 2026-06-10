import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UploadReviewScreen } from '@/features/upload-review/ui/upload-review-screen';

import type { ExtractionPlanPayload } from '@/features/upload-review/model/types';

const mockUpdate = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
jest.mock('@/features/upload-review/api/upload-review', () => {
  return {
    updatePlan: (...args: unknown[]) => {
      return mockUpdate(...args);
    },
    approveUpload: (...args: unknown[]) => {
      return mockApprove(...args);
    },
    rejectUpload: (...args: unknown[]) => {
      return mockReject(...args);
    },
  };
});

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: jest.fn(), refresh: mockRefresh };
    },
  };
});

jest.mock('sonner', () => {
  return { toast: { success: jest.fn(), error: jest.fn() } };
});

const PLAN: ExtractionPlanPayload = {
  issues: {
    items: [
      {
        uid: 'i-0',
        name: 'Ship feature',
        description: 'Do the thing',
        type: 'backend',
        assignee_name: 'Alice',
        due_date: '2026-06-15',
        priority: 'high',
        author_name: 'Bob',
      },
    ],
    decisions: [
      {
        uid: 'i-0',
        action: 'create',
        existing_issue_id: null,
        update_description: null,
      },
    ],
    existing_snapshots: [],
  },
  decisions: {
    items: [
      {
        uid: 'd-0',
        text: 'We will ship on Friday',
        author_name: 'Bob',
        topic: 'release',
        skip: false,
      },
    ],
  },
  review: { review_id: 5 },
};

describe('UploadReviewScreen', () => {
  beforeEach(() => {
    return jest.clearAllMocks();
  });

  it('renders editable fields, locks name/description, and approves', async () => {
    mockUpdate.mockResolvedValue({ data: {}, error: null });
    mockApprove.mockResolvedValue({ data: {}, error: null });

    render(
      <UploadReviewScreen
        type='task_data'
        id={1}
        initialPlan={PLAN}
        assignees={['Alice', 'Bob']}
      />,
    );

    // Task name is shown read-only (text, not an editable field).
    expect(screen.getByText('Ship feature')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ship feature')).not.toBeInTheDocument();

    // Due date is a native date input seeded from the plan.
    expect(screen.getByDisplayValue('2026-06-15')).toBeInTheDocument();
    // Assignee + Priority are dropdowns (Type field is hidden).
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    // Decision text is editable.
    expect(
      screen.getByDisplayValue('We will ship on Friday'),
    ).toBeInTheDocument();
    // Create badge present.
    expect(screen.getByText('New')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      return expect(mockApprove).toHaveBeenCalledWith('task_data', 1);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('rejects via the discard button', async () => {
    mockReject.mockResolvedValue({ data: null, error: null });

    render(
      <UploadReviewScreen
        type='transcript'
        id={2}
        initialPlan={PLAN}
        assignees={['Alice', 'Bob']}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      return expect(mockReject).toHaveBeenCalledWith('transcript', 2);
    });
    expect(mockApprove).not.toHaveBeenCalled();
  });
});
