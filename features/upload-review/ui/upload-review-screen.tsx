'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  approveUpload,
  rejectUpload,
  updatePlan,
} from '@/features/upload-review/api/upload-review';
import {
  DecisionsReviewSection,
  type DecisionRow,
} from '@/features/upload-review/ui/decisions-review-section';
import {
  IssuesReviewSection,
  type IssueRow,
} from '@/features/upload-review/ui/issues-review-section';
import { MeetingReviewBlock } from '@/features/upload-review/ui/meeting-review-block';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

import type {
  ExtractionPlanEditInput,
  ExtractionPlanPayload,
  UploadReviewType,
} from '@/features/upload-review/model/types';

/** Default due date when the AI extracted none: one week out, in local YYYY-MM-DD. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function hasValue(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

export function UploadReviewScreen({
  type,
  id,
  initialPlan,
  assignees,
}: {
  type: UploadReviewType;
  id: number;
  initialPlan: ExtractionPlanPayload | null;
  assignees: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [issueRows, setIssueRows] = useState<IssueRow[]>(() => {
    return (initialPlan?.issues?.items ?? []).map((i) => {
      return {
        ...i,
        due_date: hasValue(i.due_date) ? i.due_date : defaultDueDate(),
        priority: hasValue(i.priority) ? i.priority : 'normal',
        removed: false,
      };
    });
  });
  const [decisionRows, setDecisionRows] = useState<DecisionRow[]>(() => {
    return (initialPlan?.decisions?.items ?? []).map((d) => {
      return { ...d, removed: false };
    });
  });

  const onIssueChange = (
    uid: string,
    field: 'assignee_name' | 'due_date' | 'priority',
    value: string,
  ) => {
    setIssueRows((rows) => {
      return rows.map((r) => {
        return r.uid === uid ? { ...r, [field]: value } : r;
      });
    });
  };

  const onIssueToggleRemove = (uid: string) => {
    setIssueRows((rows) => {
      return rows.map((r) => {
        return r.uid === uid ? { ...r, removed: !r.removed } : r;
      });
    });
  };

  const onDecisionChange = (
    uid: string,
    field: 'text' | 'author_name' | 'topic',
    value: string,
  ) => {
    setDecisionRows((rows) => {
      return rows.map((r) => {
        return r.uid === uid ? { ...r, [field]: value } : r;
      });
    });
  };

  // Toggle the combined off-state (LLM skip OR user removed). Restoring clears both,
  // which is how a user un-skips a decision the LLM flagged as procedural noise.
  const onDecisionToggleRemove = (uid: string) => {
    setDecisionRows((rows) => {
      return rows.map((r) => {
        if (r.uid !== uid) return r;
        const off = r.removed || r.skip;
        return off
          ? { ...r, removed: false, skip: false }
          : { ...r, removed: true };
      });
    });
  };

  const buildPayload = (): ExtractionPlanEditInput => {
    return {
      issues: issueRows
        .filter((r) => {
          return !r.removed;
        })
        .map((r) => {
          return {
            uid: r.uid,
            assignee_name: r.assignee_name,
            due_date: r.due_date,
            priority: r.priority,
          };
        }),
      decisions: decisionRows
        .filter((r) => {
          return !r.removed && !r.skip;
        })
        .map((r) => {
          return {
            uid: r.uid,
            text: r.text,
            author_name: r.author_name,
            topic: r.topic,
            skip: false,
          };
        }),
    };
  };

  const onApprove = () => {
    startTransition(async () => {
      const saved = await updatePlan(type, id, buildPayload());
      if (saved.error) {
        toast.error(saved.error);
        return;
      }

      const result = await approveUpload(type, id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Approved — tasks saved and notifications sent.');
      router.refresh();
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const result = await rejectUpload(type, id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Discarded.');
      router.refresh();
    });
  };

  return (
    <div className='flex flex-col gap-5 px-5 py-4'>
      <div>
        <h2 className='text-lg font-semibold text-foreground'>
          Review extracted data
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Edit or remove items below. Nothing is saved and no notifications are
          sent until you approve.
        </p>
      </div>

      <IssuesReviewSection
        rows={issueRows}
        decisions={initialPlan?.issues?.decisions ?? null}
        snapshots={initialPlan?.issues?.existing_snapshots ?? []}
        assignees={assignees}
        onChange={onIssueChange}
        onToggleRemove={onIssueToggleRemove}
      />

      <DecisionsReviewSection
        rows={decisionRows}
        onChange={onDecisionChange}
        onToggleRemove={onDecisionToggleRemove}
      />

      <MeetingReviewBlock reviewId={initialPlan?.review?.review_id ?? null} />

      <div className='sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/80 py-3 backdrop-blur'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          onClick={onReject}
          disabled={isPending}
        >
          Discard
        </Button>
        <Button type='button' onClick={onApprove} disabled={isPending}>
          {isPending ? 'Saving…' : 'Approve'}
        </Button>
      </div>
    </div>
  );
}
