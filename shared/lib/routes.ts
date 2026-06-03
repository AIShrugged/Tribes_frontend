export const ROUTES = {
  ONBOARDING: '/onboarding',
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    ORGANIZATION: '/auth/organization',
    FORGOT_PASSWORD: '/auth/forgot-password', // eslint-disable-line sonarjs/no-hardcoded-passwords
    RESET_PASSWORD: '/auth/reset-password', // eslint-disable-line sonarjs/no-hardcoded-passwords
  },
  DASHBOARD: {
    HOME: 'dashboard',
    TODAY: '/dashboard/today',
    TODAY_MEETINGS: '/dashboard/today/meetings',
    TODAY_TASKS: '/dashboard/today/tasks',
    TODAY_ACTIVITY: '/dashboard/today/activity',
    TODAY_PROGRESS: '/dashboard/today/progress',
    TODAY_DECISIONS: '/dashboard/today/decisions',
    MEETINGS: '/dashboard/meetings',
    TASKS: '/dashboard/tasks',
    CALENDAR: '/dashboard/calendar',
    CHAT: '/dashboard/chat',
    ISSUES: '/dashboard/issues',
    AGENTS: '/dashboard/agents',
    AGENT_PROFILES: '/dashboard/agents/profiles',
    AGENT_PROFILES_NEW: '/dashboard/agents/profiles/new',
    AGENT_PROFILE_OVERVIEW: (id: string | number) => {
      return `/dashboard/agents/profiles/${id}/overview`;
    },
    AGENT_PROFILE_TOOLS: (id: string | number) => {
      return `/dashboard/agents/profiles/${id}/tools`;
    },
    AGENT_PROFILE_MEMORIES: (id: string | number) => {
      return `/dashboard/agents/profiles/${id}/memories`;
    },
    AGENT_TASKS: '/dashboard/agents/tasks',
    AGENT_ACTIVITY: '/dashboard/agents/activity',
    TEAMS: '/dashboard/teams',
    TEAMS_CREATE: '/dashboard/teams/create',
    STATISTICS: '/dashboard/statistics',
    ORGANIZATION: '/dashboard/organization',
    PROFILE: '/dashboard/profile',
    PROFILE_ACCOUNT: '/dashboard/profile/account',
    PROFILE_CALENDAR: '/dashboard/profile/calendar',
    PROFILE_PREFERENCES: '/dashboard/profile/preferences',
    PROFILE_INTEGRATIONS: '/dashboard/profile/integrations',
    ONBOARDING: '/dashboard/onboarding',
    TELEGRAM: '/dashboard/telegram',
    TELEGRAM_CHATS: '/dashboard/telegram/chats',
    TELEGRAM_NOTIFICATIONS: '/dashboard/telegram/notifications',
    SUMMARY: '/dashboard/summary',
    KANBAN: '/dashboard/kanban',
    ISSUES_LIST: '/dashboard/issues/list',
    ISSUES_KANBAN: '/dashboard/issues/kanban',
    ISSUES_PROGRESS: '/dashboard/issues/progress',
    TODAY_GOALS: '/dashboard/today/goals',
    MEETINGS_LIST: '/dashboard/meetings/list',
    MEETINGS_CALENDAR: '/dashboard/meetings/calendar',
    MEETINGS_ORGANIZATION: '/dashboard/meetings/organization',
    MEETING_DETAIL: (id: string | number) => {
      return `/dashboard/meetings/${id}`;
    },
    MEETING_DETAIL_OVERVIEW: (id: string | number) => {
      return `/dashboard/meetings/${id}/overview`;
    },
    MEETING_DETAIL_AGENDA: (id: string | number) => {
      return `/dashboard/meetings/${id}/agenda`;
    },
    MEETING_DETAIL_TASKS: (id: string | number) => {
      return `/dashboard/meetings/${id}/tasks`;
    },
    MEETING_DETAIL_TRANSCRIPT: (id: string | number) => {
      return `/dashboard/meetings/${id}/transcript`;
    },
    AGENT_PROMPTS: '/dashboard/agents/prompts',
    AGENT_PROMPT_EDIT: (id: number) => {
      return `/dashboard/agents/prompts/${id}`;
    },
    UPLOADS: '/dashboard/uploads',
    UPLOADS_TRANSCRIPTS: '/dashboard/uploads/transcripts',
    UPLOADS_TASKS: '/dashboard/uploads/tasks',
    UPLOADS_LOG: '/dashboard/uploads/log',
    UPLOAD_DETAIL: (type: 'transcript' | 'task_data', id: string | number) => {
      return `/dashboard/uploads/${type}/${id}`;
    },
    ISSUES_DETAIL: (id: string | number) => {
      return `/dashboard/issues/${id}`;
    },
  },
} as const;
