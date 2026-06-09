'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/button';

import { getSuggestionAction } from '../model/suggestion-helpers';

import type { MeetingTaskReviewIssue } from '../model/types';

interface MeetingTaskReviewActionsProps {
  issue: MeetingTaskReviewIssue;
}

export function MeetingTaskReviewActions({
  issue,
}: MeetingTaskReviewActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const action = getSuggestionAction(issue.suggestion);

  const handleAction = async () => {
    setIsLoading(true);
    try {
      if (action.href) {
        window.open(action.href, '_blank');
      } else if (action.onClick) {
        await action.onClick(issue);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size='sm'
      variant='secondary'
      onClick={handleAction}
      disabled={isLoading}
      className='text-xs'
    >
      {action.label}
    </Button>
  );
}
