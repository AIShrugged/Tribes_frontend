import {
  CODE_VALIDATION_RULES,
  ORGANIZATION_FIELDS,
  ORGANIZATION_VALUES,
} from '@/features/organization/lib/fields';

describe('ORGANIZATION_VALUES', () => {
  it('has empty name by default', () => {
    expect(ORGANIZATION_VALUES.name).toBe('');
  });

  it('has empty code by default', () => {
    expect(ORGANIZATION_VALUES.code).toBe('');
  });
});

describe('CODE_VALIDATION_RULES format', () => {
  const format = CODE_VALIDATION_RULES.validate.format;

  it('allows an empty value (backend auto-generates)', () => {
    expect(format('')).toBe(true);
    expect(format()).toBe(true);
  });

  it('accepts a valid code', () => {
    expect(format('DEV')).toBe(true);
    expect(format('ABC123')).toBe(true);
  });

  it('rejects a code shorter than 3 chars', () => {
    expect(typeof format('AB')).toBe('string');
  });

  it('rejects a code longer than 10 chars', () => {
    expect(typeof format('ABCDEFGHIJK')).toBe('string');
  });

  it('rejects a code that does not start with a letter', () => {
    expect(typeof format('1AB')).toBe('string');
  });

  it('rejects a code with non-alphanumeric characters', () => {
    expect(typeof format('DEV-1')).toBe('string');
  });
});

describe('ORGANIZATION_FIELDS name validation', () => {
  const nameField = ORGANIZATION_FIELDS[0];
  const rules = nameField.rules;

  it('name field is required', () => {
    expect(rules.required.value).toBe(true);
  });

  it('name field has min length 3', () => {
    expect(rules.minLength.value).toBe(3);
  });

  it('name field has max length 255', () => {
    expect(rules.maxLength.value).toBe(255);
  });

  it('noOnlySpaces passes for valid name', () => {
    expect(rules.validate.noOnlySpaces('Acme Corp')).toBe(true);
  });

  it('noOnlySpaces fails for whitespace-only string shorter than 3 non-space chars', () => {
    const result = rules.validate.noOnlySpaces('   ');

    expect(result).toBe('Organization name cannot contain only spaces');
  });

  it('noOnlySpaces fails for string with fewer than 3 real chars', () => {
    const result = rules.validate.noOnlySpaces('ab');

    expect(result).toBe('Organization name cannot contain only spaces');
  });

  it('noOnlySpaces passes for exactly 3 chars', () => {
    expect(rules.validate.noOnlySpaces('abc')).toBe(true);
  });
});
