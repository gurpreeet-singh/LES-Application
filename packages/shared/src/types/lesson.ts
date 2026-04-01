export type LessonStatus = 'draft' | 'accepted' | 'edited' | 'rejected';

export interface Lesson {
  id: string;
  gate_id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  objective: string;
  key_idea?: string;
  conceptual_breakthrough?: string;
  bloom_levels: string[];
  dikw_level?: 'data' | 'information' | 'knowledge' | 'wisdom';
  examples?: LessonExample[];
  exercises?: LessonExercise[];
  duration_minutes: number;
  status: LessonStatus;
  teacher_notes?: string;
  teacher_feedback?: string;
  session_scores_summary?: any;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Populated via joins
  socratic_scripts?: SocraticScript[];
}

export interface LessonExample {
  text: string;
  type?: string;
}

export interface LessonExercise {
  text: string;
  difficulty?: number;
  bloom_level?: string;
}

export interface SocraticScript {
  id: string;
  lesson_id: string;
  stage_number: number;
  stage_title: string;
  duration_minutes?: number;
  teacher_prompt: string;
  expected_response?: string;
  follow_up?: string;
  status: LessonStatus;
  sort_order: number;
}
