'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  getMeetingSummaryDefaultPrompt,
  upsertMeetingSummaryTemplate,
} from '@/features/teams/api/meeting-summary-template';
import {
  MEETING_SUMMARY_DEFAULT_SECTIONS,
  MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
  type MeetingSummarySection,
  type MeetingSummaryTemplate,
  type MeetingSummaryTemplateResolved,
} from '@/features/teams/model/types';

import { MeetingSummaryHistoryModal } from './meeting-summary-history-modal';
import { SUMMARY_SECTION_LABELS } from './section-labels';
import { SectionTemplateEditor } from './section-template-editor';

interface Props {
  teamId: number;
  resolved: MeetingSummaryTemplateResolved;
  isReadOnly: boolean;
}

const PROMPT_PLACEHOLDERS = [
  '{transcript}',
  '{meeting_date}',
  '{next_day}',
  '{example}',
];

export function MeetingSummaryTemplateEditor({
  teamId,
  resolved,
  isReadOnly,
}: Props) {
  const [sections, setSections] = useState<MeetingSummarySection[]>(
    resolved.sections,
  );
  const [visibleSections, setVisibleSections] = useState<
    MeetingSummarySection[]
  >(resolved.visibleSections);
  const [promptOverride, setPromptOverride] = useState<string>(
    resolved.promptOverride ?? '',
  );
  const [isDefault, setIsDefault] = useState(resolved.isDefault);
  const [version, setVersion] = useState<number | null>(resolved.version);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSavingSections, startSectionsTransition] = useTransition();
  const [isSavingVisibility, startVisibilityTransition] = useTransition();
  const [isSavingPrompt, startPromptTransition] = useTransition();

  const [defaultPromptText, setDefaultPromptText] = useState<string | null>(
    null,
  );
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  const [isDefaultOpen, setIsDefaultOpen] = useState(false);

  const visibleInitialKey = resolved.visibleSections.join('|');
  const visibleCurrentKey = visibleSections.join('|');
  const isVisibilityDirty = visibleInitialKey !== visibleCurrentKey;

  const persistedVisible = trimVisible(visibleSections, sections);
  const persistedVisibleForSave =
    persistedVisible.length === 0 ? null : persistedVisible;

  const applyRestored = (template: MeetingSummaryTemplate) => {
    setSections(template.sections);
    setVisibleSections(
      template.visible_sections && template.visible_sections.length > 0
        ? template.visible_sections
        : MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
    );
    setPromptOverride(template.prompt_override ?? '');
    setVersion(template.version);
    setIsDefault(false);
  };

  const handleSaveSections = (next: MeetingSummarySection[]) => {
    startSectionsTransition(async () => {
      const trimmed = trimVisible(visibleSections, next);
      const result = await upsertMeetingSummaryTemplate(teamId, {
        sections: next,
        visible_sections: trimmed.length === 0 ? null : trimmed,
        prompt_override: promptOverride.trim() === '' ? null : promptOverride,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setSections(result.data.sections);
        setVisibleSections(
          result.data.visible_sections &&
            result.data.visible_sections.length > 0
            ? result.data.visible_sections
            : MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
        );
        setVersion(result.data.version);
        setIsDefault(false);
        toast.success(
          `Meeting summary template saved (v${result.data.version})`,
        );
      }
    });
  };

  const handleSaveVisibility = () => {
    if (!isVisibilityDirty) return;
    startVisibilityTransition(async () => {
      const result = await upsertMeetingSummaryTemplate(teamId, {
        sections,
        visible_sections: persistedVisibleForSave,
        prompt_override: promptOverride.trim() === '' ? null : promptOverride,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setVisibleSections(
          result.data.visible_sections &&
            result.data.visible_sections.length > 0
            ? result.data.visible_sections
            : MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
        );
        setVersion(result.data.version);
        setIsDefault(false);
        toast.success(`Visible sections saved (v${result.data.version})`);
      }
    });
  };

  const handleSavePrompt = () => {
    startPromptTransition(async () => {
      const result = await upsertMeetingSummaryTemplate(teamId, {
        sections,
        visible_sections: persistedVisibleForSave,
        prompt_override: promptOverride.trim() === '' ? null : promptOverride,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setPromptOverride(result.data.prompt_override ?? '');
        setVersion(result.data.version);
        setIsDefault(false);
        toast.success(`LLM prompt saved (v${result.data.version})`);
      }
    });
  };

  const toggleVisibility = (section: MeetingSummarySection) => {
    setVisibleSections((prev) => {
      return prev.includes(section)
        ? prev.filter((s) => {
            return s !== section;
          })
        : [...prev, section];
    });
  };

  const handleToggleDefault = async () => {
    if (defaultPromptText === null && !isLoadingDefault) {
      setIsLoadingDefault(true);
      try {
        const result = await getMeetingSummaryDefaultPrompt();
        setDefaultPromptText(result.default_prompt);
      } catch {
        toast.error('Failed to load default prompt');
        setIsLoadingDefault(false);
        return;
      }
      setIsLoadingDefault(false);
    }
    setIsDefaultOpen((open) => {
      return !open;
    });
  };

  const handleCopyDefault = async () => {
    if (!defaultPromptText) return;
    try {
      await navigator.clipboard.writeText(defaultPromptText);
      toast.success('Default prompt copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  let badge: string | null = null;
  if (isDefault) {
    badge = 'Using defaults';
  } else if (version) {
    badge = `v${version}`;
  }
  let toggleDefaultLabel: string;
  if (isLoadingDefault) {
    toggleDefaultLabel = 'Loading…';
  } else if (isDefaultOpen) {
    toggleDefaultLabel = 'Hide default prompt';
  } else {
    toggleDefaultLabel = 'Show default prompt';
  }

  return (
    <div className='flex flex-col gap-6'>
      <SectionTemplateEditor<MeetingSummarySection>
        title='Meeting summary template'
        description='Choose which sections appear in the Telegram meeting summary, and in what order. The summary is rendered for each completed meeting.'
        badge={badge}
        availableSections={MEETING_SUMMARY_DEFAULT_SECTIONS}
        initialSelected={sections}
        labels={SUMMARY_SECTION_LABELS}
        isReadOnly={isReadOnly}
        isSaving={isSavingSections}
        onSave={handleSaveSections}
      />

      <section className='rounded-[var(--radius-card)] border border-border bg-card p-5'>
        <header className='mb-3'>
          <h3 className='text-sm font-semibold text-foreground'>
            Visible sections
          </h3>
          <p className='text-xs text-muted-foreground mt-1'>
            These sections appear above the fold in the Telegram message. All
            other sections are placed into an expandable details block. If
            nothing is checked, the default{' '}
            <code className='font-mono'>key_points</code> is used.
          </p>
        </header>

        {sections.length === 0 ? (
          <p className='text-xs text-muted-foreground italic'>
            Select at least one section above to configure visibility.
          </p>
        ) : (
          <ul className='flex flex-col gap-1.5'>
            {sections.map((section) => {
              const checked = visibleSections.includes(section);
              const inputId = `visible-${section}`;
              return (
                <li
                  key={section}
                  className='flex items-center gap-3 px-3 py-2 rounded-md bg-white/5 border border-white/10'
                >
                  <input
                    id={inputId}
                    type='checkbox'
                    checked={checked}
                    disabled={isReadOnly || isSavingVisibility}
                    onChange={() => {
                      return toggleVisibility(section);
                    }}
                    className='size-4 cursor-pointer disabled:cursor-not-allowed'
                  />
                  <label
                    htmlFor={inputId}
                    className='flex-1 text-sm font-medium text-foreground cursor-pointer'
                  >
                    {SUMMARY_SECTION_LABELS[section]}
                  </label>
                  <span className='text-xs text-muted-foreground'>
                    {checked ? 'visible' : 'in details'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {!isReadOnly && (
          <div className='mt-4 flex items-center justify-end'>
            <button
              type='button'
              onClick={handleSaveVisibility}
              disabled={!isVisibilityDirty || isSavingVisibility}
              className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isSavingVisibility ? 'Saving…' : 'Save visibility'}
            </button>
          </div>
        )}
      </section>

      <div className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5'>
        <div className='flex flex-col gap-1'>
          <h3 className='text-sm font-semibold text-foreground'>
            LLM prompt override
          </h3>
          <p className='text-xs text-muted-foreground'>
            Leave blank to use the default prompt. Available placeholders:{' '}
            <code className='font-mono'>{PROMPT_PLACEHOLDERS.join(' ')}</code>.
            They are replaced at runtime with the transcript, meeting date,
            next-day date and the built-in protocol example.
          </p>
        </div>

        <button
          type='button'
          onClick={handleToggleDefault}
          disabled={isLoadingDefault}
          className='self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-border bg-background text-foreground hover:bg-white/5 transition-colors disabled:cursor-not-allowed disabled:opacity-60'
        >
          {toggleDefaultLabel}
        </button>

        {isDefaultOpen && defaultPromptText !== null && (
          <div className='flex flex-col gap-2'>
            <textarea
              readOnly
              value={defaultPromptText}
              className='min-h-[200px] w-full rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground'
              spellCheck={false}
            />
            <div className='flex items-center justify-end'>
              <button
                type='button'
                onClick={handleCopyDefault}
                className='inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent'
              >
                Copy default
              </button>
            </div>
          </div>
        )}

        <textarea
          className='min-h-[180px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60'
          value={promptOverride}
          onChange={(e) => {
            return setPromptOverride(e.target.value);
          }}
          placeholder='Custom LLM prompt. Leave empty to use default.'
          disabled={isReadOnly || isSavingPrompt}
          maxLength={10_000}
          spellCheck={false}
        />
        <div className='flex items-center justify-between'>
          <span className='text-xs text-muted-foreground'>
            {promptOverride.length}/10000
            {version !== null && ` · current v${version}`}
          </span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => {
                return setIsHistoryOpen(true);
              }}
              disabled={version === null || version <= 1}
              className='inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
            >
              History
            </button>
            <button
              type='button'
              onClick={handleSavePrompt}
              disabled={isReadOnly || isSavingPrompt}
              className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isSavingPrompt ? 'Saving…' : 'Save prompt'}
            </button>
          </div>
        </div>
      </div>

      <MeetingSummaryHistoryModal
        teamId={teamId}
        isOpen={isHistoryOpen}
        onClose={() => {
          return setIsHistoryOpen(false);
        }}
        onRestored={applyRestored}
      />
    </div>
  );
}

function trimVisible(
  visible: MeetingSummarySection[],
  sections: MeetingSummarySection[],
): MeetingSummarySection[] {
  return visible.filter((s) => {
    return sections.includes(s);
  });
}
