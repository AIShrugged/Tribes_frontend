'use client';

import { Paperclip, Trash2, Upload } from 'lucide-react';
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
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-foreground'>
          Attachments{' '}
          {attachments.length > 0 && (
            <span className='text-muted-foreground'>
              ({attachments.length})
            </span>
          )}
        </span>
        <label
          className={[
            'inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)]',
            'border border-input bg-background px-3 py-1.5 text-sm font-medium',
            'text-foreground hover:bg-accent transition-colors',
            isBusy ? 'pointer-events-none opacity-50' : '',
          ].join(' ')}
        >
          <Upload className='h-3.5 w-3.5' />
          {isBusy ? getUploadLabel(pendingOps.size) : 'Add files'}
          <input
            type='file'
            className='hidden'
            accept='.pdf,.docx,.md,.txt'
            multiple
            disabled={isBusy}
            onChange={(event) => {
              const files = [...event.target.files ?? []];

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
                    toast.error(`Failed to upload "${originalName}". Please try again.`);
                  })
                  .finally(() => {
                    removeOp(opId);
                  });
              }
            }}
          />
        </label>
      </div>

      {attachments.length > 0 && (
        <ul className='flex flex-col gap-2'>
          {attachments.map((attachment) => {
            const displayName = getDisplayName(attachment);

            return (
              <li
                key={attachment.id}
                className='flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] border border-border bg-background/30 px-3 py-2'
              >
                <Paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                  <span className='truncate text-sm text-foreground'>
                    {displayName}
                  </span>
                  {fileSizes.has(attachment.id) && (
                    <span className='shrink-0 text-xs text-muted-foreground'>
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
