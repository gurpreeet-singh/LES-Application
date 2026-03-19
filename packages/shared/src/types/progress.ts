import type { BloomLevel, BloomScores } from './bloom';

export interface StudentGateProgress {
  id: string;
  student_id: string;
  gate_id: string;
  course_id: string;
  mastery_pct: number;
  bloom_ceiling: BloomLevel;
  bloom_scores: BloomScores;
  velocity: number[];
  time_spent_minutes: number;
  last_attempt_at?: string;
  is_unlocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionAttempt {
  id: string;
  student_id: string;
  question_id: string;
  gate_id: string;
  answer_text?: string;
  is_correct?: boolean;
  score?: number;
  bloom_level_demonstrated?: BloomLevel;
  time_spent_seconds?: number;
  ai_feedback?: string;
  misconceptions?: string[];
  attempted_at: string;
}

export interface LearningProfile {
  id: string;
  student_id: string;
  course_id: string;
  logical: number;
  visual: number;
  reflective: number;
  kinesthetic: number;
  auditory: number;
  inferred_from_attempts: number;
  updated_at: string;
}
