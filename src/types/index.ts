export type EventStatus = 'draft' | 'open' | 'closed';

export type AgeCategory = 'SMP' | 'SMA' | 'PRANIKAH';

export type Gender = 'Laki-laki' | 'Perempuan';

export interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  status: EventStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

export interface Attendance {
  id: string;
  event_id: string;
  name: string;
  village: string;
  group_name: string;
  age_category: AgeCategory;
  gender: Gender | null;
  checked_in_at: string;
  verification_token: string;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
}

export interface AttendanceWithEvent extends Attendance {
  events?: Pick<Event, 'name' | 'event_date' | 'start_time' | 'end_time'>;
}

export interface SubmitAttendanceResult {
  success: boolean;
  error?: string;
  already_exists?: boolean;
  token?: string;
  name?: string;
  village?: string;
  group_name?: string;
  age_category?: AgeCategory;
  gender?: Gender;
}

export interface VerifyAttendanceResult {
  valid: boolean;
  already_verified?: boolean;
  message?: string;
  data?: {
    token: string;
    name: string;
    village: string;
    group_name: string;
    age_category: AgeCategory;
    gender: Gender | null;
    checked_in_at: string;
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    verified_by: string | null;
    verified_by_name: string | null;
  };
}

export interface EventForAttendance {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: EventStatus;
}
