'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getLatestMeetingTaskReview } from '../api/meeting-task-review';

import { MeetingTaskReviewCard } from './meeting-task-review-card';

import type { MeetingTaskReview } from '../model/types';

export function MeetingTaskReviewContainer() {
  const [review, setReview] = useState<MeetingTaskReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getLatestMeetingTaskReview();
      setReview(data);

      if (data?.status === 'pending' && pollCountRef.current < 10) {
        pollCountRef.current += 1;
        pollTimerRef.current = setTimeout(load, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [load]);

  return <MeetingTaskReviewCard review={review} isLoading={isLoading} />;
}
