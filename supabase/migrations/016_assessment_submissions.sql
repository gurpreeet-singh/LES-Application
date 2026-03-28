-- 016_assessment_submissions.sql
-- Layer 1-3: Assessment wrapper, question junction, student submissions, report cards.
-- Unblocks: F-04 (Assessment Config), F-06 (Grading), S-01 (Assessment Responses),
--           S-04 (Report Card), S-08 (Adaptive Assessment), A-05 (Reports), A-07 (Pending Actions)
-- Depends on: 013 (grading_status ENUM), 014 (academic_years)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE assessment_type AS ENUM ('quiz', 'midterm', 'final', 'assignment', 'adaptive_test', 'practice');
CREATE TYPE report_card_status AS ENUM ('draft', 'published');

-- ============================================================
-- 2. assessments — test/quiz/exam wrapper
-- ============================================================

CREATE TABLE assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID           NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title               VARCHAR(300)   NOT NULL,
  assessment_type     assessment_type NOT NULL,
  is_adaptive         BOOLEAN        NOT NULL DEFAULT false,
  total_marks         DECIMAL(6,2)   NOT NULL,
  passing_marks       DECIMAL(6,2),
  duration_minutes    SMALLINT,                      -- NULL = no time limit
  max_attempts        SMALLINT       NOT NULL DEFAULT 1,
  question_count      SMALLINT,
  config              JSONB          DEFAULT '{}',   -- IRT params, randomization, proctoring
  weightage_pct       DECIMAL(5,2),                  -- % of final grade
  opens_at            TIMESTAMPTZ,
  closes_at           TIMESTAMPTZ,
  created_by_user_id  UUID           REFERENCES profiles(id),  -- faculty
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT chk_assessment_marks CHECK (total_marks > 0),
  CONSTRAINT chk_assessment_dates CHECK (closes_at IS NULL OR closes_at > opens_at)
);

CREATE INDEX idx_assessments_course ON assessments (course_id);
CREATE INDEX idx_assessments_type ON assessments (course_id, assessment_type);
CREATE INDEX idx_assessments_upcoming ON assessments (opens_at)
  WHERE opens_at IS NOT NULL AND opens_at > now();

-- ============================================================
-- 3. assessment_questions — junction table
-- ============================================================

CREATE TABLE assessment_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID          NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id     UUID          NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position        SMALLINT,                          -- NULL for adaptive (AI-selected order)
  is_mandatory    BOOLEAN       NOT NULL DEFAULT true,

  UNIQUE (assessment_id, question_id)
);

CREATE INDEX idx_assessment_questions_assessment ON assessment_questions (assessment_id);

-- ============================================================
-- 4. submissions — student attempt at an assessment
-- ============================================================

CREATE TABLE submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       UUID          NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES profiles(id),  -- student
  attempt_number      SMALLINT      NOT NULL DEFAULT 1,
  started_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,                    -- NULL if in progress
  answers             JSONB         NOT NULL DEFAULT '[]',
    -- [{question_id, answer, time_spent_sec, is_correct, marks_awarded}]
  score               DECIMAL(6,2),
  percentage          DECIMAL(5,2),
  ai_feedback         JSONB,                          -- per-submission AI summary
  ability_estimate    DECIMAL(4,2),                   -- IRT theta post-test
  grading_status      grading_status NOT NULL DEFAULT 'in_progress',
  graded_by_user_id   UUID          REFERENCES profiles(id),  -- faculty
  graded_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (assessment_id, user_id, attempt_number)
);

CREATE INDEX idx_submissions_assessment ON submissions (assessment_id);
CREATE INDEX idx_submissions_student ON submissions (user_id);
CREATE INDEX idx_submissions_grading ON submissions (grading_status)
  WHERE grading_status NOT IN ('finalized');
CREATE INDEX idx_submissions_course ON submissions (assessment_id, user_id);

-- ============================================================
-- 5. report_cards — 360-degree student report
-- ============================================================

CREATE TABLE report_cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES profiles(id),  -- student
  academic_year_id  UUID          NOT NULL REFERENCES academic_years(id),
  semester          SMALLINT      NOT NULL,
  course_grades     JSONB         NOT NULL DEFAULT '[]',
    -- [{course_id, grade, score, credits, topic_scores}]
  gpa               DECIMAL(4,2),                    -- NULL for schools
  cgpa              DECIMAL(4,2),
  attendance_pct    DECIMAL(5,2),
  skill_map         JSONB         DEFAULT '{}',
    -- {analytical_thinking: 0.8, problem_solving: 0.9, ...}
  learning_velocity JSONB         DEFAULT '{}',
    -- {improving: [topic_ids], declining: [topic_ids], stable: [topic_ids]}
  ai_insights       TEXT,                            -- AI narrative summary
  status            report_card_status NOT NULL DEFAULT 'draft',
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, academic_year_id, semester)
);

CREATE INDEX idx_report_cards_student ON report_cards (user_id);
CREATE INDEX idx_report_cards_year ON report_cards (academic_year_id, semester);

-- ============================================================
-- 6. RLS policies
-- ============================================================

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

-- Assessments: course participants can view, teachers manage
CREATE POLICY "Course participants can view assessments"
  ON assessments FOR SELECT TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE teacher_id = auth.uid()
      UNION
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers manage assessments for own courses"
  ON assessments FOR ALL TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()))
  WITH CHECK (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

-- Assessment questions: same as assessments
CREATE POLICY "Course participants can view assessment questions"
  ON assessment_questions FOR SELECT TO authenticated
  USING (
    assessment_id IN (SELECT id FROM assessments WHERE course_id IN (
      SELECT id FROM courses WHERE teacher_id = auth.uid()
      UNION
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    ))
  );

CREATE POLICY "Teachers manage assessment questions"
  ON assessment_questions FOR ALL TO authenticated
  USING (
    assessment_id IN (
      SELECT a.id FROM assessments a
      JOIN courses c ON a.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Submissions: students manage own, teachers view/grade for own courses
CREATE POLICY "Students manage own submissions"
  ON submissions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers view and grade submissions for own courses"
  ON submissions FOR ALL TO authenticated
  USING (
    assessment_id IN (
      SELECT a.id FROM assessments a
      JOIN courses c ON a.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Report cards: students see own, teachers see for own courses
CREATE POLICY "Students view own report cards"
  ON report_cards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and management manage report cards"
  ON report_cards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));
