import type { UserRole } from '@/entities/organization';
import type { IssueAttachment } from '@/features/issues';

export type DraftStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TemplateValue = 'IT';
export type TaskType = 'development' | 'organization';

export type PendingAttachment = IssueAttachment;

export interface OnboardingDraftResponse {
  id: number;
  status: DraftStatus;
  error: string | null;
  result: OnboardingDraftResult | null;
}

export interface OnboardingDraftResultComplete {
  organization: { name: string; description: string };
  goals: DraftGoal[];
  team: DraftTeamMember[];
}

export interface OnboardingDraftResultNeedsInfo {
  needs_more_info: true;
  message: string;
  questions: string[];
}

export type OnboardingDraftResult =
  | OnboardingDraftResultComplete
  | OnboardingDraftResultNeedsInfo;

export function isNeedsMoreInfo(
  r: OnboardingDraftResult,
): r is OnboardingDraftResultNeedsInfo {
  return 'needs_more_info' in r && r.needs_more_info === true;
}

export interface DraftGoal {
  title: string;
  description: string;
  tasks: DraftTask[];
}

export interface DraftTask {
  title: string;
  description: string;
  type: TaskType;
  priority: number;
}

export interface DraftTeamMember {
  name: string;
  email: string | null;
  role: string | null;
  found_in: string[];
  already_in_system: boolean;
  system_user_id: number | null;
}

export interface EditableGoal {
  _id: string;
  title: string;
  description: string;
  tasks: DraftTask[];
}

export interface EditableTeamMember {
  _id: string;
  name: string;
  email: string | null;
  role: string | null;
  found_in: string[];
  already_in_system: boolean;
  system_user_id: number | null;
}

export interface InputState {
  description: string;
  uploadToken: string | null;
  links: string[];
  attachments: PendingAttachment[];
  template: TemplateValue | null;
}

export interface NeedsInfoData {
  message: string;
  questions: string[];
}

export interface PreviewData {
  organization: { name: string; description: string };
  goals: EditableGoal[];
  team: EditableTeamMember[];
}

export interface GenerateStructurePayload {
  description?: string;
  upload_token?: string;
  links?: string[];
  template?: TemplateValue;
}

export interface AcceptStructurePayload {
  organization: {
    name: string;
    description: string;
  };
  goals: Array<{
    title: string;
    description?: string;
    tasks?: Array<{
      title: string;
      description?: string;
      type?: TaskType;
      priority?: number;
    }>;
  }>;
  team?: Array<{
    name: string;
    email?: string;
    role?: UserRole;
  }>;
  template?: TemplateValue;
}

export interface AcceptStructureResponse {
  id: number;
  name: string;
  slug: string;
  context: string;
  onboarded_at: string;
}
