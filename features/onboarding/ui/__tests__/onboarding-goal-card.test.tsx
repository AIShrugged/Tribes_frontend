import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { EditableGoal } from '../../model/types';

jest.mock('@/shared/ui/input/Input', () => {
  return {
    __esModule: true,
    default: jest.fn(
      ({
        label,
        value,
        onChange,
      }: {
        label: string;
        value: string;
        onChange: React.ChangeEventHandler<HTMLInputElement>;
      }) => {return <input aria-label={label} value={value} onChange={onChange} />},
    ),
  };
});

jest.mock('@/shared/ui/input/textarea', () => {
  return {
    __esModule: true,
    default: jest.fn(
      ({
        label,
        value,
        onChange,
      }: {
        label: string;
        value: string;
        onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
      }) => {return <textarea aria-label={label} value={value} onChange={onChange} />},
    ),
  };
});

jest.mock('@/shared/ui/button/Button', () => {
  return {
    Button: jest.fn(
      ({
        children,
        onClick,
        disabled,
        'aria-label': ariaLabel,
        ...rest
      }: React.PropsWithChildren<{
        onClick?: () => void;
        disabled?: boolean;
        'aria-label'?: string;
      }>) => {return (
        <button
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          {...rest}
        >
          {children}
        </button>
      )},
    ),
  };
});

jest.mock('lucide-react', () => {return {
  Trash2: () => {return <span data-testid='trash-icon' />},
  ChevronDown: () => {return <span data-testid='chevron-down' />},
  ChevronUp: () => {return <span data-testid='chevron-up' />},
}});

import { OnboardingGoalCard } from '../onboarding-goal-card';

const BASE_GOAL: EditableGoal = {
  _id: 'goal-test-1',
  title: 'Improve onboarding',
  description: 'Make onboarding smoother',
  tasks: [],
};

describe('OnboardingGoalCard', () => {
  it('renders goal title in the header', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText('Improve onboarding')).toBeInTheDocument();
  });

  it('falls back to "Untitled goal" when title is empty', () => {
    const goal = { ...BASE_GOAL, title: '' };
    render(
      <OnboardingGoalCard
        goal={goal}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText('Untitled goal')).toBeInTheDocument();
  });

  it('renders index badge with 1-based number', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={2}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('index 0 card starts expanded', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /goal title/i })).toBeInTheDocument();
  });

  it('index > 0 card starts collapsed (inputs not visible)', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.queryByRole('textbox', { name: /goal title/i })).not.toBeInTheDocument();
  });

  it('clicking the title zone expands a collapsed card', async () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    // Click the title text directly (inside the title zone div)
    await userEvent.click(screen.getByText('Improve onboarding'));
    expect(screen.getByRole('textbox', { name: /goal title/i })).toBeInTheDocument();
  });

  it('clicking the chevron button expands a collapsed card', async () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /expand goal/i }));
    expect(screen.getByRole('textbox', { name: /goal title/i })).toBeInTheDocument();
  });

  it('clicking the chevron button collapses an expanded card', async () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /collapse goal/i }));
    expect(screen.queryByRole('textbox', { name: /goal title/i })).not.toBeInTheDocument();
  });

  it('when expanded, inputs render with correct values', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /goal title/i })).toHaveValue('Improve onboarding');
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('Make onboarding smoother');
  });

  it('changing title input calls onUpdate with merged goal', async () => {
    const onUpdate = jest.fn();
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={onUpdate}
        onRemove={jest.fn()}
      />,
    );
    const titleInput = screen.getByRole('textbox', { name: /goal title/i });
    await userEvent.type(titleInput, 'x');
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...BASE_GOAL,
      title: 'Improve onboardingx',
    });
  });

  it('changing description textarea calls onUpdate with merged goal', async () => {
    const onUpdate = jest.fn();
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={onUpdate}
        onRemove={jest.fn()}
      />,
    );
    const descInput = screen.getByRole('textbox', { name: /description/i });
    await userEvent.type(descInput, 'x');
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...BASE_GOAL,
      description: 'Make onboarding smootherx',
    });
  });

  it('clicking the trash button calls onRemove exactly once', async () => {
    const onRemove = jest.fn();
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByTestId('trash-icon').closest('button')!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('clicking the title zone does NOT call onRemove', async () => {
    const onRemove = jest.fn();
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByText('Improve onboarding'));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('clicking the chevron button does NOT call onRemove', async () => {
    const onRemove = jest.fn();
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /expand goal/i }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('trash button is disabled when disabled prop is true', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
        disabled
      />,
    );
    expect(screen.getByTestId('trash-icon').closest('button')).toBeDisabled();
  });

  it('trash button has accessible aria-label with goal title', () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={0}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /remove goal 1: improve onboarding/i }),
    ).toBeInTheDocument();
  });

  it('chevron button has aria-expanded matching expanded state', async () => {
    render(
      <OnboardingGoalCard
        goal={BASE_GOAL}
        index={1}
        onUpdate={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    const chevron = screen.getByRole('button', { name: /expand goal/i });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(chevron);
    expect(screen.getByRole('button', { name: /collapse goal/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});