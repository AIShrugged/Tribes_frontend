import type { TranscriptUploadFormData } from './schema';

export type TranscriptUploadInput = TranscriptUploadFormData;

/**
 * Shape of backend response data block on 201.
 * Mirrors TranscriptUploadController::upload() return payload.
 */
export interface UploadTranscriptResponse {
  /** transcript_uploads row id — used to deep-link the moderation review screen when gated. */
  upload_id: number | null;
  /** True when pre-moderation is on for this upload — redirect to the review screen instead of the meeting. */
  moderation: boolean;
  calendar_event_id: number;
  transcript_entries_count: number;
  participants_count: number;
}
