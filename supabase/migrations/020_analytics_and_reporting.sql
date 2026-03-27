-- Migration 020: Analytics & Reporting
-- Student progress snapshots, risk scores, faculty performance, attendance streaks

CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE perf_period_type AS ENUM ('weekly', 'monthly', 'semester');

-- Weekly pre-computed student progress (partitioned by snapshot_date)
CREATE TABLE public.student_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  attendance_pct DECIMAL(5,2),
  assessment_avg DECIMAL(5,2),
  content_engagement_score DECIMAL(3,2),
  tutor_interaction_count INT,
  overall_progress_pct DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id, snapshot_date)
);

-- Predictive at-risk student identification (updated daily)
CREATE TABLE public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  risk_level risk_level NOT NULL DEFAULT 'low',
  risk_score DECIMAL(3,2) NOT NULL CHECK (risk_score BETWEEN 0.00 AND 1.00),
  risk_factors JSONB NOT NULL DEFAULT '[]',
  recommended_intervention TEXT,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aggregated faculty metrics (powers Management's Faculty Deep-Dive)
CREATE TABLE public.faculty_performance_agg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  period_type perf_period_type NOT NULL,
  period_label VARCHAR(20) NOT NULL,
  avg_satisfaction_score DECIMAL(3,2),
  content_upload_rate DECIMAL(5,2),
  assessment_completion_rate DECIMAL(5,2),
  avg_student_score DECIMAL(5,2),
  attendance_marking_rate DECIMAL(5,2),
  courses_taught SMALLINT,
  students_taught INT,
  ai_development_notes TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consecutive absence tracking for absentee agent escalation
CREATE TABLE public.attendance_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  current_absent_streak SMALLINT NOT NULL DEFAULT 0,
  longest_absent_streak SMALLINT NOT NULL DEFAULT 0,
  total_absences SMALLINT NOT NULL DEFAULT 0,
  total_sessions SMALLINT NOT NULL DEFAULT 0,
  last_present_date DATE,
  parent_escalation_count SMALLINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_progress_snapshots_student ON public.student_progress_snapshots(student_id);
CREATE INDEX idx_progress_snapshots_course ON public.student_progress_snapshots(course_id);
CREATE INDEX idx_progress_snapshots_date ON public.student_progress_snapshots(snapshot_date);
CREATE INDEX idx_risk_scores_student ON public.risk_scores(student_id);
CREATE INDEX idx_risk_scores_course ON public.risk_scores(course_id);
CREATE INDEX idx_risk_scores_level ON public.risk_scores(risk_level);
CREATE INDEX idx_faculty_perf_teacher ON public.faculty_performance_agg(teacher_id);
CREATE INDEX idx_faculty_perf_academic_year ON public.faculty_performance_agg(academic_year_id);
CREATE INDEX idx_faculty_perf_period ON public.faculty_performance_agg(period_type);
CREATE INDEX idx_attendance_streaks_student ON public.attendance_streaks(student_id);
CREATE INDEX idx_attendance_streaks_course ON public.attendance_streaks(course_id);
CREATE INDEX idx_attendance_streaks_absent ON public.attendance_streaks(current_absent_streak);

-- RLS
ALTER TABLE public.student_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_performance_agg ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_streaks ENABLE ROW LEVEL SECURITY;

-- Progress snapshots: students see own, teachers see for their courses
CREATE POLICY "Students view own progress snapshots" ON public.student_progress_snapshots
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view snapshots for own courses" ON public.student_progress_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = student_progress_snapshots.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins view all progress snapshots" ON public.student_progress_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Risk scores: students see own, teachers see for their courses, admins see all
CREATE POLICY "Students view own risk scores" ON public.risk_scores
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view risk scores for own courses" ON public.risk_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = risk_scores.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins view all risk scores" ON public.risk_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Faculty performance: teachers see own, admins see all
CREATE POLICY "Teachers view own performance" ON public.faculty_performance_agg
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Admins view all faculty performance" ON public.faculty_performance_agg
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Attendance streaks: students see own, teachers see for their courses
CREATE POLICY "Students view own attendance streaks" ON public.attendance_streaks
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view streaks for own courses" ON public.attendance_streaks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = attendance_streaks.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins view all attendance streaks" ON public.attendance_streaks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
