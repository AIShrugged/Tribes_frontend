'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';

import { TranscriptUploadModal } from '@/features/transcript-upload/ui/transcript-upload-modal';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';

interface Props {
  /** Active organization id from cookie. Required for fetching teams. */
  organizationId: string | null;
}

/**
 * Trigger button for the manual transcript upload modal.
 *
 * Lives as a client-side island so the meetings list page can stay a
 * Server Component. Receives `organizationId` because the modal needs
 * it to fetch teams for Mode B.
 */
export function TranscriptUploadButton({ organizationId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type='button'
        variant={BUTTON_VARIANT.secondary}
        onClick={() => setIsOpen(true)}
      >
        <Upload className='mr-2 size-4' />
        Upload transcript
      </Button>
      <TranscriptUploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        organizationId={organizationId}
      />
    </>
  );
}
