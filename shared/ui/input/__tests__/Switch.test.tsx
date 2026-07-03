import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Switch } from '@/shared/ui/input/Switch';

describe('Switch', () => {
  it('reflects checked state via role and aria-checked', () => {
    render(<Switch checked aria-label='toggle' onCheckedChange={() => {}} />);

    const toggle = screen.getByRole('switch', { name: 'toggle' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange with the negated value on click', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();

    render(
      <Switch
        checked={false}
        aria-label='toggle'
        onCheckedChange={onCheckedChange}
      />,
    );

    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();

    render(
      <Switch
        checked={false}
        disabled
        aria-label='toggle'
        onCheckedChange={onCheckedChange}
      />,
    );

    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('is busy and non-interactive while loading', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();

    render(
      <Switch
        checked
        loading
        aria-label='toggle'
        onCheckedChange={onCheckedChange}
      />,
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
