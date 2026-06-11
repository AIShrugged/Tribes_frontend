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

/** Muted "now: X" hint next to an editable field's label — the current value on an UPDATE row. */
function CurrentValue({ value }: { value: string | null }) {
  return (
    <span className='ml-1 font-normal text-muted-foreground/70'>
      · now: {value && value.trim() !== '' ? value : '—'}
    </span>
  );
}

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
  // Key by Number so a string-typed id from the LLM JSON still resolves.
  const snapById = new Map(
    snapshots.map((s) => {
      return [Number(s.id), s] as const;
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
        // A row is a real UPDATE only when its target is an issue we actually hold a snapshot for.
        // If the merge-LLM returned an existing_issue_id outside the team's open-issue set
        // (hallucinated or since-closed), the approve path CREATES a new task instead of updating —
        // so render it as "New" and never link a misleading #id to an unrelated task. snapById is
        // keyed by the same ids the LLM was given, so any legitimate match resolves here.
        const snap =
          dec?.action === 'update' && dec.existing_issue_id != null
            ? snapById.get(Number(dec.existing_issue_id))
            : undefined;

        return (
          <div
            key={row.uid}
            className={`rounded-md border border-border p-3 ${row.removed ? 'opacity-50' : ''}`}
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                {snap ? (
                  <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <Link
                      href={ROUTES.DASHBOARD.ISSUES_DETAIL(snap.id)}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 rounded bg-[var(--warning-bg)] px-1.5 py-0.5 text-xs text-[var(--warning)] hover:underline'
                    >
                      Updates #{snap.id}
                      <ExternalLink className='h-3 w-3' />
                    </Link>
                    <span className='font-medium text-foreground'>
                      {snap.name}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className='mr-2 rounded bg-[var(--success-bg)] px-1.5 py-0.5 text-xs text-[var(--success)]'>
                      New
                    </span>
                    <span className='font-medium text-foreground'>
                      {row.name}
                    </span>
                  </>
                )}
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

            {/* UPDATE: the extracted wording that matched this existing task + the LLM's summary
                of what new information it adds. */}
            {snap && (
              <p className='mt-1 text-xs text-muted-foreground'>
                Matched from extracted text: “{row.name}”
              </p>
            )}
            {snap && dec?.update_description && (
              <p className='mt-1 whitespace-pre-wrap text-xs text-foreground'>
                {dec.update_description}
              </p>
            )}

            {/* NEW: the extracted task description. */}
            {!snap && row.description && (
              <p className='mt-1 whitespace-pre-wrap text-xs text-muted-foreground'>
                {row.description}
              </p>
            )}

            <div className='mt-2 grid grid-cols-2 gap-2'>
              <div className='flex flex-col gap-1'>
                <span className='text-xs text-muted-foreground'>
                  Assignee
                  {snap && <CurrentValue value={snap.assignee_name} />}
                </span>
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
                <span>
                  Due date
                  {snap && <CurrentValue value={snap.due_date} />}
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
                  {snap && (
                    <CurrentValue value={priorityLabel(snap.priority)} />
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
          </div>
        );
      })}
    </section>
  );
}
