import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueTypeToggle } from '@/features/issues/ui/issue-type-toggle';

describe('IssueTypeToggle', () => {
  it('renders all three options', () => {
    render(<IssueTypeToggle value='' onChange={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Epics' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('marks the correct option as checked', () => {
    render(<IssueTypeToggle value='epic' onChange={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Epics' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls onChange with correct value on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IssueTypeToggle value='' onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Epics' }));
    expect(onChange).toHaveBeenCalledWith('epic');
  });

  it('calls onChange with "task" when Tasks is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IssueTypeToggle value='' onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Tasks' }));
    expect(onChange).toHaveBeenCalledWith('task');
  });

  it('ArrowRight moves focus and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IssueTypeToggle value='' onChange={onChange} />);
    const allBtn = screen.getByRole('radio', { name: 'All' });
    allBtn.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('epic');
  });

  it('ArrowRight from Tasks wraps back to All', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IssueTypeToggle value='task' onChange={onChange} />);
    const tasksBtn = screen.getByRole('radio', { name: 'Tasks' });
    tasksBtn.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('ArrowLeft from All wraps to Tasks', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<IssueTypeToggle value='' onChange={onChange} />);
    const allBtn = screen.getByRole('radio', { name: 'All' });
    allBtn.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('task');
  });
});