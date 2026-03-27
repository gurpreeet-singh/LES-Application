-- Migration 015: Sessions & Attendance
-- Individual class sessions and per-student attendance tracking

CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE absentee_call_outcome_type AS ENUM ('answered', 'no_answer', 'voicemail');

-- Individual class sessions (auto-created from timetable slots)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  timetable_slot_id UUID REFERENCES public.timetable_slots(id),
  session_date DATE NOT NULL,
  session_number SMALLINT,
  topic_covered VARCHAR(300),
  status session_status NOT NULL DEFAULT 'scheduled',
  notes_uploaded BOOLEAN NOT NULL DEFAULT false,
  recording_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-student, per-session attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by_user_id UUID REFERENCES public.profiles(id),
  marked_at TIMESTAMPTZ,
  absentee_call_made BOOLEAN NOT NULL DEFAULT false,
  absentee_call_outcome absentee_call_outcome_type,
  parent_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Indexes
CREATE INDEX idx_sessions_course ON public.sessions(course_id);
CREATE INDEX idx_sessions_date ON public.sessions(session_date);
CREATE INDEX idx_sessions_timetable_slot ON public.sessions(timetable_slot_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_attendance_session ON public.attendance(session_id);
CREATE INDEX idx_attendance_student ON public.attendance(student_id);
CREATE INDEX idx_attendance_status ON public.attendance(status);
CREATE INDEX idx_attendance_marked_by ON public.attendance(marked_by_user_id);

-- RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Sessions: course participants can view
CREATE POLICY "Course participants view sessions" ON public.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      LEFT JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.id = sessions.course_id
        AND (c.teacher_id = auth.uid() OR e.student_id = auth.uid())
    )
  );

CREATE POLICY "Teachers manage sessions for own courses" ON public.sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = sessions.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins manage all sessions" ON public.sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Attendance: students see own, teachers manage for their courses
CREATE POLICY "Students view own attendance" ON public.attendance
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers manage attendance for own courses" ON public.attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = attendance.session_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
