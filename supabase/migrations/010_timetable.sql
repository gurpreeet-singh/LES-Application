-- Add timetable configuration to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_sessions INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER DEFAULT 40;

-- Session-lesson mapping table
CREATE TABLE IF NOT EXISTS session_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  lesson_portion TEXT NOT NULL DEFAULT 'full'
    CHECK (lesson_portion IN ('full', 'first-half', 'second-half', 'partial')),
  topic_summary TEXT,
  quiz_included BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, session_number, lesson_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_session_plan_course ON session_plan(course_id);
CREATE INDEX IF NOT EXISTS idx_session_plan_lesson ON session_plan(lesson_id);

-- RLS policies
ALTER TABLE session_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage session plans for their courses"
  ON session_plan
  FOR ALL
  USING (
    course_id IN (
      SELECT id FROM courses WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view session plans for enrolled courses"
  ON session_plan
  FOR SELECT
  USING (
    course_id IN (
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );
