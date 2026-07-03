import {
  brainInstanceStatusMeta,
  claudeAuthTypeLabel,
  isTransitionalStatus,
} from '@/features/brain/lib/instance-status';

import type { SecondBrainStatus } from '@/features/brain/model/types';

describe('brainInstanceStatusMeta', () => {
  it.each<[SecondBrainStatus, string, string, boolean]>([
    ['disabled', 'Выключен', 'neutral', false],
    ['pending', 'Запускается…', 'info', true],
    ['running', 'Работает', 'success', false],
    ['stopping', 'Выключается…', 'warning', true],
    ['stopped', 'Остановлен', 'warning', true],
    ['error', 'Ошибка', 'danger', false],
  ])(
    'maps %s → label/variant/transitional',
    (status, label, variant, transitional) => {
      const meta = brainInstanceStatusMeta(status);

      expect(meta.label).toBe(label);
      expect(meta.variant).toBe(variant);
      expect(meta.isTransitional).toBe(transitional);
    },
  );

  it('falls back to a neutral pill for an unknown status', () => {
    const meta = brainInstanceStatusMeta('weird' as SecondBrainStatus);

    expect(meta.variant).toBe('neutral');
    expect(meta.isTransitional).toBe(false);
    expect(meta.label).toBe('weird');
  });
});

describe('isTransitionalStatus', () => {
  it('is true only for pending / stopping / stopped', () => {
    expect(isTransitionalStatus('pending')).toBe(true);
    expect(isTransitionalStatus('stopping')).toBe(true);
    expect(isTransitionalStatus('stopped')).toBe(true);
    expect(isTransitionalStatus('running')).toBe(false);
    expect(isTransitionalStatus('disabled')).toBe(false);
    expect(isTransitionalStatus('error')).toBe(false);
  });
});

describe('claudeAuthTypeLabel', () => {
  it('labels each auth type and dashes the empty case', () => {
    expect(claudeAuthTypeLabel('oauth')).toBe('Подписка Claude');
    expect(claudeAuthTypeLabel('api_key')).toBe('API-ключ Anthropic');
    expect(claudeAuthTypeLabel(null)).toBe('—');
    // eslint-disable-next-line unicorn/no-useless-undefined
    expect(claudeAuthTypeLabel(undefined)).toBe('—');
  });
});
