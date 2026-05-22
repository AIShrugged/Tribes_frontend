export type MeetingScope = 'all' | 'upcoming' | 'past';

export interface MeetingsListFilters {
  scope: MeetingScope;
  team_id: number | null;
  user_id: number | null;
  offset?: number;
  limit?: number;
}

export const DEFAULT_MEETINGS_FILTERS: MeetingsListFilters = {
  scope: 'all',
  team_id: null,
  user_id: null,
};

type SearchParamsLike = {
  get(key: string): string | null;
};

function parseIntParam(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseFilters(sp: SearchParamsLike): MeetingsListFilters {
  const rawScope = sp.get('scope');

  const scope: MeetingScope =
    rawScope === 'past' || rawScope === 'upcoming' ? rawScope : 'all';

  return {
    scope,
    team_id: parseIntParam(sp.get('team_id')),
    user_id: parseIntParam(sp.get('user_id')),
  };
}

export function serializeFilters(f: MeetingsListFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.scope !== 'all') sp.set('scope', f.scope);
  if (f.team_id != null) sp.set('team_id', String(f.team_id));
  if (f.user_id != null) sp.set('user_id', String(f.user_id));
  return sp;
}

export function hasActiveFilters(f: MeetingsListFilters): boolean {
  return f.scope !== 'all' || f.team_id != null || f.user_id != null;
}

// Narrow subset of MeetingsListFilters for the calendar view (no scope/offset/limit).
export type MeetingsCalendarFilters = Pick<
  MeetingsListFilters,
  'team_id' | 'user_id'
>;

export function parseCalendarFilters(sp: {
  team_id?: string | string[];
  user_id?: string | string[];
}): MeetingsCalendarFilters {
  const rawTeam = Array.isArray(sp.team_id) ? sp.team_id[0] : sp.team_id;
  const rawUser = Array.isArray(sp.user_id) ? sp.user_id[0] : sp.user_id;
  return {
    team_id: parseIntParam(rawTeam ?? null),
    user_id: parseIntParam(rawUser ?? null),
  };
}

export function hasActiveCalendarFilters(f: MeetingsCalendarFilters): boolean {
  return f.team_id != null || f.user_id != null;
}
