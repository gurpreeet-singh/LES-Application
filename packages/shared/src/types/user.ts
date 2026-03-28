export type UserRole = 'student' | 'teacher' | 'admin' | 'management';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school?: string;
  class_section?: string;
  avatar_url?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  is_active: boolean;
  preferred_language?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'failed';

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  section_id?: string;
  status: EnrollmentStatus;
  final_grade?: string;
  final_score?: number;
  progress_pct?: number;
  enrolled_at: string;
}
