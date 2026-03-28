// Analytics snapshots, risk scores, faculty performance

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type AggPeriodType = 'weekly' | 'monthly' | 'semester';

export interface RiskFactor {
  factor: string;
  weight: number;
  value: number;
  detail?: string;
}

export interface StudentProgressSnapshot {
  id: string;
  user_id: string;
  course_id: string;
  snapshot_date: string;
  attendance_pct?: number;
  assessment_avg?: number;
  content_engagement_score?: number;
  tutor_interaction_count: number;
  overall_progress_pct?: number;
  created_at: string;
}

export interface RiskScore {
  id: string;
  user_id: string;
  course_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_factors: RiskFactor[];
  recommended_intervention?: string;
  last_computed_at: string;
  created_at: string;
}

export interface FacultyPerformanceAgg {
  id: string;
  user_id: string;
  academic_year_id?: string;
  period_type: AggPeriodType;
  period_label: string;
  avg_satisfaction_score?: number;
  content_upload_rate?: number;
  assessment_completion_rate?: number;
  avg_student_score?: number;
  attendance_marking_rate?: number;
  courses_taught?: number;
  students_taught?: number;
  ai_development_notes?: string;
  computed_at: string;
}
