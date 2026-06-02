import { isNeedsMoreInfo } from './types';

import type {
  DraftTeamMember,
  EditableGoal,
  EditableTeamMember,
  InputState,
  NeedsInfoData,
  OnboardingDraftResponse,
  OnboardingDraftResultComplete,
  PendingAttachment,
  PreviewData,
  TemplateValue,
} from './types';

// ─── State ───────────────────────────────────────────────────────────────────

export type WizardStep =
  | { step: 'input'; inputState: InputState }
  | { step: 'processing'; inputState: InputState }
  | { step: 'preview'; inputState: InputState; previewData: PreviewData }
  | {
      step: 'needs_info';
      inputState: InputState;
      needsInfoData: NeedsInfoData;
    }
  | { step: 'error'; inputState: InputState; message: string }
  | { step: 'timeout'; inputState: InputState };

export type WizardAction =
  | { type: 'SET_UPLOAD_TOKEN'; token: string }
  | { type: 'SET_DESCRIPTION'; value: string }
  | { type: 'LINK_ADD' }
  | { type: 'LINK_CHANGE'; index: number; value: string }
  | { type: 'LINK_REMOVE'; index: number }
  | { type: 'ATTACHMENT_UPLOADED'; attachment: PendingAttachment }
  | { type: 'ATTACHMENT_DELETED'; id: number }
  | { type: 'GENERATE_STARTED' }
  | { type: 'POLL_RESULT'; draft: OnboardingDraftResponse }
  | { type: 'POLL_TIMEOUT' }
  | { type: 'BACK_TO_INPUT' }
  | { type: 'ORG_DESC_CHANGE'; value: string }
  | { type: 'GOAL_UPDATE'; index: number; goal: EditableGoal }
  | { type: 'GOAL_REMOVE'; index: number }
  | { type: 'MEMBER_UPDATE'; id: string; member: EditableTeamMember }
  | { type: 'MEMBER_REMOVE'; id: string }
  | { type: 'MEMBER_ADD' }
  | { type: 'SET_TEMPLATE'; value: TemplateValue | null }
  | { type: 'CANCEL_GENERATION' };

// ─── Constants ────────────────────────────────────────────────────────────────

export const EMPTY_INPUT: InputState = {
  description: '',
  uploadToken: crypto.randomUUID(),
  links: [],
  attachments: [],
  template: null,
};

export const BLANK_MEMBER: EditableTeamMember = {
  _id: '',
  name: '',
  email: null,
  role: null,
  found_in: [],
  already_in_system: false,
  system_user_id: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toEditableTeamMember(m: DraftTeamMember): EditableTeamMember {
  return {
    _id: crypto.randomUUID(),
    name: m.name,
    email: m.email,
    role: m.role,
    found_in: m.found_in,
    already_in_system: m.already_in_system,
    system_user_id: m.system_user_id,
  };
}

// Centralises the `as WizardStep` cast — spread on a discriminated union
// is structurally correct (only inputState is mutated, every variant carries
// it) but TypeScript cannot prove it; one cast here instead of per-case.
function withInputState(state: WizardStep, next: InputState): WizardStep {
  return { ...state, inputState: next } as WizardStep;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state: WizardStep, action: WizardAction): WizardStep {
  const inputState = 'inputState' in state ? state.inputState : EMPTY_INPUT;

  switch (action.type) {
    case 'SET_UPLOAD_TOKEN': {
      return withInputState(state, {
        ...inputState,
        uploadToken: action.token,
      });
    }

    case 'SET_DESCRIPTION': {
      return withInputState(state, {
        ...inputState,
        description: action.value,
      });
    }

    case 'LINK_ADD': {
      return withInputState(state, {
        ...inputState,
        links: [...inputState.links, ''],
      });
    }

    case 'LINK_CHANGE': {
      return withInputState(state, {
        ...inputState,
        links: inputState.links.map((l, i) => {
          return i === action.index ? action.value : l;
        }),
      });
    }

    case 'LINK_REMOVE': {
      return withInputState(state, {
        ...inputState,
        links: inputState.links.filter((_, i) => {
          return i !== action.index;
        }),
      });
    }

    case 'ATTACHMENT_UPLOADED': {
      return withInputState(state, {
        ...inputState,
        attachments: [...inputState.attachments, action.attachment],
      });
    }

    case 'ATTACHMENT_DELETED': {
      return withInputState(state, {
        ...inputState,
        attachments: inputState.attachments.filter((a) => {
          return a.id !== action.id;
        }),
      });
    }

    case 'GENERATE_STARTED': {
      return { step: 'processing', inputState };
    }

    case 'POLL_RESULT': {
      const { draft } = action;

      if (draft.status === 'pending' || draft.status === 'processing') {
        return state;
      }

      if (draft.status === 'failed' || !draft.result) {
        return {
          step: 'error',
          inputState,
          message: draft.error ?? 'Generation failed. Please try again.',
        };
      }

      if (isNeedsMoreInfo(draft.result)) {
        return {
          step: 'needs_info',
          inputState,
          needsInfoData: {
            message: draft.result.message,
            questions: draft.result.questions,
          },
        };
      }

      return {
        step: 'preview',
        inputState,
        previewData: {
          organization: draft.result.organization,
          goals: draft.result.goals.map((g) => {
            return {
              _id: crypto.randomUUID(),
              ...g,
            };
          }),
          team: draft.result.team.map((m) => {
            return toEditableTeamMember(m);
          }),
        },
      };
    }

    case 'POLL_TIMEOUT': {
      return { step: 'timeout', inputState };
    }

    case 'BACK_TO_INPUT':
    case 'CANCEL_GENERATION': {
      return { step: 'input', inputState };
    }

    case 'ORG_DESC_CHANGE': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          organization: {
            ...state.previewData.organization,
            description: action.value,
          },
        },
      };
    }

    case 'GOAL_UPDATE': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          goals: state.previewData.goals.map((g, i) => {
            return i === action.index ? action.goal : g;
          }),
        },
      };
    }

    case 'GOAL_REMOVE': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          goals: state.previewData.goals.filter((_, i) => {
            return i !== action.index;
          }),
        },
      };
    }

    case 'MEMBER_UPDATE': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          team: state.previewData.team.map((m) => {
            return m._id === action.id ? action.member : m;
          }),
        },
      };
    }

    case 'MEMBER_REMOVE': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          team: state.previewData.team.filter((m) => {
            return m._id !== action.id;
          }),
        },
      };
    }

    case 'MEMBER_ADD': {
      if (state.step !== 'preview') return state;
      return {
        ...state,
        previewData: {
          ...state.previewData,
          team: [
            ...state.previewData.team,
            { ...BLANK_MEMBER, _id: crypto.randomUUID() },
          ],
        },
      };
    }

    case 'SET_TEMPLATE': {
      return withInputState(state, { ...inputState, template: action.value });
    }

    default: {
      return state;
    }
  }
}

// ─── Initializer ──────────────────────────────────────────────────────────────

export function buildInitialState(
  initialDraft: OnboardingDraftResponse | null,
): WizardStep {
  if (
    initialDraft?.status === 'pending' ||
    initialDraft?.status === 'processing'
  ) {
    return { step: 'processing', inputState: EMPTY_INPUT };
  }

  if (initialDraft?.status !== 'completed' || !initialDraft.result) {
    return { step: 'input', inputState: EMPTY_INPUT };
  }

  const { result } = initialDraft;

  if (isNeedsMoreInfo(result)) {
    return {
      step: 'needs_info',
      inputState: EMPTY_INPUT,
      needsInfoData: {
        message: result.message,
        questions: result.questions,
      },
    };
  }

  const complete = result as OnboardingDraftResultComplete;

  return {
    step: 'preview',
    inputState: EMPTY_INPUT,
    previewData: {
      organization: complete.organization,
      goals: complete.goals.map((g) => {
        return {
          _id: crypto.randomUUID(),
          ...g,
        };
      }),
      team: complete.team.map((m) => {
        return toEditableTeamMember(m);
      }),
    },
  };
}
