import type {
  EpicOption,
  IssueStatus,
  PersonOption,
  SharedFilters,
} from '@/entities/issue';
import type React from 'react';

export interface KanbanCard {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: IssueStatus;
  organization_id: number | null;
  team_id: number | null;
  assignee_id: number | null;
  assignee?: PersonOption | null;
  epic_id: number | null;
  epic?: EpicOption | null;
  priority: number;
  attachments_count: number;
  comments_count: number;
  story_points: number | null;
  close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: IssueStatus;
  label: string;
  color: string;
  cards: KanbanCard[];
}

export interface KanbanFilters {
  organization_id?: number | null;
  team_id?: number | null;
  type?: string;
  assignee_id?: number | null;
  author_id?: number | null;
  epic_id?: number | null;
  search?: string;
  archived?: boolean;
  exclude_archived?: boolean;
  unassigned?: boolean;
  sort?: string;
  order?: string;
  limit?: number;
  page?: number;
}

export const KANBAN_COLUMNS: Pick<KanbanColumn, 'id' | 'label' | 'color'>[] = [
  { id: 'open', label: 'To Do', color: '#94a3b8' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'review', label: 'Review', color: '#60a5fa' },
  { id: 'paused', label: 'Paused', color: '#818cf8' },
  { id: 'done', label: 'Done', color: '#34d399' },
];

export const TYPE_COLORS: Record<string, string> = {
  development: 'bg-blue-500/20 text-blue-300',
  organization: 'bg-purple-500/20 text-purple-300',
};

export interface KanbanBoardProps {
  columns: Record<IssueStatus, KanbanCard[]>;
  filters: SharedFilters;
  onShowArchivedChange: (value: boolean) => void;
}

export interface KanbanCardItemProps {
  card: KanbanCard;
  onMoveToColumn: (card: KanbanCard, status: IssueStatus) => void;
  isMoving: boolean;
  onCardClick: (card: KanbanCard) => void;
}

export interface KanbanColumnProps {
  id: IssueStatus;
  label: string;
  color: string;
  cards: KanbanCard[];
  onDrop: (
    cardId: number,
    sourceStatus: IssueStatus,
    targetStatus: IssueStatus,
  ) => void;
  onMoveToColumn: (card: KanbanCard, status: IssueStatus) => void;
  movingCardId: number | null;
  onCardClick: (card: KanbanCard) => void;
  footer?: React.ReactNode;
}

export type {
  EpicOption,
  IssueStatus,
  SharedFilters,
  PersonOption,
} from '@/entities/issue';
