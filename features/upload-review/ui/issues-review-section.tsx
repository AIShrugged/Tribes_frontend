'use client';

import { ExternalLink, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';

import { ROUTES } from '@/shared/lib/routes';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import type {
  ExtractionPlanExistingSnapshot,
  ExtractionPlanIssueDecision,
  ExtractionPlanIssueItem,
} from '@/features/upload-review/model/types';

export interface IssueRow extends ExtractionPlanIssueItem {
  removed: boolean;
}

type EditableField = 'assignee_name' | 'due_date' | 'priority';

interface IssuesReviewSectionProps {
  rows: IssueRow[];
  decisions: ExtractionPlanIssueDecision[] | null;
  snapshots: ExtractionPlanExistingSnapshot[];
  assignees: string[];
  onChange: (uid: string, field: EditableField, value: string) => void;
  onToggleRemove: (uid: string) => void;
}

interface IssueReviewRowProps {
  row: IssueRow;
  decision: ExtractionPlanIssueDecision | undefined;
  snapshot: ExtractionPlanExistingSnapshot | undefined;
  assignees: string[];
  onChange: (uid: string, field: EditableField, value: string) => void;
  onToggleRemove: (uid: string) => void;
}

interface IssueFieldsProps {
  row: IssueRow;
  snapshot: ExtractionPlanExistingSnapshot | undefined;
  assignees: string[];
  onChange: (uid: string, field: EditableField, value: string) => void;
}

const FIELD =
  'w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50';

// Matches IssueMergeService::mapPriority (anything else → normal).
const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'minimal', label: 'Minimal' },
];

// Existing issues carry priority as an int (Issue::PRIORITY_*); map back to a label for the
// "now → new" diff. Mirrors the value scheme in IssueMergeService::mapPriority.
function priorityLabel(p: string | number | null): string {
  const n = typeof p === 'string' ? Number(p) : p;
  switch (n) {
    case 500: {
      return 'Critical';
    }
    case 100: {
      return 'High';
    }
    case -100: {
      return 'Low';
    }
    case -500: {
      return 'Minimal';
    }
    default: {
      return 'Normal';
    }
  }
}

const single = (v: string | string[]): string => {
  return Array.isArray(v) ? (v[0] ?? '') : v;
};

// Preserve an AI-suggested assignee that isn't a current team member, so it isn't silently lost.
function assigneeOptions(assignees: string[], current: string | null) {
  const base = [
    { value: '', label: '— Unassigned —' },
    ...assignees.map((name) => {
      return { value: name, label: name };
    }),
  ];
  if (current && current.trim() !== '' && !assignees.includes(current)) {
    return [...base, { value: current, label: `${current} (not in team)` }];
  }
  return base;
}

/** Muted "now: X" hint next to an editable field's label — the current value on an UPDATE row. */
function CurrentValue({ value }: { value: string | null }) {
  return (
    <span className='ml-1 font-normal text-muted-foreground/70'>
      · now: {value && value.trim() !== '' ? value : '—'}
    </span>
  );
}

/** Badge + title: a linked "Updates #N" with the existing task name, or a plain "New". */
function IssueRowHeader({
  row,
  snapshot,
}: {
  row: IssueRow;
  snapshot: ExtractionPlanExistingSnapshot | undefined;
}) {
  if (snapshot) {
    return (
      <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
        <Link
          href={ROUTES.DASHBOARD.ISSUES_DETAIL(snapshot.id)}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-1 rounded bg-[var(--warning-bg)] px-1.5 py-0.5 text-xs text-[var(--warning)] hover:underline'
        >
          Updates #{snapshot.id}
          <ExternalLink className='h-3 w-3' />
        </Link>
        <span className='font-medium text-foreground'>{snapshot.name}</span>
      </div>
    );
  }
  return (
    <>
      <span className='mr-2 rounded bg-[var(--success-bg)] px-1.5 py-0.5 text-xs text-[var(--success)]'>
        New
      </span>
      <span className='font-medium text-foreground'>{row.name}</span>
    </>
  );
}

/** Assignee / due date / priority editors. On an UPDATE row each shows the current ("now") value. */
function IssueFields({ row, snapshot, assignees, onChange }: IssueFieldsProps) {
  return (
    <div className='mt-2 grid grid-cols-2 gap-2'>
      <div className='flex flex-col gap-1'>
        <span className='text-xs text-muted-foreground'>
          Assignee
          {snapshot && <CurrentValue value={snapshot.assignee_name} />}
        </span>
        <InputDropdown
          options={assigneeOptions(assignees, row.assignee_name)}
          value={row.assignee_name ?? ''}
          onChange={(v) => {
            return onChange(row.uid, 'assignee_name', single(v));
          }}
          placeholder='Unassigned'
          searchable
          disabled={row.removed}
        />
      </div>

      <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
        <span>
          Due date
          {snapshot && <CurrentValue value={snapshot.due_date} />}
        </span>
        <input
          type='date'
          className={FIELD}
          disabled={row.removed}
          value={row.due_date ?? ''}
          onClick={(e) => {
            // Open the calendar on a click anywhere in the field, not just the icon.
            try {
              e.currentTarget.showPicker();
            } catch {
              // Picker already open or unsupported — the native icon still works.
            }
          }}
          onChange={(e) => {
            return onChange(row.uid, 'due_date', e.target.value);
          }}
        />
      </label>

      <div className='flex flex-col gap-1'>
        <span className='text-xs text-muted-foreground'>
          Priority
          {snapshot && (
            <CurrentValue value={priorityLabel(snapshot.priority)} />
          )}
        </span>
        <InputDropdown
          options={PRIORITY_OPTIONS}
          value={row.priority ?? 'normal'}
          onChange={(v) => {
            return onChange(row.uid, 'priority', single(v));
          }}
          searchable={false}
          disabled={row.removed}
        />
      </div>
    </div>
  );
}

/** Remove / restore toggle for a task row. */
function RemoveButton({
  removed,
  onToggle,
}: {
  removed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onToggle}
      className='shrink-0 text-muted-foreground hover:text-destructive'
      aria-label={removed ? 'Restore task' : 'Remove task'}
    >
      {removed ? <Undo2 className='h-4 w-4' /> : <Trash2 className='h-4 w-4' />}
    </button>
  );
}

/** UPDATE-row meta: the extracted wording that matched + the LLM's summary of what's new. */
function UpdateMeta({
  row,
  decision,
  snapshot,
}: {
  row: IssueRow;
  decision: ExtractionPlanIssueDecision | undefined;
  snapshot: ExtractionPlanExistingSnapshot | undefined;
}) {
  if (!snapshot) {
    return null;
  }
  return (
    <>
      <p className='mt-1 text-xs text-muted-foreground'>
        Matched from extracted text: “{row.name}”
      </p>
      {decision?.update_description && (
        <p className='mt-1 whitespace-pre-wrap text-xs text-foreground'>
          {decision.update_description}
        </p>
      )}
    </>
  );
}

/**
 * One reviewable task row. Three shapes:
 *  - skip   → de-emphasized "already in your tasks, won't be added" notice. The merge-LLM matched
 *             this item to an existing task and the upload adds nothing new, so approve creates and
 *             updates nothing for it (re-uploading the same file lands here).
 *  - update → linked "Updates #N" + the existing task's name + the LLM's "what's new" + now→new diff.
 *  - new    → "New" + the extracted name/description.
 */
function IssueReviewRow({
  row,
  decision,
  snapshot,
  assignees,
  onChange,
  onToggleRemove,
}: IssueReviewRowProps) {
  if (decision?.action === 'skip') {
    return (
      <div className='rounded-md border border-dashed border-border p-3 opacity-70'>
        <div className='flex items-center gap-2'>
          <span className='shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
            Duplicate
          </span>
          <span className='min-w-0 truncate text-sm text-muted-foreground line-through'>
            {row.name}
          </span>
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>
          Already in your tasks — won’t be added.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-border p-3 ${row.removed ? 'opacity-50' : ''}`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <IssueRowHeader row={row} snapshot={snapshot} />
        </div>
        <RemoveButton
          removed={row.removed}
          onToggle={() => {
            return onToggleRemove(row.uid);
          }}
        />
      </div>

      <UpdateMeta row={row} decision={decision} snapshot={snapshot} />

      {/* NEW: the extracted task description. */}
      {!snapshot && row.description && (
        <p className='mt-1 whitespace-pre-wrap text-xs text-muted-foreground'>
          {row.description}
        </p>
      )}

      <IssueFields
        row={row}
        snapshot={snapshot}
        assignees={assignees}
        onChange={onChange}
      />
    </div>
  );
}

export function IssuesReviewSection({
  rows,
  decisions,
  snapshots,
  assignees,
  onChange,
  onToggleRemove,
}: IssuesReviewSectionProps) {
  const decByUid = new Map(
    (decisions ?? []).map((d) => {
      return [d.uid, d] as const;
    }),
  );
  // Key by Number so a string-typed id from the LLM JSON still resolves.
  const snapById = new Map(
    snapshots.map((s) => {
      return [Number(s.id), s] as const;
    }),
  );

  const toSave = rows.filter((r) => {
    return !r.removed && decByUid.get(r.uid)?.action !== 'skip';
  }).length;
  const skipped = rows.filter((r) => {
    return decByUid.get(r.uid)?.action === 'skip';
  }).length;

  return (
    <section className='flex flex-col gap-3'>
      <div>
        <h3 className='text-sm font-semibold text-foreground'>
          Tasks · {toSave} to be saved
        </h3>
        {skipped > 0 && (
          <p className='mt-0.5 text-xs text-muted-foreground'>
            {skipped} already in your tasks — will be skipped.
          </p>
        )}
      </div>

      {rows.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No tasks were extracted.
        </p>
      )}

      {rows.map((row) => {
        const dec = decByUid.get(row.uid);
        // A row is a real UPDATE only when its target is an issue we actually hold a snapshot for.
        // If the merge-LLM returned an existing_issue_id outside the team's open-issue set
        // (hallucinated or since-closed), approve CREATES a new task instead — so we resolve no
        // snapshot and the row renders as "New", never linking a misleading #id. snapById is keyed
        // by the same ids the LLM was given, so any legitimate match resolves here.
        const snap =
          dec?.action === 'update' && dec.existing_issue_id != null
            ? snapById.get(Number(dec.existing_issue_id))
            : undefined;

        return (
          <IssueReviewRow
            key={row.uid}
            row={row}
            decision={dec}
            snapshot={snap}
            assignees={assignees}
            onChange={onChange}
            onToggleRemove={onToggleRemove}
          />
        );
      })}
    </section>
  );
}
