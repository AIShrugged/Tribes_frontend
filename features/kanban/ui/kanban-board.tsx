'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';

import { getPriorityLevel } from '@/entities/issue';
import { moveKanbanCard } from '@/features/kanban/api/kanban';
import { useArchivedCards } from '@/features/kanban/hooks/use-archived-cards';
import {
  type IssueStatus,
  type KanbanBoardProps,
  type KanbanCard,
  KANBAN_COLUMNS,
} from '@/features/kanban/model/types';
import { ArchivedDoneSection } from '@/features/kanban/ui/archived-done-section';
import { ArchivedDoneToggle } from '@/features/kanban/ui/archived-done-toggle';
import { KanbanCardModal } from '@/features/kanban/ui/kanban-card-modal';
import { KanbanColumn } from '@/features/kanban/ui/kanban-column';

export function KanbanBoard({
  columns,
  filters,
  onShowArchivedChange,
}: KanbanBoardProps) {
  const [optimisticColumns, setOptimisticColumns] = useState<Record<
    IssueStatus,
    KanbanCard[]
  > | null>(null);
  const [movingCardId, setMovingCardId] = useState<number | null>(null);
  const [hoveredCard, setHoveredCard] = useState<KanbanCard | null>(null);
  const [, startTransition] = useTransition();

  const showArchived = filters.show_archived;
  const activeColumns = optimisticColumns ?? columns;

  const {
    archivedDoneCards,
    archivedDoneCount,
    archivedDoneLoading,
    setArchivedDoneCards,
    setArchivedDoneCount,
  } = useArchivedCards(filters, showArchived, columns);

  useEffect(() => {
    setOptimisticColumns(null);
  }, [columns]);

  const applyOptimisticMove = useCallback(
    (
      prev: Record<IssueStatus, KanbanCard[]>,
      cardId: number,
      card: KanbanCard,
      sourceStatus: IssueStatus,
      targetStatus: IssueStatus,
    ): Record<IssueStatus, KanbanCard[]> => {
      const next = { ...prev };
      next[sourceStatus] = next[sourceStatus].filter((c) => {
        return c.id !== cardId;
      });
      next[targetStatus] = [
        { ...card, status: targetStatus },
        ...next[targetStatus],
      ];
      return next;
    },
    [],
  );

  const revertOptimisticMove = useCallback(
    (
      prev: Record<IssueStatus, KanbanCard[]>,
      cardId: number,
      card: KanbanCard,
      sourceStatus: IssueStatus,
      targetStatus: IssueStatus,
    ): Record<IssueStatus, KanbanCard[]> => {
      const next = { ...prev };
      next[targetStatus] = next[targetStatus].filter((c) => {
        return c.id !== cardId;
      });
      next[sourceStatus] = [card, ...next[sourceStatus]];
      return next;
    },
    [],
  );

  const handleDrop = useCallback(
    (cardId: number, sourceStatus: IssueStatus, targetStatus: IssueStatus) => {
      const archivedCard = archivedDoneCards.find((c) => {
        return c.id === cardId;
      });
      const regularCard = activeColumns[sourceStatus].find((c) => {
        return c.id === cardId;
      });
      const card = archivedCard ?? regularCard;
      if (!card) return;

      const frozenCard = card;
      const isFromArchived = Boolean(archivedCard);

      if (isFromArchived) {
        setArchivedDoneCards((prev) => {
          return prev.filter((c) => {
            return c.id !== cardId;
          });
        });
        setArchivedDoneCount((prev) => {
          return prev === null ? null : Math.max(0, prev - 1);
        });
      } else {
        setOptimisticColumns((prev) => {
          return applyOptimisticMove(
            prev ?? activeColumns,
            cardId,
            frozenCard,
            sourceStatus,
            targetStatus,
          );
        });
      }

      setMovingCardId(cardId);

      startTransition(async () => {
        try {
          await moveKanbanCard(cardId, targetStatus, frozenCard);
          const colLabel =
            KANBAN_COLUMNS.find((col) => {
              return col.id === targetStatus;
            })?.label ?? targetStatus;

          if (targetStatus === 'done' && frozenCard.priority !== 0) {
            const level = getPriorityLevel(frozenCard.priority);
            toast.success(`Done: ${frozenCard.name}`, {
              description: `${level.label} priority issue completed`,
              duration: 5000,
            });
          } else {
            toast.success(`Moved to ${colLabel}`);
          }
        } catch (error) {
          if (isFromArchived) {
            setArchivedDoneCards((prev) => {
              return [frozenCard, ...prev];
            });
            setArchivedDoneCount((prev) => {
              return prev === null ? null : prev + 1;
            });
          } else {
            setOptimisticColumns((prev) => {
              return revertOptimisticMove(
                prev ?? activeColumns,
                cardId,
                frozenCard,
                sourceStatus,
                targetStatus,
              );
            });
          }
          toast.error((error as Error).message);
        } finally {
          setMovingCardId(null);
        }
      });
    },
    [
      activeColumns,
      archivedDoneCards,
      applyOptimisticMove,
      revertOptimisticMove,
      setArchivedDoneCards,
      setArchivedDoneCount,
    ],
  );

  const handleMoveToColumn = useCallback(
    (card: KanbanCard, status: IssueStatus) => {
      if (card.status === status) return;
      handleDrop(card.id, card.status, status);
    },
    [handleDrop],
  );

  const handleCardClick = useCallback((card: KanbanCard) => {
    setHoveredCard((prev) => {
      return prev?.id === card.id ? null : card;
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setHoveredCard(null);
  }, []);

  const filteredColumns = useMemo(() => {
    const lowerSearch = filters.search.toLowerCase();
    // 'task' is stored as 'organization' in the backend; translate for card comparison
    const filterType = filters.type === 'task' ? 'organization' : filters.type;
    const result: Record<IssueStatus, KanbanCard[]> = {
      open: [],
      in_progress: [],
      paused: [],
      done: [],
      review: [],
      reopen: [],
    };

    for (const col of KANBAN_COLUMNS) {
      if (filters.status && col.id !== filters.status) continue;
      const targetColId = (filters.status || col.id) as IssueStatus;
      const sourceCards = activeColumns[col.id] ?? [];

      for (const card of sourceCards) {
        if (filters.assignee_id === 'unassigned') {
          if (card.assignee_id !== null) continue;
        } else if (
          filters.assignee_id &&
          card.assignee_id !== Number(filters.assignee_id)
        ) {
          continue;
        }
        if (filterType && card.type !== filterType) continue;
        if (
          lowerSearch.length > 0 &&
          !card.name.toLowerCase().includes(lowerSearch) &&
          !(card.description?.toLowerCase().includes(lowerSearch) ?? false)
        ) {
          continue;
        }
        result[targetColId].push(card);
      }
    }

    return result;
  }, [activeColumns, filters]);

  return (
    <div className='flex flex-col gap-3 p-2 relative'>
      <div
        className='flex gap-3 overflow-x-auto pb-4 scrollbar-custom'
        tabIndex={0}
        role='region'
        aria-label='Kanban board'
      >
        {KANBAN_COLUMNS.map((col) => {
          const isDoneColumn = col.id === 'done';
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              cards={filteredColumns[col.id]}
              onDrop={handleDrop}
              onMoveToColumn={handleMoveToColumn}
              movingCardId={movingCardId}
              onCardClick={handleCardClick}
              footer={
                isDoneColumn ? (
                  <>
                    <ArchivedDoneToggle
                      count={archivedDoneCount}
                      expanded={showArchived}
                      loading={archivedDoneLoading}
                      onToggle={() => {
                        onShowArchivedChange(!showArchived);
                      }}
                    />
                    {showArchived && (
                      <ArchivedDoneSection
                        cards={archivedDoneCards}
                        loading={archivedDoneLoading}
                        onCardClick={handleCardClick}
                      />
                    )}
                  </>
                ) : undefined
              }
            />
          );
        })}
      </div>

      <KanbanCardModal card={hoveredCard} onClose={handleCloseModal} />
    </div>
  );
}
