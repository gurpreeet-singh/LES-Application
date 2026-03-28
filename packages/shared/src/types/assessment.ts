// Assessments, submissions, report cards

import type { GradingStatus } from './progress';

export type AssessmentType = 'quiz' | 'midterm' | 'final' | 'assignment' | 'adaptive_test' | 'practice';
export type ReportCardStatus = 'draft' | 'published';

export interface Assessment {
  id: string;
  course_id: string;
  title: string;
  assessment_type: AssessmentType;
  is_adaptive: boolean;
  total_marks: number;
  passing_marks?: number;
  duration_minutes?: number;
  max_attempts: number;
  question_count?: number;
  config?: Record<string, unknown>;
  weightage_pct?: number;
  opens_at?: string;
  closes_at?: string;
  created_by_user_id?: string;
  created_at: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_id: string;
  position?: number;
  is_mandatory: boolean;
}

export interface SubmissionAnswer {
  question_id: string;
  answer: string;
  time_spent_sec?: number;
  is_correct?: boolean;
  marks_awarded?: number;
}

export interface Submission {
  id: string;
  assessment_id: string;
  user_id: string;
  attempt_number: number;
  started_at: string;
  submitted_at?: string;
  answers: SubmissionAnswer[];
  score?: number;
  percentage?: number;
  ai_feedback?: Record<string, unknown>;
  ability_estimate?: number;
  grading_status: GradingStatus;
  graded_by_user_id?: string;
  graded_at?: string;
  created_at: string;
}

export interface CourseGrade {
  course_id: string;
  grade: string;
  score: number;
  credits: number;
  topic_scores?: Record<string, number>;
}

export interface ReportCard {
  id: string;
  user_id: string;
  academic_year_id: string;
  semester: number;
  course_grades: CourseGrade[];
  gpa?: number;
  cgpa?: number;
  attendance_pct?: number;
  skill_map?: Record<string, number>;
  learning_velocity?: {
    improving: string[];
    declining: string[];
    stable: string[];
  };
  ai_insights?: string;
  status: ReportCardStatus;
  published_at?: string;
  created_at: string;
}
