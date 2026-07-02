'use client';

import { useEffect, useRef, useState } from 'react';
import { type Control, useController, useWatch } from 'react-hook-form';

import { previewOrganizationCode } from '@/features/organization/api/organization';
import { CODE_VALIDATION_RULES } from '@/features/organization/lib/fields';
import { useDebounce } from '@/shared/hooks';
import Input from '@/shared/ui/input/Input';

import type { OrganizationDTO } from '@/entities/organization';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * OrganizationCodeField — Jira-style project prefix input.
 *
 * On create it debounces the org name and prefills the code from the backend
 * preview endpoint; once the user edits the code, auto-fill stops permanently.
 * The code is immutable after creation, so in edit mode it renders read-only.
 * The value is upper-cased and validated locally against the backend regex; the
 * final code is whatever the create response returns (may differ on collision).
 * @param root0 - Component props.
 * @param root0.control - the shared react-hook-form control.
 * @param root0.isEdit - true when editing an existing org (code read-only).
 * @returns JSX element.
 */
export function OrganizationCodeField({
  control,
  isEdit,
}: {
  control: Control<OrganizationDTO>;
  isEdit: boolean;
}) {
  const {
    field,
    fieldState: { error },
  } = useController({ control, name: 'code', rules: CODE_VALIDATION_RULES });

  const name = useWatch({ control, name: 'name' });
  const debouncedName = useDebounce(name ?? '', PREVIEW_DEBOUNCE_MS);

  const [userEdited, setUserEdited] = useState(false);
  const reqIdRef = useRef(0);
  const { onChange } = field;

  useEffect(() => {
    if (isEdit || userEdited) return;

    const trimmed = debouncedName.trim();

    if (!trimmed) return;

    const localReq = ++reqIdRef.current;

    previewOrganizationCode(trimmed).then((preview) => {
      // Ignore stale responses so a slow preview never overwrites a newer one.
      if (localReq !== reqIdRef.current) return;
      if (preview) onChange(preview.toUpperCase());
    });
  }, [debouncedName, isEdit, userEdited, onChange]);

  return (
    <Input
      {...field}
      value={field.value ?? ''}
      onChange={(e) => {
        setUserEdited(true);
        onChange(e.target.value.toUpperCase());
      }}
      label='Project code'
      readOnly={isEdit}
      placeholder='AUTO'
      error={typeof error?.message === 'string' ? error.message : undefined}
    />
  );
}
