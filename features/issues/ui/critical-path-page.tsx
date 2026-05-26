'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, GitBranch, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import { getCriticalPath, rebuildCriticalPath } from '../api/critical-path';

import { CriticalPathGraph } from './critical-path-graph';
import { CriticalPathNodeDetail } from './critical-path-node-detail';

import type {
  CriticalPathGraph as CriticalPathGraphType,
  CriticalPathNode,
} from '../model/types';

const POLL_INTERVAL_MS = 3000;

const BORDER_COLOR = 'var(--color-border)';
const BG_DARK = 'var(--color-background)';

interface StatChipProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function StatChip({ label, value, highlight }: StatChipProps) {
  return (
    <div
      className='flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs'
      style={{
        background: 'var(--color-muted)',
        borderColor:
          highlight === true
            ? 'color-mix(in srgb, var(--color-destructive) 25%, transparent)'
            : BORDER_COLOR,
      }}
    >
      <span className='text-muted-foreground'>{label}:</span>
      <strong
        style={{
          color:
            highlight === true
              ? 'var(--color-destructive)'
              : 'var(--color-foreground)',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function getNodeDotColor(node: CriticalPathNode): string {
  if (node.is_critical) return 'var(--color-destructive)';
  if (node.status === 'done') return 'var(--color-accent)';
  if (node.status === 'in_progress') return 'var(--color-primary)';
  return 'var(--color-muted-foreground)';
}

export function CriticalPathPageClient({
  organizationId,
  teamId,
}: {
  organizationId?: number;
  teamId?: number;
}) {
  const [graph, setGraph] = useState<CriticalPathGraphType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollGenRef = useRef(0);

  function clearPolling() {
    if (pollingRef.current !== null) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    pollGenRef.current += 1;
    const gen = pollGenRef.current;

    async function poll() {
      if (!mountedRef.current || pollGenRef.current !== gen) return;
      try {
        const data = await getCriticalPath({
          organization_id: organizationId,
          team_id: teamId,
        });
        if (!mountedRef.current || pollGenRef.current !== gen) return;
        if (data === null) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setNotFound(false);
        setGraph(data);
        setLoading(false);
        if (data.status === 'pending' || data.status === 'computing') {
          pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!mountedRef.current || pollGenRef.current !== gen) return;
        setLoading(false);
      }
    }

    void poll();

    return () => {
      mountedRef.current = false;
      clearPolling();
    };
  }, [organizationId, teamId]);

  async function handleRebuild() {
    if (rebuilding) return;
    setRebuilding(true);
    clearPolling();
    pollGenRef.current += 1;
    const gen = pollGenRef.current;

    const result = await rebuildCriticalPath({
      organization_id: organizationId,
      team_id: teamId,
    });
    if (result.error) {
      toast.error(result.error);
      setRebuilding(false);
      return;
    }
    setNotFound(false);
    setLoading(false);
    if (result.data !== null) {
      const graphId = result.data.graph_id;
      setGraph((prev) => {
        if (prev !== null) return { ...prev, status: 'computing' as const };
        return {
          graph_id: graphId,
          team_id: teamId ?? null,
          organization_id: organizationId ?? null,
          status: 'computing' as const,
          computed_at: null,
          project_duration_days: 0,
          nodes: [],
          edges: [],
        };
      });
    }
    setRebuilding(false);

    async function repoll() {
      if (!mountedRef.current || pollGenRef.current !== gen) return;
      try {
        const data = await getCriticalPath({
          organization_id: organizationId,
          team_id: teamId,
        });
        if (!mountedRef.current || pollGenRef.current !== gen) return;
        if (data !== null) {
          setGraph(data);
          if (data.status === 'pending' || data.status === 'computing') {
            pollingRef.current = setTimeout(repoll, POLL_INTERVAL_MS);
          }
        }
      } catch {
        // ignore
      }
    }

    pollingRef.current = setTimeout(repoll, POLL_INTERVAL_MS);
  }

  const selectedNode: CriticalPathNode | undefined =
    selectedNodeId === null
      ? undefined
      : graph?.nodes.find((n) => {
          return n.node_id === selectedNodeId;
        });

  const criticalCount =
    graph?.nodes.filter((n) => {
      return n.is_critical;
    }).length ?? 0;
  const isComputing =
    graph?.status === 'computing' || graph?.status === 'pending';

  if (loading) {
    return (
      <Card className='h-full flex flex-col'>
        <div className='flex-1 flex items-center justify-center'>
          <div className='flex flex-col items-center gap-3'>
            <SpinLoader size='lg' />
            <p className='text-sm text-muted-foreground'>
              Loading critical path…
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (notFound) {
    return (
      <Card className='h-full flex flex-col'>
        <EmptyState
          icon={GitBranch}
          title='No critical path computed'
          description='Build the critical path graph to visualize issue dependencies and scheduling.'
        />
        <div className='flex justify-center pb-8'>
          <button
            type='button'
            disabled={rebuilding}
            onClick={handleRebuild}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50'
          >
            <GitBranch className='w-4 h-4' />
            Build Critical Path
          </button>
        </div>
      </Card>
    );
  }

  if (graph?.status === 'failed') {
    return (
      <Card className='h-full flex flex-col'>
        <EmptyState
          icon={AlertCircle}
          title='Critical path computation failed'
          description='An error occurred while computing the critical path. Try rebuilding.'
        />
        <div className='flex justify-center pb-8'>
          <button
            type='button'
            disabled={rebuilding}
            onClick={handleRebuild}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50'
          >
            <RefreshCw
              className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`}
            />
            Rebuild
          </button>
        </div>
      </Card>
    );
  }

  if (graph?.status === 'ready' && graph.nodes.length === 0) {
    return (
      <Card className='h-full flex flex-col'>
        <EmptyState
          icon={GitBranch}
          title='No active issues'
          description='No open or in-progress issues found for this scope.'
        />
      </Card>
    );
  }

  return (
    <Card className='h-full flex flex-col overflow-hidden'>
      {/* Summary bar */}
      <div
        className='flex items-center gap-2 px-4 py-2.5 shrink-0 border-b flex-wrap'
        style={{ borderColor: BORDER_COLOR }}
      >
        <div className='flex items-center gap-1.5 mr-1'>
          <GitBranch className='w-4 h-4 text-primary' />
          <span className='text-sm font-semibold'>Critical Path</span>
        </div>
        {graph !== null && (
          <>
            <StatChip label='Issues' value={graph.nodes.length} />
            <StatChip
              label='Critical'
              value={criticalCount}
              highlight={criticalCount > 0}
            />
            <StatChip
              label='Duration'
              value={`${graph.project_duration_days}d`}
            />
            {graph.computed_at !== null && (
              <StatChip
                label='Updated'
                value={formatDistanceToNow(new Date(graph.computed_at), {
                  addSuffix: true,
                })}
              />
            )}
          </>
        )}
        {isComputing && (
          <div className='flex items-center gap-1.5 text-xs text-muted-foreground ml-1'>
            <SpinLoader size='xs' />
            Computing…
          </div>
        )}
        <button
          type='button'
          disabled={rebuilding || isComputing}
          onClick={handleRebuild}
          className='ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors disabled:opacity-40'
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`}
          />
          Rebuild
        </button>
      </div>

      {/* Main area */}
      <div className='flex flex-1 min-h-0'>
        {/* Left sidebar — issue list */}
        <div
          className='flex flex-col shrink-0 border-r overflow-hidden'
          style={{ width: 228, background: BG_DARK, borderColor: BORDER_COLOR }}
        >
          <div
            className='px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b shrink-0'
            style={{ borderColor: BORDER_COLOR }}
          >
            Issues
          </div>
          <div className='overflow-y-auto flex-1 py-1.5'>
            {graph?.nodes
              .toSorted((a, b) => {
                return (a.early_start ?? 0) - (b.early_start ?? 0);
              })
              .map((node) => {
                const isActive = selectedNodeId === node.node_id;
                const dotColor = getNodeDotColor(node);
                return (
                  <button
                    key={node.node_id}
                    type='button'
                    onClick={() => {
                      return setSelectedNodeId(isActive ? null : node.node_id);
                    }}
                    className='flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors border-l-2'
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--color-destructive) 6%, transparent)'
                        : 'transparent',
                      borderLeftColor: isActive
                        ? 'var(--color-destructive)'
                        : 'transparent',
                    }}
                  >
                    <span
                      className='w-1.5 h-1.5 rounded-full shrink-0'
                      style={{
                        background: dotColor,
                        boxShadow: node.is_critical
                          ? '0 0 6px color-mix(in srgb, var(--color-destructive) 60%, transparent)'
                          : undefined,
                      }}
                    />
                    <span
                      className='flex-1 min-w-0 truncate text-xs'
                      style={{
                        color: isActive
                          ? 'var(--color-foreground)'
                          : 'var(--color-muted-foreground)',
                      }}
                    >
                      {node.issue_name ?? `Issue #${node.issue_id}`}
                    </span>
                    <span className='text-[11px] shrink-0 text-muted-foreground'>
                      {node.duration_days}d
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Graph canvas */}
        {graph !== null && (
          <CriticalPathGraph
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}

        {/* Detail panel */}
        {selectedNode !== undefined && graph !== null && (
          <CriticalPathNodeDetail
            node={selectedNode}
            allNodes={graph.nodes}
            edges={graph.edges}
            onClose={() => {
              return setSelectedNodeId(null);
            }}
            onSelectNode={setSelectedNodeId}
          />
        )}
      </div>
    </Card>
  );
}
