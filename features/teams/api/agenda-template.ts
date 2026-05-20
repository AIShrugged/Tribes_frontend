'use server';

import { revalidatePath } from 'next/cache';

import {
  AGENDA_DEFAULT_SECTIONS,
  type AgendaSection,
  type AgendaTemplate,
  type AgendaTemplateResolved,
} from '@/features/teams/model/types';
import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type { ActionResult } from '@/shared/types/server-action';

/**
 * Backend always returns 200. When no template is configured, the response
 * contains `id: null` and `is_default: true` along with the default sections.
 */
type AgendaTemplateGetResponse =
  | AgendaTemplate
  | {
      id: null;
      team_id: number;
      sections: AgendaSection[];
      available_sections: AgendaSection[];
      is_default: true;
      created_at: null;
      updated_at: null;
    };

/**
 * Fetch the agenda template for a team. Falls back to default sections when
 * no template is configured.
 */
export async function getAgendaTemplate(
  teamId: number,
): Promise<AgendaTemplateResolved> {
  const { data } = await httpClient<AgendaTemplateGetResponse>(
    `${API_URL}/teams/${teamId}/agenda-template`,
  );

  if (!data) {
    return {
      template: null,
      sections: AGENDA_DEFAULT_SECTIONS,
      availableSections: AGENDA_DEFAULT_SECTIONS,
      isDefault: true,
    };
  }

  const isDefault = data.id === null;

  return {
    template: isDefault ? null : (data as AgendaTemplate),
    sections: data.sections,
    availableSections: data.available_sections,
    isDefault,
  };
}

/**
 * Create or update the agenda template for a team.
 */
export async function upsertAgendaTemplate(
  teamId: number,
  sections: AgendaSection[],
): Promise<ActionResult<AgendaTemplate>> {
  try {
    const { data } = await httpClient<AgendaTemplate>(
      `${API_URL}/teams/${teamId}/agenda-template`,
      {
        method: 'PUT',
        body: JSON.stringify({ sections }),
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
        'Failed to save agenda template',
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
