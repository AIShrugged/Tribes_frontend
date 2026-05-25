import type { TranscriptUploadFormData } from './schema';

export type TranscriptUploadInput = TranscriptUploadFormData;

/**
 * Shape of backend response data block on 201.
 * Mirrors TranscriptUploadController::upload() return payload.
 */
export interface UploadTranscriptResponse {
  calendar_event_id: number;
  transcript_entries_count: number;
  participants_count: number;
}
