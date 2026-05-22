'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  getAgentProfilePromptVersions,
  restoreAgentProfilePromptVersion,
} from '@/features/agents/api/agent-profiles';
import { formatDateTime } from '@/features/agents/lib/format';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal/modal';

import type { AgentProfile, AgentProfilePromptVersion } from '../model/types';

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; versions: AgentProfilePromptVersion[] }
  | {
      phase: 'restoring';
      versions: AgentProfilePromptVersion[];
      restoringVersion: number;
    };

interface Props {
  profileId: number;
  currentVersion: number;
  disabled?: boolean;
  onRestored: (profile: AgentProfile) => void;
}

export function AgentPromptVersionHistory({
  profileId,
  currentVersion,
  disabled = false,
  onRestored,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();

      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;

    getAgentProfilePromptVersions(profileId)
      .then((versions) => {
        if (ac.signal.aborted) return;
        setState({ phase: 'ready', versions });
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setState({ phase: 'idle' });
        }
      });

    return () => {
      ac.abort();
    };
  }, [isOpen, profileId]);

  const handleRestore = async (version: number) => {
    if (state.phase !== 'ready') return;

    setState({
      phase: 'restoring',
      versions: state.versions,
      restoringVersion: version,
    });

    const result = await restoreAgentProfilePromptVersion(profileId, version);

    if (result.error !== null) {
      toast.error(result.error);
      setState({ phase: 'ready', versions: state.versions });

      return;
    }

    toast.success(`Restored to version ${version}`);
    setState({ phase: 'idle' });
    setIsOpen(false);

    if (result.data) {
      onRestored(result.data);
    }
  };

  const versions =
    state.phase === 'ready' || state.phase === 'restoring'
      ? state.versions
      : [];
  const restoringVersion =
    state.phase === 'restoring' ? state.restoringVersion : null;

  return (
    <>
      <Button
        type='button'
        variant={BUTTON_VARIANT.ghost}
        className='h-auto w-auto px-2 py-0.5 text-xs'
        disabled={disabled}
        onClick={() => {
          setState({ phase: 'loading' });
          setIsOpen(true);
        }}
      >
        Version history
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setState({ phase: 'idle' });
        }}
        title='Prompt version history'
      >
        {state.phase === 'loading' && (
          <p className='text-sm text-muted-foreground'>Loading versions…</p>
        )}

        {(state.phase === 'ready' || state.phase === 'restoring') &&
          versions.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              No saved versions yet.
            </p>
          )}

        {(state.phase === 'ready' || state.phase === 'restoring') &&
          versions.length > 0 && (
            <ul className='flex flex-col gap-3'>
              {versions.map((v) => {
                const isCurrent = v.version === currentVersion - 1;
                const isRestoring = restoringVersion === v.version;

                return (
                  <li
                    key={v.id}
                    className='flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex items-center gap-2'>
                        <span className='font-mono text-xs text-violet-300'>
                          v{v.version}
                        </span>
                        {isCurrent && (
                          <span className='rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60'>
                            previous
                          </span>
                        )}
                        <span className='text-xs text-white/40'>
                          {formatDateTime(v.created_at)}
                        </span>
                      </div>
                      <Button
                        type='button'
                        variant={BUTTON_VARIANT.secondary}
                        className='h-auto w-auto px-2 py-0.5 text-xs'
                        loading={isRestoring}
                        disabled={state.phase === 'restoring' && !isRestoring}
                        onClick={() => {
                          void handleRestore(v.version);
                        }}
                      >
                        Restore
                      </Button>
                    </div>
                    <p className='line-clamp-3 whitespace-pre-wrap font-mono text-xs text-white/60'>
                      {v.system_prompt || (
                        <span className='italic text-white/30'>
                          empty prompt
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
      </Modal>
    </>
  );
}
