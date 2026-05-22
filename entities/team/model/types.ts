export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'manager' | 'employee';
}

export interface TeamProps extends TeamCreateDTO {
  id: number;
  slug: string;
  employee_count: number;
  members?: TeamMember[];
}

export interface TeamCreateDTO {
  name: string;
}

export interface TeamAddMemberDTO {
  email: string;
}

export type TeamActionType = 'add-member' | 'delete';

export interface TeamUserRecord {
  id: number; // TeamUser pivot ID — used for kick
  user: {
    id: number;
    name: string;
    email: string;
  };
  teams: {
    id: number;
    name: string;
    slug: string;
    employee_count: number;
  };
}

export interface TeamInvite {
  id: number;
  email: string;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
}
