'use client';

import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Popup } from '@/shared/ui/popup/Popup';

import type { FilterPreset, SharedFilters } from '@/features/issues/model/types';

const STORAGE_KEY = 'issues_filter_presets_v1';
const STORAGE_VERSION = 1;

interface StorageEnvelope {
  version: number;
  presets: FilterPreset[];
}

function loadPresets(): FilterPreset[] {
  if (globalThis.window === undefined) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      (parsed as StorageEnvelope).version === STORAGE_VERSION &&
      Array.isArray((parsed as StorageEnvelope).presets)
    ) {
      return (parsed as StorageEnvelope).presets;
    }
    return [];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]): void {
  const envelope: StorageEnvelope = { version: STORAGE_VERSION, presets };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

interface FilterPresetsPanelProps {
  currentFilters: SharedFilters;
  onApply: (filters: SharedFilters) => void;
}

export function FilterPresetsPanel({
  currentFilters,
  onApply,
}: FilterPresetsPanelProps) {
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets());
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  function handleSave() {
    const trimmed = saveName.trim();
    if (trimmed.length === 0) return;
    const next: FilterPreset = {
      id: crypto.randomUUID(),
      name: trimmed,
      filters: currentFilters,
    };
    setPresets((prev) => {
      const updated = [...prev, next];
      savePresets(updated);
      return updated;
    });
    setSaveName('');
  }

  function handleDelete(id: string) {
    setPresets((prev) => {
      const updated = prev.filter((p) => {
        return p.id !== id;
      });
      savePresets(updated);
      return updated;
    });
  }

  function handleApply(preset: FilterPreset) {
    onApply(preset.filters);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={setAnchorEl}
        type='button'
        onClick={() => {
          setOpen((v) => {
            return !v;
          });
        }}
        aria-label='Saved filters'
        className='flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      >
        <Bookmark className='h-3.5 w-3.5' />
        <span>Saved</span>
        {presets.length > 0 && (
          <span className='flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white'>
            {presets.length}
          </span>
        )}
      </button>

      <Popup
        anchor={anchorEl}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        width={280}
      >
        <div className='flex flex-col gap-3 p-3'>
          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
            Saved filters
          </p>

          {presets.length === 0 && (
            <p className='text-sm text-muted-foreground'>No saved filters</p>
          )}

          {presets.length > 0 && (
            <ul className='flex flex-col gap-1'>
              {presets.map((preset) => {
                return (
                  <li
                    key={preset.id}
                    className='flex items-center justify-between gap-2'
                  >
                    <button
                      type='button'
                      onClick={() => {
                        return handleApply(preset);
                      }}
                      className='flex-1 truncate rounded px-2 py-1 text-left text-sm text-foreground hover:bg-muted transition-colors'
                    >
                      {preset.name}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        return handleDelete(preset.id);
                      }}
                      aria-label={`Delete preset "${preset.name}"`}
                      className='shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className='border-t border-border pt-3 flex gap-2'>
            <input
              type='text'
              placeholder='Preset name...'
              value={saveName}
              onChange={(e) => {
                setSaveName(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              className='h-8 flex-1 rounded border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
            />
            <button
              type='button'
              onClick={handleSave}
              disabled={saveName.trim().length === 0}
              aria-label='Save current filters'
              className='flex items-center justify-center rounded border border-border bg-background px-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            >
              <Plus className='h-4 w-4' />
            </button>
          </div>
        </div>
      </Popup>
    </>
  );
}