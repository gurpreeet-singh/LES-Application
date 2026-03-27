-- Migration 017: Assessment Engine
-- Assessments, assessment-question junction, submissions, report cards
-- Also extends existing questions table with IRT parameters

CREATE TYPE assessment_type AS ENUM ('quiz', 'midterm', 'final', 'assignment', 'adaptive_test', 'practice');
CREATE TYPE grading_status AS ENUM ('in_progress', 'auto_graded', 'ai_assisted', 'faculty_reviewed', 'finalized');
CREATE TYPE report_card_status AS ENUM ('draft', 'published');

-- Extend existing questions table with IRT parameters from Excel schema
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS discrimination DECIMAL(4,2);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS guessing DECIMAL(4,2);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(200);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_source VARCHAR(20) DEFAULT 'faculty_created'
  CHECK (question_source IN ('ai_generated', 'faculty_created'));
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS times_used INT NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS avg_score_pct DECIMAL(5,2);

-- Indexes for new question columns
CREATE INDEX IF NOT EXISTS idx_questions_topic_tag ON public.questions(topic_tag);
CREATE INDEX IF NOT EXISTS idx_questions_source ON public.questions(question_source);

-- Tests, quizzes, assignments, adaptive assessments
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  assessment_type assessment_type NOT NULL,
  is_adaptive BOOLEAN NOT NULL DEFAULT false,
  total_marks DECIMAL(6,2) NOT NULL,
  passing_marks DECIMAL(6,2),
  duration_minutes SMALLINT,
  max_attempts SMALLINT NOT NULL DEFAULT 1,
  question_count SMALLINT,
  config JSONB,
  weightage_pct DECIMAL(5,2),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: questions <-> assessments
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position SMALLINT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(assessment_id, question_id)
);

-- Student assessment attempts with answers, scores, AI feedback
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  attempt_number SMALLINT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '[]',
  score DECIMAL(6,2),
  percentage DECIMAL(5,2),
  ai_feedback JSONB,
  ability_estimate DECIMAL(4,2),
  grading_status grading_status NOT NULL DEFAULT 'in_progress',
  graded_by_user_id UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 360-degree Report Cards
CREATE TABLE public.report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  academic_year_id UUID REFERENCES public.academic_years(id),
  semester SMALLINT NOT NULL,
  course_grades JSONB NOT NULL DEFAULT '[]',
  gpa DECIMAL(4,2),
  cgpa DECIMAL(4,2),
  attendance_pct DECIMAL(5,2),
  skill_map JSONB,
  learning_velocity JSONB,
  ai_insights TEXT,
  status report_card_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_assessments_course ON public.assessments(course_id);
CREATE INDEX idx_assessments_type ON public.assessments(assessment_type);
CREATE INDEX idx_assessments_created_by ON public.assessments(created_by_user_id);
CREATE INDEX idx_assessment_questions_assessment ON public.assessment_questions(assessment_id);
CREATE INDEX idx_assessment_questions_question ON public.assessment_questions(question_id);
CREATE INDEX idx_submissions_assessment ON public.submissions(assessment_id);
CREATE INDEX idx_submissions_student ON public.submissions(student_id);
CREATE INDEX idx_submissions_grading_status ON public.submissions(grading_status);
CREATE INDEX idx_report_cards_student ON public.report_cards(student_id);
CREATE INDEX idx_report_cards_academic_year ON public.report_cards(academic_year_id);

-- RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- Assessments: teachers manage for own courses, students view for enrolled courses
CREATE POLICY "Teachers manage assessments for own courses" ON public.assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = assessments.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students view assessments for enrolled courses" ON public.assessments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = assessments.course_id AND student_id = auth.uid())
  );

CREATE POLICY "Admins view all assessments" ON public.assessments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Assessment questions: follow assessment access
CREATE POLICY "Teachers manage assessment questions" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assessment_questions.assessment_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view assessment questions" ON public.assessment_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE a.id = assessment_questions.assessment_id AND e.student_id = auth.uid()
    )
  );

-- Submissions: students manage own, teachers view for their courses
CREATE POLICY "Students manage own submissions" ON public.submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view submissions for own courses" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = submissions.assessment_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers grade submissions" ON public.submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = submissions.assessment_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Report cards: students see own, teachers see their students, admins see all
CREATE POLICY "Students view own report cards" ON public.report_cards
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admins manage report cards" ON public.report_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
