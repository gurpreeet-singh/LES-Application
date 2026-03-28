export interface HeatmapCell {
  student_id: string;
  student_name: string;
  gate_id: string;
  gate_number: number;
  mastery_pct: number;
}

export interface HeatmapData {
  students: {
    id: string;
    name: string;
    gate_scores: { gate_id: string; gate_number: number; mastery_pct: number }[];
    average: number;
  }[];
  gates: { id: string; gate_number: number; title: string; short_title: string; color: string; avg: number }[];
}

export interface BloomDistribution {
  gate_id: string;
  levels: { level: string; pct: number }[];
  gap_analysis: string;
}

export interface DependencyRisk {
  from_gate: { id: string; number: number; title: string };
  to_gate: { id: string; number: number; title: string };
  affected_students: { id: string; name: string; from_mastery: number; to_mastery: number }[];
  severity: 'critical' | 'high' | 'low';
  reason: string;
}

export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'rejected';
export type SuggestionType = 'lesson_refine' | 'gate_delay' | 'peer_teaching' | 'remediation' | 'pace_change' | 'topic_shift' | 'socratic_update' | 'quiz_adjust' | 'add_remediation' | 'bloom_focus';
export type RecommendationTarget = 'student' | 'faculty' | 'admin' | 'management';
export type RecommendationSeverity = 'info' | 'warning' | 'critical';
export type RecommendationCategory = 'at_risk_student' | 'low_satisfaction' | 'missing_content' | 'chronic_absence' | 'grade_drop' | 'faculty_improvement' | 'curriculum_gap' | 'engagement_drop' | 'timetable_conflict';

export interface AISuggestion {
  id: string;
  course_id: string;
  gate_id?: string;
  type: SuggestionType;
  title: string;
  description: string;
  rationale?: string;
  tag?: string;
  status: SuggestionStatus;
  teacher_edit?: string;
  target_role: RecommendationTarget;
  severity: RecommendationSeverity;
  category?: RecommendationCategory;
  suggested_action?: string;
  context?: Record<string, unknown>;
  expires_at?: string;
  generated_at: string;
  resolved_at?: string;
}
