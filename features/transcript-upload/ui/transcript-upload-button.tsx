'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';

import { TranscriptUploadModal } from '@/features/transcript-upload/ui/transcript-upload-modal';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

export function TranscriptUploadButton({
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
        Upload transcript
      </Button>
      <TranscriptUploadModal
        isOpen={isOpen}
        onClose={() => {
          return setIsOpen(false);
        }}
        organizationId={organizationId}
      />
    </>
  );
}
