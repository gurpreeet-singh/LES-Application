-- 015_sessions_attendance.sql
-- Layer 2-3: Actual dated session occurrences, attendance records, streak tracking.
-- Unblocks: F-03 (Attendance), F-05 (Session Status), A-04 (Absentee Agent),
--           S-04 (Attendance passive), S-05 (Timetable calendar dates)
-- Depends on: 014 (timetable_slots)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE absentee_call_outcome AS ENUM ('answered', 'no_answer', 'voicemail');

-- ============================================================
-- 2. sessions — individual class occurrences
-- ============================================================

CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  timetable_slot_id   UUID          REFERENCES timetable_slots(id),
  session_date        DATE          NOT NULL,
  session_number      SMALLINT,                     -- sequential within course
  topic_covered       VARCHAR(300),                  -- faculty-updated after class
  status              session_status NOT NULL DEFAULT 'scheduled',
  notes_uploaded      BOOLEAN       NOT NULL DEFAULT false,
  recording_available BOOLEAN       NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (course_id, session_number)
);

CREATE INDEX idx_sessions_course ON sessions (course_id);
CREATE INDEX idx_sessions_date ON sessions (session_date);
CREATE INDEX idx_sessions_course_date ON sessions (course_id, session_date);
CREATE INDEX idx_sessions_status ON sessions (status) WHERE status != 'completed';

-- ============================================================
-- 3. attendance — per-student, per-session
-- ============================================================

CREATE TABLE attendance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID          NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id               UUID          NOT NULL REFERENCES profiles(id),    -- student
  status                attendance_status NOT NULL,
  marked_by_user_id     UUID          REFERENCES profiles(id),             -- faculty
  marked_at             TIMESTAMPTZ,
  absentee_call_made    BOOLEAN       NOT NULL DEFAULT false,
  absentee_call_outcome absentee_call_outcome,
  parent_notified       BOOLEAN       NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_attendance_session ON attendance (session_id);
CREATE INDEX idx_attendance_student ON attendance (user_id);
CREATE INDEX idx_attendance_absent ON attendance (user_id, status) WHERE status = 'absent';

-- ============================================================
-- 4. attendance_streaks — consecutive absence tracking
-- ============================================================

CREATE TABLE attendance_streaks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL REFERENCES profiles(id),  -- student
  course_id               UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  current_absent_streak   SMALLINT      NOT NULL DEFAULT 0,
  longest_absent_streak   SMALLINT      NOT NULL DEFAULT 0,
  total_absences          SMALLINT      NOT NULL DEFAULT 0,
  total_sessions          SMALLINT      NOT NULL DEFAULT 0,
  last_present_date       DATE,
  parent_escalation_count SMALLINT      NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, course_id)
);

CREATE INDEX idx_attendance_streaks_student ON attendance_streaks (user_id);
CREATE INDEX idx_attendance_streaks_at_risk ON attendance_streaks (current_absent_streak)
  WHERE current_absent_streak >= 3;

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_streaks ENABLE ROW LEVEL SECURITY;

-- Sessions: course participants can view
CREATE POLICY "Course participants can view sessions"
  ON sessions FOR SELECT TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE teacher_id = auth.uid()
      UNION
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers manage sessions for own courses"
  ON sessions FOR ALL TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()))
  WITH CHECK (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Admins manage all sessions"
  ON sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Attendance: students see own, teachers manage for own courses
CREATE POLICY "Students view own attendance"
  ON attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers manage attendance for own courses"
  ON attendance FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN courses c ON s.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all attendance"
  ON attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Attendance streaks: same as attendance
CREATE POLICY "Students view own streaks"
  ON attendance_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers view streaks for own courses"
  ON attendance_streaks FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "System manages streaks"
  ON attendance_streaks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));
