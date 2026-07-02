import { render, screen } from '@testing-library/react';

import { IssueCodeBadge, issueCodeLabel } from '@/entities/issue';

describe('issueCodeLabel', () => {
  it('returns the code when present', () => {
    expect(issueCodeLabel('DEV-14', 512)).toBe('DEV-14');
  });

  it('falls back to #id when code is null', () => {
    expect(issueCodeLabel(null, 512)).toBe('#512');
  });

  it('falls back to #id when code is undefined', () => {
    expect(issueCodeLabel(undefined, 7)).toBe('#7');
  });
});

describe('IssueCodeBadge', () => {
  it('renders the code', () => {
    render(<IssueCodeBadge code='DEV-14' id={512} />);
    expect(screen.getByText('DEV-14')).toBeInTheDocument();
  });

  it('renders #id fallback when code is null', () => {
    render(<IssueCodeBadge code={null} id={512} />);
    expect(screen.getByText('#512')).toBeInTheDocument();
  });
});
