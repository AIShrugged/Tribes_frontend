import type { MenuProps } from './types';
import type { UserMenuPreferences } from '@/entities/user';

const PRIMARY_IDS = new Set(['today', 'meetings', 'issues']);

export function applyMenuPreferences(
  allItems: MenuProps[],
  prefs?: UserMenuPreferences | null,
): { primary: MenuProps[]; secondary: MenuProps[] } {
  if (!prefs) {
    return {
      primary: allItems.filter((item) => {
        return PRIMARY_IDS.has(item.id);
      }),
      secondary: allItems.filter((item) => {
        return !PRIMARY_IDS.has(item.id);
      }),
    };
  }

  const byId = new Map(
    allItems.map((item) => {
      return [item.id, item];
    }),
  );
  const placed = new Set<string>();

  const resolve = (
    prefItems: { id: string; visible: boolean }[],
  ): MenuProps[] => {
    const result: MenuProps[] = [];
    for (const pref of prefItems) {
      if (!pref.visible) {
        continue;
      }
      const item = byId.get(pref.id);
      if (item) {
        result.push(item);
        placed.add(pref.id);
      }
    }
    return result;
  };

  const primary = resolve(prefs.primary ?? []);
  const secondary = resolve(prefs.secondary ?? []);

  // Mark hidden items (visible: false in any zone) as placed so they don't
  // fall through to the visible secondary fallback.
  for (const pref of [...(prefs.primary ?? []), ...(prefs.secondary ?? [])]) {
    if (!pref.visible) {
      placed.add(pref.id);
    }
  }

  for (const item of allItems) {
    if (!placed.has(item.id)) {
      secondary.push(item);
    }
  }

  return { primary, secondary };
}
