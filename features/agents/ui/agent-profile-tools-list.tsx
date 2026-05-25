import { AgentJsonPreview } from '@/features/agents/ui/agent-json-preview';

import type { AgentProfileTool } from '../model/types';

interface Props {
  tools: AgentProfileTool[];
}

export function AgentProfileToolsList({ tools }: Props) {
  if (tools.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        No tools available for this agent.
      </p>
    );
  }

  return (
    <ul className='space-y-3'>
      {tools.map((tool) => {
        return (
          <li key={tool.name} className='rounded-[var(--radius-card)] border border-border bg-card p-4'>
            <p className='font-mono text-sm font-semibold text-violet-400'>{tool.name}</p>
            {tool.description.length > 0 && (
              <p className='mt-1 text-sm text-muted-foreground'>{tool.description}</p>
            )}
            {Object.keys(tool.parameters).length > 0 && (
              <details className='mt-2'>
                <summary className='cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground'>
                  Parameters
                </summary>
                <div className='mt-2'>
                  <AgentJsonPreview title='' value={tool.parameters} />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
