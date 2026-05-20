'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

export interface SortableSectionProps {
  id: string;
  label: string;
  isReadOnly: boolean;
  onRemove: () => void;
}

export function SortableSection({
  id,
  label,
  isReadOnly,
  onRemove,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='flex items-center gap-3 px-3 py-2 rounded-md bg-white/5 border border-white/10'
    >
      <button
        type='button'
        {...attributes}
        {...listeners}
        disabled={isReadOnly}
        className='text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40'
        aria-label='Drag to reorder'
      >
        <GripVertical className='w-4 h-4' />
      </button>

      <span className='flex-1 text-sm font-medium text-foreground'>
        {label}
      </span>

      {!isReadOnly && (
        <button
          type='button'
          onClick={onRemove}
          className='text-muted-foreground hover:text-destructive transition-colors'
          aria-label={`Remove ${label}`}
        >
          <X className='w-4 h-4' />
        </button>
      )}
    </div>
  );
}
