import { getMenuItems, ICONS_MAP } from '@/features/menu/lib/options';

describe('getMenuItems', () => {
  it('contains at least 3 items', () => {
    expect(getMenuItems().length).toBeGreaterThanOrEqual(3);
  });

  it('each item has id, label, icon and href', () => {
    for (const item of getMenuItems()) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.href).toBeTruthy();
    }
  });

  it('all ids are unique', () => {
    const items = getMenuItems();
    const ids = items.map((item) => {
      return item.id;
    });

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a Teams item', () => {
    const teamsItem = getMenuItems().find((item) => {
      return item.id === 'teams';
    });

    expect(teamsItem).toBeDefined();
    expect(teamsItem?.label).toBe('Teams');
  });

  it('includes a Tasks item', () => {
    const item = getMenuItems().find((menuItem) => {
      return menuItem.id === 'issues';
    });

    expect(item).toBeDefined();
    expect(item?.label).toBe('Tasks');
  });

  it('includes a Telegram item', () => {
    const item = getMenuItems().find((menuItem) => {
      return menuItem.id === 'telegram';
    });

    expect(item).toBeDefined();
    expect(item?.label).toBe('Telegram');
  });

  it('items are sorted by position ascending', () => {
    const items = getMenuItems();
    const positions = items.map((item) => {
      return item.position;
    });

    expect(positions).toEqual(
      [...positions].toSorted((a, b) => {
        return a - b;
      }),
    );
  });

  it('all hrefs are non-empty strings', () => {
    for (const item of getMenuItems()) {
      expect(typeof item.href).toBe('string');
      expect(item.href?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('ICONS_MAP', () => {
  it('has an entry for each icon key', () => {
    const keys = [
      'bot',
      'teams',
      'bookOpen',
      'calendar',
      'kanban',
      'messageSquare',
      'send',
      'bug',
    ] as const;

    for (const key of keys) {
      expect(ICONS_MAP[key]).toBeDefined();
    }
  });

  it('each icon value is defined (valid component reference)', () => {
    for (const icon of Object.values(ICONS_MAP)) {
      expect(icon).toBeDefined();
      expect(['function', 'object'].includes(typeof icon)).toBe(true);
    }
  });

  it('all menu icon keys exist in ICONS_MAP', () => {
    for (const item of getMenuItems()) {
      expect(ICONS_MAP[item.icon as keyof typeof ICONS_MAP]).toBeDefined();
    }
  });
});
