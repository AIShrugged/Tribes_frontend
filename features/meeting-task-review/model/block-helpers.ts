import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Package,
  User,
  type LucideIcon,
} from 'lucide-react';

import type { MeetingTaskReviewBlockType } from './types';

export interface BlockStyle {
  Icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
}

const BLOCK_STYLES: Record<MeetingTaskReviewBlockType, BlockStyle> = {
  status_not_updated: {
    Icon: CheckCircle2,
    iconClass: 'text-(--success-500)',
    badgeClass: 'bg-(--success-500)/10 text-(--success-500)',
  },
  blocked: {
    Icon: Lock,
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
  no_assignee: {
    Icon: User,
    iconClass: 'text-(--warning-500)',
    badgeClass: 'bg-(--warning-500)/10 text-(--warning-500)',
  },
  incomplete_info: {
    Icon: Info,
    iconClass: 'text-(--info-500)',
    badgeClass: 'bg-(--info-500)/10 text-(--info-500)',
  },
  overdue: {
    Icon: Clock,
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
  stuck_in_progress: {
    Icon: AlertCircle,
    iconClass: 'text-(--warning-500)',
    badgeClass: 'bg-(--warning-500)/10 text-(--warning-500)',
  },
  abandoned: {
    Icon: Package,
    iconClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
};

export function getBlockStyle(
  blockType: MeetingTaskReviewBlockType,
): BlockStyle {
  return BLOCK_STYLES[blockType];
}
