// Academic structure: academic_years, programs, sections, timetable_slots

export type ProgramType = 'school_class' | 'ug' | 'pg' | 'diploma' | 'phd';
export type SlotType = 'lecture' | 'lab' | 'tutorial' | 'extra_class';

export interface AcademicYear {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  is_current: boolean;
  semesters: { name: string; start: string; end: string }[];
  holidays: { date: string; name: string }[];
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  code?: string;
  program_type: ProgramType;
  department?: string;
  duration_semesters: number;
  config?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Section {
  id: string;
  program_id: string;
  name: string;
  academic_year_id: string;
  max_students?: number;
  created_at: string;
}

export interface TimetableSlot {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
  slot_type: SlotType;
  is_ai_generated: boolean;
  effective_from: string;
  effective_until?: string;
  created_at: string;
}
