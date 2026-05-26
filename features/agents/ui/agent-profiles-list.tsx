'use client';

import Link from 'next/link';

import {
  formatDateTime,
  normalizeAllowedTools,
} from '@/features/agents/lib/format';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';
import { DataTable } from '@/shared/ui/table';

import type { AgentProfile } from '@/features/agents/model/types';
import type { TableColumn } from '@/shared/ui/table';

const COLUMNS: TableColumn<AgentProfile>[] = [
  {
    id: 'name',
    header: 'Name',
    renderCell: (profile) => {
      return (
        <Link
          href={ROUTES.DASHBOARD.AGENT_PROFILE_OVERVIEW(profile.id)}
          className='font-medium text-primary hover:underline'
        >
          {profile.name}
        </Link>
      );
    },
  },
  {
    id: 'description',
    header: 'Description',
    cellClassName: 'text-muted-foreground max-w-[200px]',
    renderCell: (profile) => {
      return <p className='line-clamp-2'>{profile.description || '—'}</p>;
    },
  },
  {
    id: 'status',
    header: 'Status',
    renderCell: (profile) => {
      return (
        <div className='flex flex-wrap gap-1.5'>
          <Badge variant={profile.enabled ? 'success' : 'warning'}>
            {profile.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {profile.execution_mode ? (
            <Badge>{profile.execution_mode}</Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'allowed_tools',
    header: 'Allowed tools',
    renderCell: (profile) => {
      const tools = normalizeAllowedTools(profile.allowed_tools);

      return (
        <div className='flex flex-wrap gap-2'>
          {tools.length > 0 ? (
            tools.map((tool) => {
              return <Badge key={tool}>{tool}</Badge>;
            })
          ) : (
            <span className='text-muted-foreground'>—</span>
          )}
        </div>
      );
    },
  },
  {
    id: 'sandbox_profile',
    header: 'Sandbox',
    renderCell: (profile) => {
      return profile.sandbox_profile || '—';
    },
  },
  {
    id: 'updated_at',
    header: 'Updated',
    cellClassName: 'text-muted-foreground',
    renderCell: (profile) => {
      return formatDateTime(profile.updated_at);
    },
  },
];

export function AgentProfilesList({ profiles }: { profiles: AgentProfile[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      items={profiles}
      keyExtractor={(p) => {
        return p.id;
      }}
      caption='Agents'
      captionSrOnly
      tableMinWidth='min-w-[700px]'
      renderMobileCard={(profile) => {
        return (
          <Link
            href={ROUTES.DASHBOARD.AGENT_PROFILE_OVERVIEW(profile.id)}
            className='block rounded-[var(--radius-card)] border border-border p-4 hover:bg-accent/30 transition-colors'
          >
            <div className='flex flex-wrap items-center gap-1.5'>
              <p className='font-medium text-primary'>{profile.name}</p>
              <Badge variant={profile.enabled ? 'success' : 'warning'}>
                {profile.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {profile.execution_mode ? (
                <Badge>{profile.execution_mode}</Badge>
              ) : null}
            </div>
            {profile.description && (
              <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                {profile.description}
              </p>
            )}
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {normalizeAllowedTools(profile.allowed_tools).map((tool) => {
                return <Badge key={tool}>{tool}</Badge>;
              })}
            </div>
            <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              {profile.sandbox_profile && (
                <span>Sandbox: {profile.sandbox_profile}</span>
              )}
              <span>Updated: {formatDateTime(profile.updated_at)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}
