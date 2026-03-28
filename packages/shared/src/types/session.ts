// Sessions and attendance

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AbsenteeCallOutcome = 'answered' | 'no_answer' | 'voicemail';

export interface Session {
  id: string;
  course_id: string;
  timetable_slot_id?: string;
  session_date: string;
  session_number?: number;
  topic_covered?: string;
  status: SessionStatus;
  notes_uploaded: boolean;
  recording_available: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  user_id: string;
  status: AttendanceStatus;
  marked_by_user_id?: string;
  marked_at?: string;
  absentee_call_made: boolean;
  absentee_call_outcome?: AbsenteeCallOutcome;
  parent_notified: boolean;
  created_at: string;
}

export interface AttendanceStreak {
  id: string;
  user_id: string;
  course_id: string;
  current_absent_streak: number;
  longest_absent_streak: number;
  total_absences: number;
  total_sessions: number;
  last_present_date?: string;
  parent_escalation_count: number;
  updated_at: string;
}
