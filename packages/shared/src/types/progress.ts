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

export type GradingStatus = 'in_progress' | 'auto_graded' | 'ai_assisted' | 'faculty_reviewed' | 'finalized';

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
  ai_feedback?: Record<string, unknown>;
  misconceptions?: string[];
  grading_status: GradingStatus;
  graded_by_user_id?: string;
  attempt_number: number;
  attempted_at: string;
}

export type StrategyProfile = 'surface' | 'deep' | 'competent' | 'struggling' | 'not_assessed';

export const STRATEGY_PROFILES: Record<StrategyProfile, { label: string; color: string; bg: string; description: string }> = {
  competent: { label: 'Competent', color: '#059669', bg: '#D1FAE5', description: 'Uses flexible strategies, self-monitors, adapts approach' },
  deep: { label: 'Deep Learner', color: '#2563EB', bg: '#DBEAFE', description: 'Seeks understanding, connects ideas, but developing metacognition' },
  surface: { label: 'Surface Learner', color: '#F59E0B', bg: '#FEF3C7', description: 'Relies on memorization, needs scaffolding for higher-order thinking' },
  struggling: { label: 'Struggling', color: '#DC2626', bg: '#FEE2E2', description: 'Low across multiple dimensions, needs immediate intervention' },
  not_assessed: { label: 'Not Assessed', color: '#9CA3AF', bg: '#F3F4F6', description: 'Diagnostic assessment not yet completed' },
};

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
  strategy_profile?: StrategyProfile;
  prior_knowledge_score?: number;
  bloom_ceiling?: string;
  engagement_score?: number;
  diagnostic_results?: any;
  diagnostic_completed_at?: string;
  updated_at: string;
}

export interface DiagnosticQuestion {
  id: number;
  section: 'prior_knowledge' | 'cognitive_readiness' | 'learning_strategy' | 'processing_preference';
  question_text: string;
  options: { text: string; value: string }[];
  bloom_level?: string;
}

export interface DiagnosticResult {
  answers: Record<number, string>;
  prior_knowledge_score: number;
  bloom_ceiling: string;
  strategy_profile: StrategyProfile;
  learning_dimensions: { logical: number; visual: number; reflective: number; kinesthetic: number; auditory: number };
}
