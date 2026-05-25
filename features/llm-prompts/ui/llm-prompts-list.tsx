'use client';

import { ChevronDown, RefreshCw, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { seedLlmPrompts } from '@/features/llm-prompts/api/llm-prompts';
import { LlmPromptGroupFilter } from '@/features/llm-prompts/ui/llm-prompt-group-filter';
import { useDebounce } from '@/shared/hooks';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { DataTable } from '@/shared/ui/table';

import type { LlmPromptGroup, LlmPromptProps } from '@/features/llm-prompts/model/types';
import type { TableColumn } from '@/shared/ui/table';

const SEARCH_DEBOUNCE_MS = 150;

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths === 1) return '1 month ago';

  return `${diffMonths} months ago`;
}

/**
 * LlmPromptsList — client component for the prompts list page.
 * Handles search, group filtering, seed actions, and DataTable rendering.
 * @param root0 - Component props.
 * @param root0.prompts - Full list of prompts (fetched server-side with limit=50).
 * @param root0.canEdit - Whether the current user has manager access.
 * @param root0.organizationId - The active organization's ID.
 * @returns JSX element.
 */
export function LlmPromptsList({
  prompts,
  canEdit,
  organizationId,
}: {
  prompts: LlmPromptProps[];
  canEdit: boolean;
  organizationId: number;
}) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<LlmPromptGroup | undefined>();
  const [isSeedOpen, setIsSeedOpen] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [overwriteChecked, setOverwriteChecked] = useState(false);
  const [isSeedPending, startSeed] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const filtered = prompts.filter((p) => {
    const matchesGroup =
      activeGroup === undefined || p.slug.split('.')[0] === activeGroup;

    if (!matchesGroup) return false;

    if (!debouncedSearch) return true;

    const q = debouncedSearch.toLowerCase();

    return (
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  });

  const handleSeedSafe = () => {
    setIsSeedOpen(false);
    startSeed(async () => {
      const result = await seedLlmPrompts(organizationId, false);

      if (result.error !== null) {
        toast.error(result.error);

        return;
      }

      toast.success(
        `Synced defaults: ${result.data.created} added, ${result.data.skipped} skipped.`,
      );
    });
  };

  const handleSeedOverwrite = () => {
    if (!overwriteChecked) return;

    setShowOverwriteConfirm(false);
    setOverwriteChecked(false);
    setIsSeedOpen(false);
    startSeed(async () => {
      const result = await seedLlmPrompts(organizationId, true);

      if (result.error !== null) {
        toast.error(result.error);

        return;
      }

      toast.success(
        `Overwritten: ${result.data.updated} updated, ${result.data.created} added.`,
      );
    });
  };

  const columns: TableColumn<LlmPromptProps>[] = [
    {
      id: 'name',
      header: 'Name',
      renderCell: (p) => {
        return canEdit ? (
          <Link
            href={ROUTES.DASHBOARD.AGENT_PROMPT_EDIT(p.id)}
            className='font-medium text-primary hover:underline'
          >
            {p.name}
          </Link>
        ) : (
          <span className='font-medium'>{p.name}</span>
        );
      },
    },
    {
      id: 'slug',
      header: 'Slug',
      cellClassName: 'text-muted-foreground font-mono text-xs',
      renderCell: (p) => {
        return p.slug;
      },
    },
    {
      id: 'updated_at',
      header: 'Updated',
      cellClassName: 'text-muted-foreground',
      renderCell: (p) => {
        return formatUpdatedAt(p.updated_at);
      },
    },
  ];

  const emptyState =
    prompts.length === 0 ? (
      <EmptyState
        icon={Zap}
        title={
          canEdit
            ? 'No prompts configured yet'
            : 'No prompts configured'
        }
        description={
          canEdit
            ? 'Seed the default prompts to get started.'
            : 'Ask your organization manager to seed the default prompts.'
        }
      />
    ) : (
      <EmptyState
        icon={Zap}
        title='No prompts match your filter'
        description='Try a different search or group.'
      />
    );

  return (
    <div className='flex h-full gap-4 overflow-hidden'>
      {/* Group sidebar */}
      <aside className='w-44 shrink-0 overflow-y-auto py-2 pr-2 border-r border-border hidden md:block'>
        <LlmPromptGroupFilter
          prompts={prompts}
          activeGroup={activeGroup}
          onGroupChange={setActiveGroup}
        />
      </aside>

      {/* Main content */}
      <div className='flex flex-1 flex-col gap-3 overflow-hidden'>
        {/* Header row */}
        <div className='flex items-center gap-2 pt-2'>
          <input
            type='search'
            aria-label='Search prompts by name or slug'
            placeholder='Search by name or slug…'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className='h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'
          />

          {canEdit && (
            <div className='relative ml-auto shrink-0' ref={dropdownRef}>
              <Button
                type='button'
                variant={BUTTON_VARIANT.secondary}
                fullWidth={false}
                size='sm'
                loading={isSeedPending}
                rightIcon={<ChevronDown className='h-3.5 w-3.5' />}
                leftIcon={<RefreshCw className='h-3.5 w-3.5' />}
                onClick={() => {
                  setIsSeedOpen((prev) => {
                    return !prev;
                  });
                  setShowOverwriteConfirm(false);
                }}
              >
                Sync Defaults
              </Button>

              {isSeedOpen && !isSeedPending && (
                <div className='absolute right-0 top-full z-10 mt-1 w-72 rounded-[var(--radius-card)] border border-border bg-background p-3 shadow-lg'>
                  {showOverwriteConfirm ? (
                    <div className='flex flex-col gap-3'>
                      <p className='text-sm font-medium'>
                        Replace ALL prompt text with system defaults.
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        This will overwrite all customized prompts and cannot be undone.
                      </p>
                      <label className='flex cursor-pointer items-start gap-2 text-sm'>
                        <input
                          type='checkbox'
                          autoComplete='off'
                          checked={overwriteChecked}
                          onChange={(e) => {
                            setOverwriteChecked(e.target.checked);
                          }}
                          className='mt-0.5 shrink-0'
                        />
                        <span>I understand all customizations will be lost</span>
                      </label>
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          variant={BUTTON_VARIANT.danger}
                          size='sm'
                          disabled={!overwriteChecked}
                          onClick={handleSeedOverwrite}
                        >
                          Overwrite All
                        </Button>
                        <Button
                          type='button'
                          variant={BUTTON_VARIANT.ghost}
                          size='sm'
                          onClick={() => {
                            setShowOverwriteConfirm(false);
                            setOverwriteChecked(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-col gap-1'>
                      <button
                        type='button'
                        className='w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] transition-colors'
                        onClick={handleSeedSafe}
                      >
                        <p className='font-medium'>Sync missing defaults</p>
                        <p className='text-xs text-muted-foreground'>
                          Add defaults for any missing slugs. Existing customizations are preserved.
                        </p>
                      </button>
                      <button
                        type='button'
                        className='w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--danger-bg)] text-destructive transition-colors'
                        onClick={() => {
                          setShowOverwriteConfirm(true);
                        }}
                      >
                        <p className='font-medium'>Overwrite all</p>
                        <p className='text-xs opacity-80'>
                          Replace all prompt text with system defaults.
                        </p>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile group filter */}
        <div className='md:hidden overflow-x-auto'>
          <LlmPromptGroupFilter
            prompts={prompts}
            activeGroup={activeGroup}
            onGroupChange={setActiveGroup}
          />
        </div>

        {/* Table */}
        <div className='flex-1 overflow-y-auto'>
          <DataTable
            columns={columns}
            items={filtered}
            keyExtractor={(p) => {
              return p.id;
            }}
            caption='LLM Prompts'
            captionSrOnly
            tableMinWidth='min-w-[500px]'
            emptyState={emptyState}
            renderMobileCard={(p) => {
              return (
                <div className='rounded-[var(--radius-card)] border border-border p-4'>
                  {canEdit ? (
                    <Link
                      href={ROUTES.DASHBOARD.AGENT_PROMPT_EDIT(p.id)}
                      className='font-medium text-primary hover:underline'
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <p className='font-medium'>{p.name}</p>
                  )}
                  <p className='mt-1 font-mono text-xs text-muted-foreground'>{p.slug}</p>
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Updated: {formatUpdatedAt(p.updated_at)}
                  </p>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
