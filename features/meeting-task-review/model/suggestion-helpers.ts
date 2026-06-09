import type {
  MeetingTaskReviewIssue,
  MeetingTaskReviewSuggestion,
} from './types';

export interface SuggestionAction {
  label: string;
  href?: string;
  onClick?: (issue: MeetingTaskReviewIssue) => Promise<void>;
}

const SUGGESTION_ACTIONS: Record<
  MeetingTaskReviewSuggestion,
  SuggestionAction
> = {
  update_status: {
    label: 'Обновить статус',
    href: undefined,
  },
  resolve_blocker: {
    label: 'Разобраться с блокером',
    href: undefined,
  },
  reassign: {
    label: 'Переназначить',
    href: undefined,
  },
  fill_info: {
    label: 'Добавить информацию',
    href: undefined,
  },
  update_due_date: {
    label: 'Изменить дедлайн',
    href: undefined,
  },
  escalate: {
    label: 'Эскалировать',
    href: undefined,
  },
  close: {
    label: 'Закрыть',
    href: undefined,
  },
};

export function getSuggestionAction(
  suggestion: MeetingTaskReviewSuggestion,
): SuggestionAction {
  return SUGGESTION_ACTIONS[suggestion] || SUGGESTION_ACTIONS.update_status;
}
