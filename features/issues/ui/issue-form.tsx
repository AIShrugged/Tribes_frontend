'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createIssue,
  deleteIssue,
  deletePendingAttachment,
  linkIssuesToEpic,
  updateIssue,
} from '@/features/issues/api/issues';
import {
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '@/features/issues/model/types';
import { PendingAttachmentUploader } from '@/features/issues/ui/pending-attachment-uploader';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Input from '@/shared/ui/input/Input';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import InputTextarea from '@/shared/ui/input/InputTextarea';
import { Modal } from '@/shared/ui/modal/modal';

import type { UserBasicProps } from '@/entities/user';
import type {
  EpicOption,
  Issue,
  IssueAttachment,
  IssueStatus,
  PersonOption,
} from '@/features/issues/model/types';

const FORM_TYPE_OPTIONS = [
  { value: 'organization', label: 'Task' },
  { value: 'epic', label: 'Epic' },
] as const;

const DESCRIPTION_TEMPLATE_TASK =
  '## Context\n\n\n## Steps\n\n\n## Definition of Done\n\n';
const DESCRIPTION_TEMPLATE_EPIC = '## Context\n\n\n## Steps\n\n';

interface IssueFormProps {
  persons: PersonOption[];
  epics?: EpicOption[];
  /** Non-epic issues available as children when type=epic */
  tasks?: Issue[];
  issue?: Issue;
  defaultOrganizationId?: string;
  currentUser?: UserBasicProps | null;
  /** Back href passed from the page (validated ?from= param). Forwarded to the detail page after creation. */
  backHref?: string;
}

interface IssueFormValues {
  name: string;
  description: string;
  type: string;
  status: IssueStatus | '';
  organization_id: string;
  team_id: string;
  epic_id: string;
  assignee_id: string;
  author_id: string;
  due_date: string;
  priority: string;
}

function submitLabel(hasPendingOps: boolean, isEdit: boolean): string {
  if (hasPendingOps) return 'Uploading...';
  return isEdit ? 'Save changes' : 'Create task';
}

function resolveDisplayType(rawType: string | undefined): string {
  if (rawType === 'epic') return 'epic';
  return 'organization';
}

export function IssueForm({
  persons,
  epics = [],
  tasks = [],
  issue,
  defaultOrganizationId = '',
  currentUser,
  backHref,
}: IssueFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<
    IssueAttachment[]
  >([]);
  const [hasPendingOps, setHasPendingOps] = useState(false);
  const isSubmittedRef = useRef(false);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const savedEpicIdRef = useRef<string | undefined>(undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialChildIds = useMemo(() => {
    return (issue?.child_issues ?? []).map((c) => {
      return String(c.id);
    });
  }, [issue]);
  const [selectedChildIds, setSelectedChildIds] =
    useState<string[]>(initialChildIds);

  const availableTasks = useMemo(() => {
    return tasks.filter((t) => {
      return !t.epic_id || (issue?.id !== undefined && t.epic_id === issue.id);
    });
  }, [tasks, issue]);

  // Stable upload token for create mode
  const [uploadToken] = useState<string>(() => {
    return crypto.randomUUID();
  });

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  });

  // Cleanup pending attachments if the create form is abandoned without submitting.
  useEffect(() => {
    if (issue) return;
    return () => {
      if (isSubmittedRef.current) return;
      for (const att of pendingAttachmentsRef.current) {
        void deletePendingAttachment(att.id);
      }
    };
  }, []);

  const defaultAuthorId = issue?.user_id
    ? String(issue.user_id)
    : String(currentUser?.id ?? '');

  const resolvedType = resolveDisplayType(issue?.type);

  const defaultValues = useMemo<IssueFormValues>(() => {
    const type = resolvedType;
    const description =
      issue?.description ??
      (type === 'epic' ? DESCRIPTION_TEMPLATE_EPIC : DESCRIPTION_TEMPLATE_TASK);

    return {
      name: issue?.name ?? '',
      description,
      type,
      status: issue?.status ?? '',
      organization_id:
        defaultOrganizationId ||
        (issue?.organization_id ? String(issue.organization_id) : ''),
      team_id: '',
      epic_id: issue?.epic_id ? String(issue.epic_id) : '',
      assignee_id: issue?.assignee_id ? String(issue.assignee_id) : '',
      author_id: defaultAuthorId,
      due_date: issue?.due_date ?? '',
      priority: issue?.priority == null ? '' : String(issue.priority),
    };
  }, [defaultOrganizationId, issue, defaultAuthorId, resolvedType]);

  const {
    register,
    watch,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<IssueFormValues>({
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const watchedType = useWatch({ control, name: 'type' });
  const watchedAssigneeId = useWatch({ control, name: 'assignee_id' });
  const watchedAuthorId = useWatch({ control, name: 'author_id' });

  const personOptions = [
    { value: '', label: 'Unassigned' },
    ...persons.map((person) => {
      return {
        value: String(person.id),
        label: person.email ? `${person.name} (${person.email})` : person.name,
      };
    }),
  ];
  const personIds = useMemo(() => {
    return new Set(
      persons.map((person) => {
        return String(person.id);
      }),
    );
  }, [persons]);

  useEffect(() => {
    if (watchedAssigneeId && !personIds.has(watchedAssigneeId)) {
      setValue('assignee_id', '');
      clearErrors('assignee_id');
    }

    if (watchedAuthorId && !personIds.has(watchedAuthorId)) {
      setValue('author_id', '');
      clearErrors('author_id');
    }
  }, [watchedAssigneeId, watchedAuthorId, personIds, setValue, clearErrors]);

  const statusOptions = ISSUE_STATUS_OPTIONS;

  const handleTypeChange = useCallback(
    (newType: string) => {
      const wasEpic = watchedType === 'epic';
      const isNowEpic = newType === 'epic';

      setValue('type', newType, { shouldDirty: true });
      clearErrors('type');
      setRootError('');

      if (isNowEpic && !wasEpic) {
        savedEpicIdRef.current = watch('epic_id');
        setValue('epic_id', '', { shouldDirty: true });
        clearErrors('epic_id');
      } else if (
        !isNowEpic &&
        wasEpic &&
        savedEpicIdRef.current !== undefined
      ) {
        setValue('epic_id', savedEpicIdRef.current, { shouldDirty: true });
        savedEpicIdRef.current = undefined;
      }
    },
    [watchedType, setValue, clearErrors, watch],
  );

  const onSubmit = (values: IssueFormValues) => {
    setRootError('');

    if (!values.name.trim()) {
      setError('name', { message: 'Name is required' });
      return;
    }

    if (!values.type) {
      setError('type', { message: 'Type is required' });
      return;
    }

    const organizationId = Number(values.organization_id);

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      setError('organization_id', { message: 'Organization is required' });
      return;
    }

    if (!values.status) {
      setError('status', { message: 'Status is required' });
      return;
    }

    const status = values.status as IssueStatus;

    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        type: values.type,
        status,
        organization_id: organizationId,
        team_id: null,
        epic_id: values.epic_id === '' ? null : Number(values.epic_id),
        assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
        author_id: values.author_id ? Number(values.author_id) : null,
        due_date: values.due_date || null,
        priority: values.priority === '' ? null : Number(values.priority),
        upload_token: issue ? null : uploadToken,
      };
      const result = issue
        ? await updateIssue(issue.id, payload)
        : await createIssue(payload);

      if (result.error !== null) {
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (
              field in defaultValues ||
              field === 'organization_id' ||
              field === 'team_id'
            ) {
              setError(field as keyof IssueFormValues, { message });
            }
          }
        }

        setRootError(result.error);
        return;
      }

      isSubmittedRef.current = true;

      // Link child tasks if epic
      if (result.data.type === 'epic') {
        const epicId = result.data.id;
        if (issue) {
          const prevIds = new Set(initialChildIds.map(Number));
          const toAdd = selectedChildIds.map(Number).filter((id) => {
            return !prevIds.has(id);
          });
          if (toAdd.length > 0) {
            await linkIssuesToEpic(epicId, toAdd);
          }
        } else {
          const toLink = selectedChildIds.map(Number).filter(Boolean);
          if (toLink.length > 0) {
            await linkIssuesToEpic(epicId, toLink);
          }
        }
      }

      toast.success(issue ? 'Issue updated' : 'Issue created');
      if (issue) {
        router.refresh();
      } else {
        const detailUrl = backHref
          ? `${ROUTES.DASHBOARD.ISSUES}/${result.data.id}?from=${encodeURIComponent(backHref)}`
          : `${ROUTES.DASHBOARD.ISSUES}/${result.data.id}`;
        router.push(detailUrl);
      }
    });
  };

  return (
    <form className='flex flex-col gap-4' onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('name', {
          required: 'Name is required',
          maxLength: { value: 255, message: 'Max 255 characters' },
          onChange: () => {
            clearErrors('name');
            setRootError('');
          },
        })}
        label='Name'
        value={watch('name')}
        error={errors.name?.message}
      />

      <div className='flex flex-col gap-1'>
        <span className='text-xs text-muted-foreground'>Type</span>
        <div className='flex rounded-[var(--radius-button)] bg-muted p-0.5 gap-0.5'>
          {FORM_TYPE_OPTIONS.map((opt) => {
            return (
              <button
                key={opt.value}
                type='button'
                onClick={() => {
                  handleTypeChange(opt.value);
                }}
                className={[
                  'flex-1 rounded-[var(--radius-button)] px-3 py-1 text-xs font-medium transition-all',
                  watchedType === opt.value
                    ? 'bg-card border border-white/8 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.type?.message ? (
          <span className='text-xs text-destructive'>
            {errors.type.message}
          </span>
        ) : null}
      </div>

      <InputTextarea
        {...register('description', {
          onChange: () => {
            clearErrors('description');
            setRootError('');
          },
        })}
        label='Description'
        value={watch('description')}
        rows={12}
        error={errors.description?.message}
      />

      <InputDropdown
        label='Status'
        options={statusOptions}
        value={watch('status')}
        onChange={(value) => {
          setValue('status', value as IssueStatus, { shouldDirty: true });
          clearErrors('status');
          setRootError('');
        }}
        error={errors.status?.message}
      />

      {watchedType !== 'epic' &&
        (epics.length > 0 || (!!issue && issue.epic_id !== null)) && (
          <InputDropdown
            label='Epic'
            options={[
              { value: '', label: 'None' },
              ...epics.map((e) => {
                return { value: String(e.id), label: e.name };
              }),
            ]}
            value={watch('epic_id')}
            onChange={(value) => {
              setValue('epic_id', value as string, { shouldDirty: true });
            }}
            searchable
          />
        )}

      {watchedType === 'epic' && (
        <InputDropdown
          label='Child tasks'
          multiple
          options={availableTasks.map((t) => {
            return { value: String(t.id), label: `#${t.id} ${t.name}` };
          })}
          value={selectedChildIds}
          onChange={(value) => {
            setSelectedChildIds(value as string[]);
          }}
          searchable
        />
      )}

      <div className='grid gap-2 md:grid-cols-2'>
        <InputDropdown
          label='Assignee'
          options={personOptions}
          value={watch('assignee_id')}
          onChange={(value) => {
            setValue('assignee_id', value as string, { shouldDirty: true });
            clearErrors('assignee_id');
          }}
          searchable
          error={errors.assignee_id?.message}
        />

        <InputDropdown
          label='Author'
          options={personOptions}
          value={watch('author_id')}
          onChange={(value) => {
            setValue('author_id', value as string, { shouldDirty: true });
            clearErrors('author_id');
          }}
          searchable
          error={errors.author_id?.message}
        />
      </div>

      <div className='grid gap-2 md:grid-cols-2'>
        <Input
          {...register('due_date', {
            onChange: () => {
              clearErrors('due_date');
              setRootError('');
            },
          })}
          type='date'
          label='Deadline'
          value={watch('due_date')}
          error={errors.due_date?.message}
        />

        <InputDropdown
          label='Priority'
          options={PRIORITY_OPTIONS}
          value={watch('priority')}
          onChange={(value) => {
            setValue('priority', value as string, { shouldDirty: true });
            clearErrors('priority');
          }}
          error={errors.priority?.message}
        />
      </div>

      {!issue && (
        <PendingAttachmentUploader
          uploadToken={uploadToken}
          attachments={pendingAttachments}
          onUploaded={(attachment) => {
            setPendingAttachments((prev) => {
              return [...prev, attachment];
            });
          }}
          onDeleted={(id) => {
            setPendingAttachments((prev) => {
              return prev.filter((a) => {
                return a.id !== id;
              });
            });
          }}
          onPendingChange={setHasPendingOps}
        />
      )}

      {rootError ? (
        <p className='text-sm text-destructive'>{rootError}</p>
      ) : null}

      <div className='grid gap-2 md:grid-cols-2'>
        <Button
          type='submit'
          loading={isPending}
          disabled={isPending || (!!issue && !isDirty) || hasPendingOps}
        >
          {submitLabel(hasPendingOps, !!issue)}
        </Button>
        {issue ? (
          <>
            <Button
              type='button'
              variant={BUTTON_VARIANT.danger}
              className='w-auto px-4'
              onClick={() => {
                setShowDeleteConfirm(true);
              }}
            >
              Delete issue
            </Button>
            <Modal
              isOpen={showDeleteConfirm}
              onClose={() => {
                setShowDeleteConfirm(false);
              }}
              title='Delete issue'
            >
              <div className='flex flex-col gap-4'>
                <p className='text-sm text-muted-foreground'>
                  This will permanently delete the issue. This action cannot be
                  undone.
                </p>
                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    variant={BUTTON_VARIANT.secondary}
                    className='w-auto px-4'
                    onClick={() => {
                      setShowDeleteConfirm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type='button'
                    variant={BUTTON_VARIANT.danger}
                    className='w-auto px-4'
                    loading={isPending}
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      startTransition(async () => {
                        await deleteIssue(issue.id);
                        toast.success('Task deleted');
                        router.push(ROUTES.DASHBOARD.ISSUES);
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Modal>
          </>
        ) : null}
      </div>
    </form>
  );
}
