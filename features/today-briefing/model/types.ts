// ─── Insight types ────────────────────────────────────────────────────────────

export type InsightCategory =
  | 'communication_style'
  | 'work_patterns'
  | 'strengths'
  | 'development_areas'
  | 'goals_motivations'
  | 'psychological_profile';

export type InsightContextType =
  | 'current_projects'
  | 'recent_decisions'
  | 'emotional_state'
  | 'general_knowledge'
  | 'user_focus';

export type InsightRelationshipType =
  | 'collaborative'
  | 'conflicting'
  | 'hierarchical'
  | 'neutral';

// Per-category content shapes (from InsightPromptBuilder.getCategorySchema)
export interface InsightContentCommunicationStyle {
  tone?: string;
  listening?: string;
  preferred_format?: string;
  language_patterns?: string[];
}

export interface InsightContentWorkPatterns {
  meeting_role?: string;
  decision_style?: string;
  deadline_reliability?: string;
  collaboration_preference?: string;
}

export interface InsightContentStrengths {
  items?: string[];
  evidence?: string[];
}

export interface InsightContentDevelopmentAreas {
  items?: string[];
  evidence?: string[];
}

export interface InsightContentGoalsMotivations {
  current_goals?: string[];
  motivators?: string[];
  concerns?: string[];
}

export interface InsightContentPsychologicalProfile {
  personality_traits?: string[];
  stress_indicators?: string[];
  trust_level?: string;
  conflict_style?: string;
}

export type InsightCategoryContent =
  | InsightContentCommunicationStyle
  | InsightContentWorkPatterns
  | InsightContentStrengths
  | InsightContentDevelopmentAreas
  | InsightContentGoalsMotivations
  | InsightContentPsychologicalProfile;

export interface InsightProfileCategory {
  category: InsightCategory;
  content: InsightCategoryContent;
  version: number;
  source_count: number;
  last_updated: string | null;
}

export interface InsightShortTermItem {
  context_type: InsightContextType;
  content: Record<string, unknown>;
  expires_at: string;
}

export interface InsightRelationship {
  with: number;
  with_name: string | null;
  type: InsightRelationshipType;
  dynamics: string[];
  interaction_count: number;
}

export interface InsightFullProfile {
  profile_id: number;
  user_name: string | null;
  is_ready: boolean;
  profiles: InsightProfileCategory[];
  short_term: InsightShortTermItem[];
  relationships: InsightRelationship[];
}

// ─── Briefing types ───────────────────────────────────────────────────────────

export type BriefingState = 'empty' | 'waiting' | 'active';
export type MeetingState = 'scheduled' | 'waiting' | 'ready';
export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'paused'
  | 'review'
  | 'reopen'
  | 'done';

export interface TodayBriefing {
  state: BriefingState;
  date: string;
  events: TodayEvent[];
  carried_tasks: CarriedTask[];
  waiting_on_you: WaitingTask[];
  stale: StaleTask[];
  nudge: string | null;
}

export interface TodayEvent {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  participants_count: number;
  platform: string | null;
  meeting_url: string | null;
  meeting_state: MeetingState;
  summary: MeetingSummaryBrief | null;
  review: MeetingReviewBrief | null;
  tasks: MeetingTask[];
  total_tasks_count: number;
  done_tasks_count: number;
  updated_tasks: MeetingTask[];
  // Pre-existing tasks the meeting task review flagged as completed in this
  // meeting's transcript (progress='done'). Empty when no review exists yet.
  done_tasks: MeetingTask[];
  agenda_content: string | null;
}

export interface MeetingAttendee {
  name: string;
}

export interface RepeatedDiscussion {
  new_decision: string;
  previous_decision: string;
  previous_date: string;
  previous_meeting_title: string;
  previous_participants: string[];
}

export interface MeetingSummaryBrief {
  title: string;
  summary: string;
  key_points: string[];
  decisions: string[];
  attendees: MeetingAttendee[];
  repeated_discussions: RepeatedDiscussion[];
}

export interface MeetingReviewBrief {
  key_insight: string | null;
  suggestions: string[];
}

export interface MeetingTask {
  id: number;
  name: string;
  description: string | null;
  status: TaskStatus;
  assignee_name: string | null;
  assignee_id: number | null;
  due_date: string | null;
  is_overdue: boolean;
  is_epic: boolean;
  // Why the task was generated/updated on this meeting (shown in the dropdown).
  author_name: string | null;
  context: string | null;
}

export interface CarriedTask {
  id: number;
  name: string;
  status: TaskStatus;
  assignee_id: number | null;
  assignee_name: string | null;
  source_meeting_title: string;
  source_meeting_date: string;
  syncs_since_created: number;
}

export interface WaitingTask {
  id: number;
  name: string;
  description: string | null;
  age_days: number;
  source_meeting_title: string | null;
}

export interface StaleTask {
  id: number;
  name: string;
  assignee_name: string | null;
  description: string | null;
  syncs_since_created: number;
}
