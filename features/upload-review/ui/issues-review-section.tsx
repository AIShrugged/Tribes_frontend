'use client';

import { Trash2, Undo2 } from 'lucide-react';

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

const single = (v: string | string[]): string => {
  return Array.isArray(v) ? (v[0] ?? '') : v;
};

export function IssuesReviewSection({
  rows,
  decisions,
  snapshots,
  assignees,
  onChange,
  onToggleRemove,
}: {
  rows: IssueRow[];
  decisions: ExtractionPlanIssueDecision[] | null;
  snapshots: ExtractionPlanExistingSnapshot[];
  assignees: string[];
  onChange: (uid: string, field: EditableField, value: string) => void;
  onToggleRemove: (uid: string) => void;
}) {
  const decByUid = new Map(
    (decisions ?? []).map((d) => {
      return [d.uid, d] as const;
    }),
  );
  const snapById = new Map(
    snapshots.map((s) => {
      return [s.id, s] as const;
    }),
  );
  const kept = rows.filter((r) => {
    return !r.removed;
  }).length;

  const baseAssigneeOptions = [
    { value: '', label: '— Unassigned —' },
    ...assignees.map((name) => {
      return { value: name, label: name };
    }),
  ];

  // Preserve an AI-suggested assignee that isn't a current team member, so it isn't silently lost.
  const assigneeOptionsFor = (current: string | null) => {
    if (current && current.trim() !== '' && !assignees.includes(current)) {
      return [
        ...baseAssigneeOptions,
        { value: current, label: `${current} (not in team)` },
      ];
    }
    return baseAssigneeOptions;
  };

  return (
    <section className='flex flex-col gap-3'>
      <h3 className='text-sm font-semibold text-foreground'>
        Tasks · {kept} to be saved
      </h3>

      {rows.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No tasks were extracted.
        </p>
      )}

      {rows.map((row) => {
        const dec = decByUid.get(row.uid);
        const isUpdate =
          dec?.action === 'update' && dec.existing_issue_id != null;
        const snap = isUpdate
          ? snapById.get(dec.existing_issue_id as number)
          : undefined;

        return (
          <div
            key={row.uid}
            className={`rounded-md border border-border p-3 ${row.removed ? 'opacity-50' : ''}`}
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-xs ${isUpdate ? 'bg-[var(--warning-bg)] text-[var(--warning)]' : 'bg-[var(--success-bg)] text-[var(--success)]'}`}
                >
                  {isUpdate ? `Updates #${dec.existing_issue_id}` : 'New'}
                </span>
                <span className='font-medium text-foreground'>{row.name}</span>
              </div>
              <button
                type='button'
                onClick={() => {
                  return onToggleRemove(row.uid);
                }}
                className='shrink-0 text-muted-foreground hover:text-destructive'
                aria-label={row.removed ? 'Restore task' : 'Remove task'}
              >
                {row.removed ? (
                  <Undo2 className='h-4 w-4' />
                ) : (
                  <Trash2 className='h-4 w-4' />
                )}
              </button>
            </div>

            {row.description && (
              <p className='mt-1 whitespace-pre-wrap text-xs text-muted-foreground'>
                {row.description}
              </p>
            )}

            {snap && (
              <p className='mt-1 text-xs text-muted-foreground'>
                Existing: {snap.assignee_name ?? 'no assignee'} ·{' '}
                {snap.due_date ?? 'no due date'}
                {dec?.update_description ? ` — ${dec.update_description}` : ''}
              </p>
            )}

            <div className='mt-2 grid grid-cols-2 gap-2'>
              <div className='flex flex-col gap-1'>
                <span className='text-xs text-muted-foreground'>Assignee</span>
                <InputDropdown
                  options={assigneeOptionsFor(row.assignee_name)}
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
                Due date
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
                <span className='text-xs text-muted-foreground'>Priority</span>
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
          </div>
        );
      })}
    </section>
  );
}
