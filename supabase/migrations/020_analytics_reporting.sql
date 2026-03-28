-- 020_analytics_reporting.sql
-- Layer 5: Pre-computed analytics tables. Populated by background jobs, not user actions.
-- Unblocks: S-06 (Dashboard trends/streaks), F-12 (Performance Insights risk),
--           M-03 (Faculty Performance), M-06 (Benchmarks), A-09 (Compliance Tracking)
-- Depends on: 015 (attendance data), 016 (submissions), 018 (voice_feedback)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE agg_period_type AS ENUM ('weekly', 'monthly', 'semester');

-- ============================================================
-- 2. student_progress_snapshots — weekly pre-computed progress
-- ============================================================

CREATE TABLE student_progress_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID          NOT NULL REFERENCES profiles(id),  -- student
  course_id                 UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  snapshot_date             DATE          NOT NULL,
  attendance_pct            DECIMAL(5,2),
  assessment_avg            DECIMAL(5,2),
  content_engagement_score  DECIMAL(3,2),              -- 0.00-1.00
  tutor_interaction_count   INT           DEFAULT 0,
  overall_progress_pct      DECIMAL(5,2),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, course_id, snapshot_date)
);

-- Partition-friendly index for time-series queries
CREATE INDEX idx_progress_snapshots_student ON student_progress_snapshots (user_id, snapshot_date DESC);
CREATE INDEX idx_progress_snapshots_course ON student_progress_snapshots (course_id, snapshot_date DESC);
CREATE INDEX idx_progress_snapshots_date ON student_progress_snapshots (snapshot_date);

-- ============================================================
-- 3. risk_scores — predictive at-risk identification (updated daily)
-- ============================================================

CREATE TABLE risk_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID          NOT NULL REFERENCES profiles(id),  -- student
  course_id                 UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  risk_level                risk_level    NOT NULL DEFAULT 'low',
  risk_score                DECIMAL(3,2)  NOT NULL DEFAULT 0.00,  -- 0.00-1.00
  risk_factors              JSONB         NOT NULL DEFAULT '[]',
    -- [{factor: 'attendance', weight: 0.3, value: 0.6, detail: '4 absences in 2 weeks'}]
  recommended_intervention  TEXT,
  last_computed_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, course_id),
  CONSTRAINT chk_risk_score CHECK (risk_score >= 0 AND risk_score <= 1)
);

CREATE INDEX idx_risk_scores_student ON risk_scores (user_id);
CREATE INDEX idx_risk_scores_course ON risk_scores (course_id);
CREATE INDEX idx_risk_scores_level ON risk_scores (risk_level)
  WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_risk_scores_computed ON risk_scores (last_computed_at);

-- ============================================================
-- 4. faculty_performance_agg — aggregated faculty metrics
-- ============================================================

CREATE TABLE faculty_performance_agg (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID          NOT NULL REFERENCES profiles(id),  -- faculty
  academic_year_id            UUID          REFERENCES academic_years(id),
  period_type                 agg_period_type NOT NULL,
  period_label                VARCHAR(20)   NOT NULL,  -- 'W12' or 'Mar-2026'
  avg_satisfaction_score      DECIMAL(3,2),             -- 0.00-5.00
  content_upload_rate         DECIMAL(5,2),             -- percentage
  assessment_completion_rate  DECIMAL(5,2),             -- percentage
  avg_student_score           DECIMAL(5,2),
  attendance_marking_rate     DECIMAL(5,2),             -- percentage
  courses_taught              SMALLINT,
  students_taught             INT,
  ai_development_notes        TEXT,                     -- AI-generated improvement suggestions
  computed_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, period_type, period_label)
);

CREATE INDEX idx_faculty_perf_user ON faculty_performance_agg (user_id);
CREATE INDEX idx_faculty_perf_period ON faculty_performance_agg (period_type, period_label);
CREATE INDEX idx_faculty_perf_year ON faculty_performance_agg (academic_year_id)
  WHERE academic_year_id IS NOT NULL;

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE student_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_performance_agg ENABLE ROW LEVEL SECURITY;

-- Progress snapshots: students see own, teachers see for own courses
CREATE POLICY "Students view own progress snapshots"
  ON student_progress_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers view progress snapshots for own courses"
  ON student_progress_snapshots FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Service role manages progress snapshots"
  ON student_progress_snapshots FOR ALL TO service_role USING (true);

-- Risk scores: teachers see for own courses, admin/management see all
CREATE POLICY "Teachers view risk scores for own courses"
  ON risk_scores FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Admin and management view all risk scores"
  ON risk_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

CREATE POLICY "Service role manages risk scores"
  ON risk_scores FOR ALL TO service_role USING (true);

-- Faculty performance: faculty sees own, management/admin sees all
CREATE POLICY "Faculty views own performance"
  ON faculty_performance_agg FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin and management view all faculty performance"
  ON faculty_performance_agg FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

CREATE POLICY "Service role manages faculty performance"
  ON faculty_performance_agg FOR ALL TO service_role USING (true);
