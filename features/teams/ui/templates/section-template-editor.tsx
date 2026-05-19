'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/shared/ui/button/Button';

import { SortableSection } from './sortable-section';

export interface SectionGroup<S extends string> {
  id: string;
  title: string;
  sections: readonly S[];
}

export interface SectionTemplateEditorProps<S extends string> {
  title: string;
  description?: string;
  badge?: string | null;
  availableSections: readonly S[];
  initialSelected: readonly S[];
  labels: Record<S, string>;
  groups?: ReadonlyArray<SectionGroup<S>>;
  isReadOnly: boolean;
  isSaving: boolean;
  onSave: (next: S[]) => void | Promise<void>;
}

/**
 * Generic section template editor with drag-and-drop reorder.
 *
 * - When `groups` is provided, each group renders as its own SortableContext.
 *   @dnd-kit naturally prevents cross-group drag because each context has its
 *   own id list, so a drop event only fires within the originating group.
 * - Section can be removed (cross icon) and added back from the "Available"
 *   list.
 * - Save is disabled until state is dirty AND at least one section is selected.
 */
export function SectionTemplateEditor<S extends string>({
  title,
  description,
  badge,
  availableSections,
  initialSelected,
  labels,
  groups,
  isReadOnly,
  isSaving,
  onSave,
}: SectionTemplateEditorProps<S>) {
  const [selected, setSelected] = useState<S[]>([...initialSelected]);

  // Reset local state when parent reloads (e.g. after save).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected([...initialSelected]);
  }, [initialSelected]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const initialKey = useMemo(() => {
    return initialSelected.join('|');
  }, [initialSelected]);
  const currentKey = useMemo(() => {
    return selected.join('|');
  }, [selected]);
  const isDirty = initialKey !== currentKey;

  const availableForAdd = useMemo(() => {
    return availableSections.filter((s) => {
      return !selected.includes(s);
    });
  }, [availableSections, selected]);

  const groupsForRender: ReadonlyArray<SectionGroup<S>> = useMemo(() => {
    if (groups && groups.length > 0) return groups;
    return [{ id: 'all', title, sections: availableSections }];
  }, [groups, availableSections, title]);

  const selectedByGroup = useMemo(() => {
    const map = new Map<string, S[]>();
    for (const group of groupsForRender) {
      const groupSet = new Set<S>(group.sections);
      map.set(
        group.id,
        selected.filter((s) => {
          return groupSet.has(s);
        }),
      );
    }
    return map;
  }, [selected, groupsForRender]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Find which group both items belong to (must be the same — @dnd-kit
      // SortableContext per group enforces this naturally).
      const groupId = String(active.id).split(':')[0];
      const overGroupId = String(over.id).split(':')[0];
      if (groupId !== overGroupId) return;

      const groupSections = selectedByGroup.get(groupId) ?? [];
      const oldIndex = groupSections.findIndex((s) => {
        return `${groupId}:${s}` === active.id;
      });
      const newIndex = groupSections.findIndex((s) => {
        return `${groupId}:${s}` === over.id;
      });
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(groupSections, oldIndex, newIndex);

      // Splice the reordered group back into the global `selected` array
      // preserving the order of other groups.
      const next: S[] = [];
      for (const group of groupsForRender) {
        if (group.id === groupId) {
          next.push(...reordered);
        } else {
          next.push(...(selectedByGroup.get(group.id) ?? []));
        }
      }
      setSelected(next);
    },
    [selectedByGroup, groupsForRender],
  );

  const handleRemove = (section: S) => {
    setSelected((prev) => {
      return prev.filter((s) => {
        return s !== section;
      });
    });
  };

  const handleAdd = (section: S) => {
    // Append to the end of its group's sub-list to keep group ordering intact.
    setSelected((prev) => {
      const group = groupsForRender.find((g) => {
        return (g.sections as readonly S[]).includes(section);
      });
      if (!group) return [...prev, section];

      const next: S[] = [];
      let inserted = false;

      for (const g of groupsForRender) {
        const groupItems = prev.filter((s) => {
          return (g.sections as readonly S[]).includes(s);
        });

        if (g.id === group.id) {
          next.push(...groupItems, section);
          inserted = true;
        } else {
          next.push(...groupItems);
        }
      }

      return inserted ? next : [...prev, section];
    });
  };

  const handleSaveClick = () => {
    if (!isDirty || selected.length === 0) return;
    onSave(selected);
  };

  return (
    <section className='rounded-[var(--radius-card)] border border-border bg-card p-5'>
      <header className='flex items-start justify-between gap-3 mb-4'>
        <div>
          <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
            {title}
            {badge && (
              <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground'>
                {badge}
              </span>
            )}
          </h3>
          {description && (
            <p className='text-sm text-muted-foreground mt-1'>{description}</p>
          )}
        </div>
      </header>

      {isReadOnly && (
        <p className='text-xs text-muted-foreground mb-3'>
          Only organization managers can edit this template.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className='flex flex-col gap-5'>
          {groupsForRender.map((group) => {
            const groupSelected = selectedByGroup.get(group.id) ?? [];
            const itemIds = groupSelected.map((s) => {
              return `${group.id}:${s}`;
            });

            return (
              <div key={group.id} className='flex flex-col gap-2'>
                {groups && groups.length > 0 && (
                  <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    {group.title}
                  </h4>
                )}

                {groupSelected.length === 0 ? (
                  <p className='text-xs text-muted-foreground italic'>
                    No sections selected in this group.
                  </p>
                ) : (
                  <SortableContext
                    items={itemIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className='flex flex-col gap-1.5'>
                      {groupSelected.map((section) => {
                        return (
                          <SortableSection
                            key={`${group.id}:${section}`}
                            id={`${group.id}:${section}`}
                            label={labels[section]}
                            isReadOnly={isReadOnly}
                            onRemove={() => {
                              return handleRemove(section);
                            }}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                )}
              </div>
            );
          })}
        </div>
      </DndContext>

      {!isReadOnly && availableForAdd.length > 0 && (
        <div className='mt-5'>
          <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2'>
            Available sections
          </p>
          <div className='flex flex-wrap gap-2'>
            {availableForAdd.map((section) => {
              return (
                <button
                  key={section}
                  type='button'
                  onClick={() => {
                    return handleAdd(section);
                  }}
                  className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border bg-background text-foreground hover:bg-white/5 transition-colors'
                >
                  <Plus className='size-3' />
                  {labels[section]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div className='mt-5 flex items-center justify-end'>
          <Button
            onClick={handleSaveClick}
            disabled={!isDirty || selected.length === 0 || isSaving}
            loading={isSaving}
            loadingText='Saving...'
            type='button'
          >
            Save template
          </Button>
        </div>
      )}
    </section>
  );
}
