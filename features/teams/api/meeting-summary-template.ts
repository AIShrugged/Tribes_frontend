'use server';

import { revalidatePath } from 'next/cache';

import {
  MEETING_SUMMARY_DEFAULT_SECTIONS,
  MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
  type MeetingSummaryDefaultPrompt,
  type MeetingSummarySection,
  type MeetingSummaryTemplate,
  type MeetingSummaryTemplateResolved,
  type MeetingSummaryTemplateVersion,
} from '@/features/teams/model/types';
import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type { ActionResult } from '@/shared/types/server-action';

/**
 * Fetch the meeting summary template for a team.
 * Backend returns 404 when no template exists — we normalize to a defaulted
 * shape so the UI always has a sections list to render.
 */
export async function getMeetingSummaryTemplate(
  teamId: number,
): Promise<MeetingSummaryTemplateResolved> {
  try {
    const { data } = await httpClient<MeetingSummaryTemplate>(
      `${API_URL}/teams/${teamId}/meeting-summary-template`,
    );

    if (!data) {
      return {
        template: null,
        sections: MEETING_SUMMARY_DEFAULT_SECTIONS,
        visibleSections: MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
        promptOverride: null,
        version: null,
        isDefault: true,
      };
    }

    return {
      template: data,
      sections: data.sections,
      visibleSections:
        data.visible_sections && data.visible_sections.length > 0
          ? data.visible_sections
          : MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
      promptOverride: data.prompt_override,
      version: data.version,
      isDefault: false,
    };
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return {
        template: null,
        sections: MEETING_SUMMARY_DEFAULT_SECTIONS,
        visibleSections: MEETING_SUMMARY_DEFAULT_VISIBLE_SECTIONS,
        promptOverride: null,
        version: null,
        isDefault: true,
      };
    }
    throw error;
  }
}

interface UpsertPayload {
  sections: MeetingSummarySection[];
  visible_sections: MeetingSummarySection[] | null;
  prompt_override: string | null;
}

/**
 * Fetch the read-only default LLM prompt template used when no override is set.
 * Same for all teams.
 */
export async function getMeetingSummaryDefaultPrompt(): Promise<MeetingSummaryDefaultPrompt> {
  const { data } = await httpClient<MeetingSummaryDefaultPrompt>(
    `${API_URL}/meeting-summary-template/default-prompt`,
  );
  return data ?? { default_prompt: '', placeholders: [] };
}

/**
 * Create or update the meeting summary template for a team.
 */
export async function upsertMeetingSummaryTemplate(
  teamId: number,
  payload: UpsertPayload,
): Promise<ActionResult<MeetingSummaryTemplate>> {
  try {
    const { data } = await httpClient<MeetingSummaryTemplate>(
      `${API_URL}/teams/${teamId}/meeting-summary-template`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    revalidatePath('/dashboard/teams', 'page');

    if (!data) {
      return { data: null, error: 'Empty response from server' };
    }

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to save meeting summary template',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}

/**
 * Fetch historical versions of the meeting summary template (newest first).
 */
export async function listMeetingSummaryTemplateVersions(
  teamId: number,
): Promise<MeetingSummaryTemplateVersion[]> {
  const { data } = await httpClient<MeetingSummaryTemplateVersion[]>(
    `${API_URL}/teams/${teamId}/meeting-summary-template/versions`,
  );
  return data ?? [];
}

/**
 * Restore a previous version onto the current template. Backend bumps the version
 * and snapshots the now-overwritten current state into history.
 */
export async function restoreMeetingSummaryTemplateVersion(
  teamId: number,
  version: number,
): Promise<ActionResult<MeetingSummaryTemplate>> {
  try {
    const { data } = await httpClient<MeetingSummaryTemplate>(
      `${API_URL}/teams/${teamId}/meeting-summary-template/versions/${version}/restore`,
      { method: 'POST' },
    );

    revalidatePath('/dashboard/teams', 'page');

    if (!data) {
      return { data: null, error: 'Empty response from server' };
    }
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to restore version',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}
