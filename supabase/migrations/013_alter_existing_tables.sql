-- 013_alter_existing_tables.sql
-- Layer 0: Evolve existing tables to match target schema.
-- Adds missing columns, fixes type mismatches.
-- NOTE: ENUM additions are in 013a_enum_additions.sql (must run outside transaction).

-- ============================================================
-- 1. New ENUM types (these are CREATE TYPE, safe inside transactions)
-- ============================================================

CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped', 'failed');
CREATE TYPE question_source AS ENUM ('ai_generated', 'faculty_created');
CREATE TYPE grading_status AS ENUM ('in_progress', 'auto_graded', 'ai_assisted', 'faculty_reviewed', 'finalized');
CREATE TYPE course_kind AS ENUM ('core', 'elective', 'lab', 'project', 'audit');
CREATE TYPE recommendation_target AS ENUM ('student', 'faculty', 'admin', 'management');
CREATE TYPE recommendation_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE recommendation_category AS ENUM (
  'at_risk_student', 'low_satisfaction', 'missing_content', 'chronic_absence',
  'grade_drop', 'faculty_improvement', 'curriculum_gap', 'engagement_drop',
  'timetable_conflict'
);

-- ============================================================
-- 2. ALTER profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(15),
  ADD COLUMN IF NOT EXISTS metadata      JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles (phone) WHERE phone IS NOT NULL;

-- ============================================================
-- 3. ALTER courses (non-FK columns only; program_id, academic_year_id added in 014)
-- ============================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS code          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS semester      SMALLINT,
  ADD COLUMN IF NOT EXISTS course_kind   course_kind,
  ADD COLUMN IF NOT EXISTS credits       SMALLINT,
  ADD COLUMN IF NOT EXISTS config        JSONB         DEFAULT '{}';

COMMENT ON COLUMN courses.config IS 'Grading weightage, passing marks, attendance policy';

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses (code) WHERE code IS NOT NULL;

-- ============================================================
-- 4. ALTER enrollments (section_id FK added in 014)
-- ============================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS status        enrollment_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS final_grade   VARCHAR(5),
  ADD COLUMN IF NOT EXISTS final_score   DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS progress_pct  DECIMAL(5,2)  DEFAULT 0;

-- ============================================================
-- 5. ALTER questions
-- ============================================================

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS marks         DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS topic_tag     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS source        question_source,
  ADD COLUMN IF NOT EXISTS discrimination DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS guessing      DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS times_used    INT           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_score_pct DECIMAL(5,2);

COMMENT ON COLUMN questions.discrimination IS 'IRT a-parameter for adaptive assessments';
COMMENT ON COLUMN questions.guessing IS 'IRT c-parameter for adaptive assessments';

CREATE INDEX IF NOT EXISTS idx_questions_topic_tag ON questions (topic_tag) WHERE topic_tag IS NOT NULL;

-- ============================================================
-- 6. ALTER question_attempts — safe ai_feedback migration
-- ============================================================

ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS grading_status   grading_status NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS graded_by_user_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS attempt_number   SMALLINT      NOT NULL DEFAULT 1;

-- SAFE ai_feedback migration: keep old column, add new JSONB column alongside.
-- Old column (TEXT) stays as ai_feedback_legacy until verified.
-- New column (JSONB) is the one code should read/write going forward.
ALTER TABLE question_attempts RENAME COLUMN ai_feedback TO ai_feedback_legacy;
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS ai_feedback JSONB;

-- Backfill: wrap existing text values into JSONB
UPDATE question_attempts
SET ai_feedback = jsonb_build_object('text', ai_feedback_legacy)
WHERE ai_feedback_legacy IS NOT NULL
  AND ai_feedback_legacy != ''
  AND ai_feedback IS NULL;

-- DO NOT drop ai_feedback_legacy here.
-- Drop it in a future migration (013b) after verifying data integrity:
--   ALTER TABLE question_attempts DROP COLUMN ai_feedback_legacy;

CREATE INDEX IF NOT EXISTS idx_question_attempts_grading ON question_attempts (grading_status)
  WHERE grading_status != 'finalized';

-- ============================================================
-- 7. ALTER session_plan
-- ============================================================

ALTER TABLE session_plan
  ADD COLUMN IF NOT EXISTS session_date  DATE,
  ADD COLUMN IF NOT EXISTS start_time    TIME,
  ADD COLUMN IF NOT EXISTS end_time      TIME,
  ADD COLUMN IF NOT EXISTS room          VARCHAR(50);

-- ============================================================
-- 8. Evolve ai_suggestions — add multi-persona targeting columns
--    (ENUM value additions to suggestion_type are in 013a)
-- ============================================================

ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS target_role   recommendation_target DEFAULT 'faculty',
  ADD COLUMN IF NOT EXISTS severity      recommendation_severity DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS category      recommendation_category,
  ADD COLUMN IF NOT EXISTS suggested_action TEXT,
  ADD COLUMN IF NOT EXISTS context       JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_target ON ai_suggestions (target_role, severity)
  WHERE status = 'pending';
