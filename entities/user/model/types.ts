export interface MenuItemPreference {
  id: string;
  visible: boolean;
}

export interface UserMenuPreferences {
  primary: MenuItemPreference[];
  secondary: MenuItemPreference[];
}

export type Theme = 'light' | 'dark';

export interface UserPreferences {
  menu?: UserMenuPreferences;
  theme?: Theme;
}

export interface UserProps {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly email_verified_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly onboarding_completed?: boolean;
  readonly onboarding_last_step?: number;
  readonly preferences?: UserPreferences | null;
}

/** Minimal user shape returned by UserResource (id/name/email only) */
export interface UserBasicProps {
  id: number;
  name: string;
  email: string;
}

export interface ProfileIdentity {
  id: number;
  channel: string | null;
  channel_identifier: string;
  user_id: number | null;
}
