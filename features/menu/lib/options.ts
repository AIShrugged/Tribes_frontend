import {
  BarChart2,
  Bot,
  Bug,
  Calendar,
  BookOpen,
  LayoutDashboard,
  MessageSquare,
  Send,
  SquareKanban,
  Terminal,
  UsersRound,
  Clock,
  Users,
  CheckSquare,
  Upload,
} from 'lucide-react';

import { ROUTES } from '@/shared/lib/routes';

import type { MenuProps } from '@/features/menu/model/types';

export function getMenuItems(): MenuProps[] {
  const items: MenuProps[] = [
    {
      id: 'today',
      label: 'Dashboard',
      icon: 'clock',
      href: ROUTES.DASHBOARD.TODAY,
      position: 1,
    },
    {
      id: 'meetings',
      label: 'Calendar',
      icon: 'calendar',
      href: ROUTES.DASHBOARD.CALENDAR,
      activeHref: ROUTES.DASHBOARD.MEETINGS,
      position: 2,
    },
    {
      id: 'chat',
      label: 'AI Chat',
      icon: 'messageSquare',
      href: ROUTES.DASHBOARD.CHAT,
      position: 50,
    },
    {
      id: 'issues',
      label: 'Tasks',
      icon: 'checkSquare',
      href: ROUTES.DASHBOARD.ISSUES,
      position: 3,
    },
    {
      id: 'uploads',
      label: 'Uploads',
      icon: 'upload',
      href: ROUTES.DASHBOARD.UPLOADS,
      position: 4,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'send',
      href: ROUTES.DASHBOARD.TELEGRAM,
      position: 60,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: 'bot',
      href: ROUTES.DASHBOARD.AGENTS,
      activeHref: ROUTES.DASHBOARD.AGENTS,
      position: 90,
    },
  ];

  return items.toSorted((a, b) => {
    return a.position - b.position;
  });
}

export const ICONS_MAP = {
  bot: Bot,
  layoutDashboard: LayoutDashboard,
  teams: UsersRound,
  bookOpen: BookOpen,
  calendar: Calendar,
  kanban: SquareKanban,
  barChart: BarChart2,
  messageSquare: MessageSquare,
  send: Send,
  bug: Bug,
  terminal: Terminal,
  clock: Clock,
  users: Users,
  checkSquare: CheckSquare,
  upload: Upload,
} as const;
