'use client';

import { Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  deletePendingAttachment,
  uploadPendingAttachment,
} from '@/features/issues/api/issues';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

import type { IssueAttachment } from '@/features/issues/model/types';

interface PendingAttachmentUploaderProps {
  uploadToken: string;
  attachments: IssueAttachment[];
  onUploaded: (attachment: IssueAttachment) => void;
  onDeleted: (attachmentId: number) => void;
  onPendingChange: (hasPending: boolean) => void;
}

function getUploadLabel(count: number): string {
  if (count > 1) return `Uploading (${count})...`;
  return 'Uploading...';
}

export function PendingAttachmentUploader({
  uploadToken,
  attachments,
  onUploaded,
  onDeleted,
  onPendingChange,
}: PendingAttachmentUploaderProps) {
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const isBusy = pendingOps.size > 0;

  useEffect(() => {
    onPendingChange(isBusy);
  }, [isBusy, onPendingChange]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILES_PER_EVENT = 10;
    if (files.length > MAX_FILES_PER_EVENT) {
      toast.error(`Maximum ${MAX_FILES_PER_EVENT} files at a time`);
      event.target.value = '';
      return;
    }

    event.target.value = '';

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10 MB limit`);
        continue;
      }

      const opId = crypto.randomUUID();

      addOp(opId);
      uploadPendingAttachment(file, uploadToken)
        .then((result) => {
          if (!isMountedRef.current) return;
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.data) onUploaded(result.data);
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          toast.error('Upload failed');
        })
        .finally(() => {
          if (!isMountedRef.current) return;
          removeOp(opId);
        });
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-foreground'>
          Attachments{' '}
          {attachments.length > 0 && (
            <span className='text-muted-foreground'>({attachments.length})</span>
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
          {isBusy ? getUploadLabel(pendingOps.size) : 'Add file'}
          <input
            type='file'
            multiple
            className='hidden'
            disabled={isBusy}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {attachments.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No attachments added yet.</p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {attachments.map((attachment) => {
            return (
              <li
                key={attachment.id}
                className='flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background/30 px-3 py-2'
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <Paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                  <span className='truncate text-sm text-foreground'>
                    {attachment.original_name ??
                      attachment.file_name ??
                      `#${attachment.id}`}
                  </span>
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
                        onDeleted(attachment.id);
                      })
                      .catch(() => {
                        if (!isMountedRef.current) return;
                        toast.error('Delete failed');
                      })
                      .finally(() => {
                        if (!isMountedRef.current) return;
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