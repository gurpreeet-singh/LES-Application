export type CourseStatus = 'draft' | 'processing' | 'structure_ready' | 'review' | 'active' | 'archived';
export type GenerationMode = 'batch' | 'progressive';
export type LLMProvider = 'anthropic' | 'openai';

export interface Course {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  class_level?: string;
  section?: string;
  academic_year?: string;
  syllabus_text?: string;
  syllabus_file_url?: string;
  status: CourseStatus;
  llm_provider: LLMProvider;
  llm_model: string;
  mastery_threshold: number;
  total_sessions?: number;
  session_duration_minutes?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  generation_mode?: GenerationMode;
  current_session_number?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCourseInput {
  title: string;
  subject: string;
  class_level?: string;
  section?: string;
  academic_year?: string;
}

export interface UploadSyllabusInput {
  syllabus_text?: string;
  llm_provider?: LLMProvider;
  llm_model?: string;
  total_sessions?: number;
  session_duration_minutes?: number;
}

export type SessionPortion = 'full' | 'first-half' | 'second-half' | 'partial';

export interface SessionPlan {
  id: string;
  course_id: string;
  session_number: number;
  lesson_id: string;
  lesson_portion: SessionPortion;
  topic_summary: string;
  quiz_included: boolean;
  notes?: string;
  created_at: string;
}
