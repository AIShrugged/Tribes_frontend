'use client';

import { FileText, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  deletePendingAttachment,
  uploadPendingAttachment,
} from '@/features/onboarding/api/attachments';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

import type { PendingAttachment } from '../model/types';

const MAX_SIZE_KB = 10_240;
const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;

interface Props {
  uploadToken: string;
  attachments: PendingAttachment[];
  organizationId: number;
  onUploaded: (attachment: PendingAttachment) => void;
  onDeleted: (attachmentId: number) => void;
  onPendingChange: (hasPending: boolean) => void;
}

function getUploadLabel(count: number): string {
  if (count > 1) return `Uploading (${count})...`;
  return 'Uploading...';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OnboardingFileUpload({
  uploadToken,
  attachments,
  organizationId,
  onUploaded,
  onDeleted,
  onPendingChange,
}: Props) {
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const [fileNames, setFileNames] = useState<Map<number, string>>(new Map());
  const [fileSizes, setFileSizes] = useState<Map<number, number>>(new Map());
  const isMountedRef = useRef(true);

  const isBusy = pendingOps.size > 0;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onPendingChange(isBusy);
  }, [isBusy, onPendingChange]);

  function addOp(id: string) {
    setPendingOps((prev) => {
      const next = new Set(prev);

      next.add(id);
      return next;
    });
  }

  function removeOp(id: string) {
    setPendingOps((prev) => {
      const next = new Set(prev);

      next.delete(id);
      return next;
    });
  }

  function getDisplayName(attachment: PendingAttachment): string {
    return (
      fileNames.get(attachment.id) ??
      attachment.original_name ??
      `attachment-${attachment.id}`
    );
  }

  function removeFileName(id: number) {
    setFileNames((prev) => {
      const next = new Map(prev);

      next.delete(id);
      return next;
    });
  }

  function removeFileSize(id: number) {
    setFileSizes((prev) => {
      const next = new Map(prev);

      next.delete(id);
      return next;
    });
  }

  return (
    <div className='flex flex-col gap-3 border-t border-border pt-3'>
      <label
        className={[
          'relative flex cursor-pointer items-center gap-3 rounded-[var(--r-lg)]',
          'border border-dashed border-border bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))] p-4',
          'text-left transition-colors hover:border-primary hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]',
          isBusy ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-[var(--primary-300)]'>
          <Upload className='h-4 w-4' />
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='text-sm font-medium text-foreground'>
            {isBusy ? getUploadLabel(pendingOps.size) : 'Drop files or browse'}
          </span>
          <span className='text-xs text-muted-foreground'>
            PDF, DOCX, MD or TXT up to {formatSize(MAX_SIZE_BYTES)}
          </span>
        </span>
        <span className='hidden rounded-[var(--r-sm)] border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground sm:inline-flex'>
          Add files
        </span>
        <input
          type='file'
          className='absolute inset-0 cursor-pointer opacity-0'
          accept='.pdf,.docx,.md,.txt'
          multiple
          disabled={isBusy}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];

            event.target.value = '';
            if (files.length === 0) return;

            for (const file of files) {
              if (file.size > MAX_SIZE_BYTES) {
                toast.error(
                  `"${file.name}" exceeds ${formatSize(MAX_SIZE_BYTES)} limit`,
                );
                continue;
              }

              const opId = crypto.randomUUID();
              const originalName = file.name;
              const originalSize = file.size;

              addOp(opId);
              uploadPendingAttachment(file, uploadToken, organizationId)
                .then((result) => {
                  if (!isMountedRef.current) return;
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  if (result.data) {
                    const id = result.data.id;

                    setFileNames((prev) => {
                      return new Map(prev).set(id, originalName);
                    });
                    setFileSizes((prev) => {
                      return new Map(prev).set(id, originalSize);
                    });
                    onUploaded(result.data);
                  }
                })
                .catch(() => {
                  if (!isMountedRef.current) return;
                  toast.error(
                    `Failed to upload "${originalName}". Please try again.`,
                  );
                })
                .finally(() => {
                  removeOp(opId);
                });
            }
          }}
        />
      </label>

      {attachments.length > 0 && (
        <ul className='flex flex-col gap-2'>
          {attachments.map((attachment) => {
            const displayName = getDisplayName(attachment);

            return (
              <li
                key={attachment.id}
                className='flex min-w-0 items-center gap-3 rounded-[var(--r-md)] border border-input bg-card px-3 py-2'
              >
                <span className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-secondary text-muted-foreground'>
                  <FileText className='h-4 w-4' />
                </span>
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                  <span className='truncate text-sm font-medium text-foreground'>
                    {displayName}
                  </span>
                  {fileSizes.has(attachment.id) && (
                    <span className='inline-flex items-center gap-1.5 text-[var(--fs-xxs)] text-[var(--neutral-500)] before:h-1 before:w-1 before:rounded-full before:bg-[var(--success-500)]'>
                      {formatSize(fileSizes.get(attachment.id)!)}
                    </span>
                  )}
                </div>
                <Button
                  type='button'
                  variant={BUTTON_VARIANT.ghost}
                  fullWidth={false}
                  className='h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive'
                  disabled={isBusy}
                  onClick={() => {
                    const opId = crypto.randomUUID();

                    addOp(opId);
                    deletePendingAttachment(attachment.id)
                      .then((result) => {
                        if (!isMountedRef.current) return;
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        removeFileName(attachment.id);
                        removeFileSize(attachment.id);
                        onDeleted(attachment.id);
                      })
                      .catch(() => {
                        toast.error('Delete failed. Please try again.');
                      })
                      .finally(() => {
                        removeOp(opId);
                      });
                  }}
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
