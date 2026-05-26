'use client';

import clsx from 'clsx';

import { LLM_PROMPT_GROUPS } from '@/features/llm-prompts/model/types';

import type {
  LlmPromptGroup,
  LlmPromptProps,
} from '@/features/llm-prompts/model/types';

/**
 * LlmPromptGroupFilter — sidebar pill-list for filtering prompts by group.
 * @param root0 - Component props.
 * @param root0.prompts - Full list of prompts for count computation.
 * @param root0.activeGroup - Currently selected group, or undefined for "All".
 * @param root0.onGroupChange - Callback when the selected group changes.
 * @returns JSX element.
 */
export function LlmPromptGroupFilter({
  prompts,
  activeGroup,
  onGroupChange,
}: {
  prompts: LlmPromptProps[];
  activeGroup: LlmPromptGroup | undefined;
  onGroupChange: (group?: LlmPromptGroup) => void;
}) {
  const countForGroup = (group: LlmPromptGroup): number => {
    return prompts.filter((p) => {
      return p.slug.split('.')[0] === group;
    }).length;
  };

  const pillBase =
    'flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors text-left';
  const pillActive = 'bg-[var(--primary)] text-[var(--primary-foreground)]';
  const pillInactive =
    'text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]';

  return (
    <nav aria-label='Filter prompts by group' className='flex flex-col gap-0.5'>
      <ul role='listbox' aria-label='Prompt groups'>
        <li>
          <button
            type='button'
            role='option'
            aria-selected={activeGroup === undefined}
            className={clsx(
              pillBase,
              activeGroup === undefined ? pillActive : pillInactive,
            )}
            onClick={() => {
              onGroupChange();
            }}
          >
            <span>All</span>
            <span className='shrink-0 tabular-nums text-xs opacity-70'>
              {prompts.length}
            </span>
          </button>
        </li>
        {LLM_PROMPT_GROUPS.map((group) => {
          const count = countForGroup(group);

          if (count === 0) return null;

          const isActive = activeGroup === group;

          return (
            <li key={group}>
              <button
                type='button'
                role='option'
                aria-selected={isActive}
                className={clsx(pillBase, isActive ? pillActive : pillInactive)}
                onClick={() => {
                  onGroupChange(group);
                }}
              >
                <span className='capitalize'>{group.replaceAll('_', ' ')}</span>
                <span className='shrink-0 tabular-nums text-xs opacity-70'>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
