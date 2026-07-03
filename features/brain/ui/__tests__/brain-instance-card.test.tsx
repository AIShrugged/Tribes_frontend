import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BrainInstanceCard } from '@/features/brain/ui/brain-instance-card';

import type { SecondBrainInstance } from '@/features/brain/model/types';
import type { PropsWithChildren } from 'react';

const mockEnable = jest.fn();
const mockDisable = jest.fn();

jest.mock('@/features/brain/api/instances', () => {
  return {
    enableBrainInstance: (...args: unknown[]) => {
      return mockEnable(...args);
    },
    disableBrainInstance: (...args: unknown[]) => {
      return mockDisable(...args);
    },
  };
});

// Poll hook hits a server action — no-op it in the component test.
jest.mock('@/features/brain/hooks/use-brain-instance-poll', () => {
  return { useBrainInstancePoll: () => {} };
});

// Avoid framer-motion / portal in jsdom — render modal children inline when open.
jest.mock('@/shared/ui/modal/modal', () => {
  return {
    Modal: ({ isOpen, children }: PropsWithChildren<{ isOpen: boolean }>) => {
      return isOpen ? <div>{children}</div> : null;
    },
  };
});

jest.mock('sonner', () => {
  return { toast: { success: jest.fn(), error: jest.fn() } };
});

function makeInstance(
  overrides: Partial<SecondBrainInstance> = {},
): SecondBrainInstance {
  return {
    organization_id: 2,
    enabled: false,
    status: 'disabled',
    container_name: null,
    claude_auth_type: null,
    last_error: null,
    last_started_at: null,
    last_reconciled_at: null,
    ...overrides,
  };
}

describe('BrainInstanceCard', () => {
  beforeEach(() => {
    mockEnable.mockReset();
    mockDisable.mockReset();
  });

  it('re-enables directly (empty body) when a credential is already stored', async () => {
    const user = userEvent.setup();
    mockEnable.mockResolvedValue({
      data: makeInstance({
        enabled: true,
        status: 'pending',
        claude_auth_type: 'oauth',
      }),
      error: null,
    });

    render(
      <BrainInstanceCard
        instance={makeInstance({ claude_auth_type: 'oauth' })}
        organizationName='Acme'
      />,
    );

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockEnable).toHaveBeenCalledWith(2, {});
    });
  });

  it('reveals the credential form (no request) on first enable', async () => {
    const user = userEvent.setup();

    render(
      <BrainInstanceCard instance={makeInstance()} organizationName='Acme' />,
    );

    await user.click(screen.getByRole('switch'));

    expect(screen.getByText('Подписка Claude')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Включить' }),
    ).toBeInTheDocument();
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('confirms then disables a running instance', async () => {
    const user = userEvent.setup();
    mockDisable.mockResolvedValue({
      data: makeInstance({
        enabled: false,
        status: 'stopping',
        claude_auth_type: 'oauth',
      }),
      error: null,
    });

    render(
      <BrainInstanceCard
        instance={makeInstance({
          enabled: true,
          status: 'running',
          claude_auth_type: 'oauth',
          container_name: 'second-brain-org2',
        })}
        organizationName='Acme'
      />,
    );

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Выключить' }));

    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalledWith(2);
    });
  });
});
