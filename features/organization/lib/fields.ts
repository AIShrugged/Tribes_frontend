import type { OrganizationDTO } from '@/entities/organization';

const NAME_VALIDATION_RULES = {
  required: {
    value: true,
    message: 'Organization name is required',
  },
  minLength: {
    value: 3,
    message: 'Organization name must be at least 3 characters',
  },
  maxLength: {
    value: 255,
    message: 'Organization name must not exceed 255 characters',
  },
  validate: {
    /**
     * noOnlySpaces.
     * @param value - value.
     * @returns Result.
     */
    noOnlySpaces: (value?: string) => {
      return (
        (value ?? '').trim().length >= 3 ||
        'Organization name cannot contain only spaces'
      );
    },
  },
} as const;

// Backend prefix rule: starts with a letter, latin letters/digits only, 3-10
// chars. Empty is allowed here — an omitted code lets the backend auto-generate.
export const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]{2,9}$/;

export const CODE_VALIDATION_RULES = {
  validate: {
    /**
     * format — allow empty (auto-generate) or a value matching CODE_PATTERN.
     * @param value - the code field value.
     * @returns true or an error message.
     */
    format: (value?: string) => {
      return (
        !value ||
        CODE_PATTERN.test(value) ||
        'Code must be 3–10 characters, start with a letter, letters/numbers only'
      );
    },
  },
} as const;

export const ORGANIZATION_VALUES: OrganizationDTO = {
  name: '',
  code: '',
};

export const ORGANIZATION_FIELDS = [
  {
    variant: 'input' as const,
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Name',
    rules: NAME_VALIDATION_RULES,
  },
];
