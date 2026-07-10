import { render, screen } from '@testing-library/react';

import EventSummary from '@/features/event/ui/event-summary';

import type { EventProps } from '@/entities/event';

// Mock lucide icons used in options.tsx
jest.mock('lucide-react', () => {
  return {
    Clock4: () => {
      return <svg data-testid='icon-clock' />;
    },
    Dot: () => {
      return <span>·</span>;
    },
    Video: () => {
      return <svg data-testid='icon-video' />;
    },
    TextAlignJustify: () => {
      return <svg data-testid='icon-text' />;
    },
  };
});

// Mock ButtonCopy to avoid clipboard API
jest.mock('@/shared/ui/button/button-copy', () => {
  return {
    __esModule: true,
    default: ({ copyText }: { copyText: string }) => {
      return <button aria-label='copy'>{copyText}</button>;
    },
  };
});

// Mock html-react-parser
jest.mock('html-react-parser', () => {
  return {
    __esModule: true,
    default: (html: string) => {
      return html;
    },
  };
});

const makeEvent = (overrides: Partial<EventProps> = {}): EventProps => {
  return {
    id: 1,
    title: 'Sprint Planning',
    description: '<p>Planning session</p>',
    starts_at: '2024-03-15 10:00:00',
    ends_at: '2024-03-15 11:00:00',
    url: 'https://meet.example.com/room',
    platform: 'zoom',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
    ...overrides,
  };
};

describe('EventSummary', () => {
  it('renders clock icon', () => {
    render(<EventSummary event={makeEvent()} />);
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
  });

  it('renders video icon', () => {
    render(<EventSummary event={makeEvent()} />);
    expect(screen.getByTestId('icon-video')).toBeInTheDocument();
  });

  it('renders event URL', () => {
    render(<EventSummary event={makeEvent()} />);
    expect(
      screen.getAllByText('https://meet.example.com/room').length,
    ).toBeGreaterThan(0);
  });

  it('renders description content', () => {
    render(
      <EventSummary
        event={makeEvent({ description: '<p>Planning session</p>' })}
      />,
    );
    expect(screen.getByText('<p>Planning session</p>')).toBeInTheDocument();
  });

  it('shows fallback when description is empty', () => {
    render(<EventSummary event={makeEvent({ description: '' })} />);
    expect(
      screen.getByText('This event has no description'),
    ).toBeInTheDocument();
  });
});
