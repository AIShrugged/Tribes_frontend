'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';

import { TaskDataUploadModal } from '@/features/task-data-upload/ui/task-data-upload-modal';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

export function TaskDataUploadButton({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type='button'
        variant={BUTTON_VARIANT.secondary}
        onClick={() => {
          return setIsOpen(true);
        }}
      >
        <Upload className='mr-2 size-4' />
        Upload task data
      </Button>
      <TaskDataUploadModal
        isOpen={isOpen}
        onClose={() => {
          return setIsOpen(false);
        }}
        organizationId={organizationId}
      />
    </>
  );
}
