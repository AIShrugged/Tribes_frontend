'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { formatDateTime } from '@/features/agents/lib/format';
import { Badge } from '@/shared/ui/badge';
import { DataTable } from '@/shared/ui/table';

import type { AgentMemory } from '@/features/agents/model/types';
import type { TableColumn } from '@/shared/ui/table';

function MemoryContentCell({ content }: { content: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return <span className='text-muted-foreground'>—</span>;

  return (
    <div className='flex items-start gap-2'>
      <p
        className={
          expanded ? 'text-sm whitespace-pre-wrap break-words' : 'line-clamp-2 text-sm'
        }
      >
        {content}
      </p>
      <button
        type='button'
        aria-label={expanded ? 'Collapse content' : 'Expand content'}
        className='mt-0.5 shrink-0 text-muted-foreground hover:text-foreground'
        onClick={() => {return setExpanded((v) => {return !v})}}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );
}

const COLUMNS: TableColumn<AgentMemory>[] = [
  {
    id: 'scope',
    header: 'Scope',
    renderCell: (memory) => {
      const parts = [memory.scope_type, memory.scope_key].filter(Boolean);

      return (
        <span className='text-sm text-muted-foreground'>
          {parts.length > 0 ? parts.join(' / ') : '—'}
        </span>
      );
    },
  },
  {
    id: 'kind',
    header: 'Kind',
    renderCell: (memory) =>
      {return memory.kind ? <Badge>{memory.kind}</Badge> : <span className='text-muted-foreground'>—</span>},
  },
  {
    id: 'priority',
    header: 'Priority',
    cellClassName: 'text-muted-foreground',
    renderCell: (memory) => {return memory.priority ?? '—'},
  },
  {
    id: 'active',
    header: 'Active',
    renderCell: (memory) => {return (
      <Badge variant={memory.active ? 'success' : 'default'}>
        {memory.active ? 'Active' : 'Inactive'}
      </Badge>
    )},
  },
  {
    id: 'content',
    header: 'Content',
    cellClassName: 'max-w-[300px]',
    renderCell: (memory) => {return <MemoryContentCell content={memory.content} />},
  },
  {
    id: 'last_seen_at',
    header: 'Last seen',
    cellClassName: 'text-muted-foreground',
    renderCell: (memory) => {return formatDateTime(memory.last_seen_at)},
  },
];

export function AgentMemoriesList({
  memories,
  totalCount,
}: {
  memories: AgentMemory[];
  totalCount: number;
}) {
  return (
    <div>
      {totalCount > memories.length ? (
        <p className='mb-3 text-xs text-muted-foreground'>
          Showing {memories.length} of {totalCount} memories
        </p>
      ) : null}
      <DataTable
        columns={COLUMNS}
        items={memories}
        keyExtractor={(m) => {return m.id}}
        caption='Agent Memories'
        captionSrOnly
        tableMinWidth='min-w-[700px]'
        renderMobileCard={(memory) => {return (
          <div className='rounded-[var(--radius-card)] border border-border p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              {memory.kind ? <Badge>{memory.kind}</Badge> : null}
              <Badge variant={memory.active ? 'success' : 'default'}>
                {memory.active ? 'Active' : 'Inactive'}
              </Badge>
              {memory.priority == null ? null : (
                <span className='text-xs text-muted-foreground'>
                  Priority: {memory.priority}
                </span>
              )}
            </div>
            {memory.content ? (
              <p className='mt-2 text-sm text-foreground line-clamp-3'>
                {memory.content}
              </p>
            ) : null}
            <p className='mt-2 text-xs text-muted-foreground'>
              Last seen: {formatDateTime(memory.last_seen_at)}
            </p>
          </div>
        )}}
      />
    </div>
  );
}
