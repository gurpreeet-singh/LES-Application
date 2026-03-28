import type { BloomLevel } from './bloom';
import type { LessonStatus } from './lesson';

export type QuestionType = 'mcq' | 'short_answer' | 'open_ended' | 'true_false';

export interface QuestionOption {
  text: string;
  is_correct: boolean;
}

export interface Distractor {
  answer: string;
  misconception: string;
}

export type QuestionSource = 'ai_generated' | 'faculty_created';

export interface Question {
  id: string;
  gate_id: string;
  sub_concept_id?: string;
  course_id: string;
  question_text: string;
  question_type: QuestionType;
  bloom_level: BloomLevel;
  difficulty?: number;
  options?: QuestionOption[];
  correct_answer?: string;
  rubric?: string;
  distractors?: Distractor[];
  explanation?: string;
  learning_style?: string;
  is_diagnostic: boolean;
  status: LessonStatus;
  marks?: number;
  topic_tag?: string;
  source?: QuestionSource;
  discrimination?: number;
  guessing?: number;
  times_used: number;
  avg_score_pct?: number;
  created_at: string;
}
