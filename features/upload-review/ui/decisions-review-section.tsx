'use client';

import { Trash2, Undo2 } from 'lucide-react';

import type { ExtractionPlanDecisionItem } from '@/features/upload-review/model/types';

export interface DecisionRow extends ExtractionPlanDecisionItem {
  removed: boolean;
}

type EditableField = 'text' | 'author_name' | 'topic';

const FIELD =
  'w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50';

export function DecisionsReviewSection({
  rows,
  onChange,
  onToggleRemove,
}: {
  rows: DecisionRow[];
  onChange: (uid: string, field: EditableField, value: string) => void;
  onToggleRemove: (uid: string) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  // A skipped item is treated as removed (not persisted); show it dimmed and restorable.
  const kept = rows.filter((r) => {
    return !r.removed && !r.skip;
  }).length;

  return (
    <section className='flex flex-col gap-3'>
      <h3 className='text-sm font-semibold text-foreground'>
        Decisions · {kept} to be saved
      </h3>

      {rows.map((row) => {
        const off = row.removed || row.skip;
        return (
          <div
            key={row.uid}
            className={`rounded-md border border-border p-3 ${off ? 'opacity-50' : ''}`}
          >
            <div className='flex items-start justify-between gap-2'>
              <label className='flex w-full flex-col gap-1 text-xs text-muted-foreground'>
                Decision
                <textarea
                  className={FIELD}
                  rows={2}
                  disabled={off}
                  value={row.text}
                  onChange={(e) => {
                    return onChange(row.uid, 'text', e.target.value);
                  }}
                />
              </label>
              <button
                type='button'
                onClick={() => {
                  return onToggleRemove(row.uid);
                }}
                className='mt-5 shrink-0 text-muted-foreground hover:text-destructive'
                aria-label={off ? 'Restore decision' : 'Remove decision'}
              >
                {off ? (
                  <Undo2 className='h-4 w-4' />
                ) : (
                  <Trash2 className='h-4 w-4' />
                )}
              </button>
            </div>

            <div className='mt-2 grid grid-cols-2 gap-2'>
              <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
                Author
                <input
                  className={FIELD}
                  disabled={off}
                  value={row.author_name ?? ''}
                  onChange={(e) => {
                    return onChange(row.uid, 'author_name', e.target.value);
                  }}
                />
              </label>
              <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
                Topic
                <input
                  className={FIELD}
                  disabled={off}
                  value={row.topic ?? ''}
                  onChange={(e) => {
                    return onChange(row.uid, 'topic', e.target.value);
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}
    </section>
  );
}
