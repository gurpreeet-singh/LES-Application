-- Migration 014: Academic Structure
-- Academic years, programs, sections, timetable slots

CREATE TYPE program_type AS ENUM ('school_class', 'ug', 'pg', 'diploma', 'phd');
CREATE TYPE slot_type AS ENUM ('lecture', 'lab', 'tutorial', 'extra_class');

-- Academic calendar config
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(20) NOT NULL,
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  semesters JSONB NOT NULL DEFAULT '[]',
  holidays JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Degree programs (college) or class levels (school)
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) UNIQUE,
  program_type program_type NOT NULL,
  department VARCHAR(100),
  duration_semesters SMALLINT NOT NULL,
  config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subdivisions: 'Section A' (school), 'Batch 2026-A' (college)
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  max_students INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly recurring schedule slots
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50),
  slot_type slot_type NOT NULL DEFAULT 'lecture',
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_programs_name ON public.programs(name);
CREATE INDEX idx_sections_program ON public.sections(program_id);
CREATE INDEX idx_sections_academic_year ON public.sections(academic_year_id);
CREATE INDEX idx_timetable_slots_course ON public.timetable_slots(course_id);
CREATE INDEX idx_timetable_slots_day ON public.timetable_slots(day_of_week);

-- RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

-- Academic years: all authenticated users can read, admins manage
CREATE POLICY "Anyone can view academic years" ON public.academic_years
  FOR SELECT USING (true);

CREATE POLICY "Admins manage academic years" ON public.academic_years
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Programs: all authenticated users can read, admins manage
CREATE POLICY "Anyone can view programs" ON public.programs
  FOR SELECT USING (true);

CREATE POLICY "Admins manage programs" ON public.programs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Sections: all authenticated users can read, admins manage
CREATE POLICY "Anyone can view sections" ON public.sections
  FOR SELECT USING (true);

CREATE POLICY "Admins manage sections" ON public.sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Timetable slots: course participants can view, teachers + admins manage
CREATE POLICY "Course participants view timetable" ON public.timetable_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      LEFT JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.id = timetable_slots.course_id
        AND (c.teacher_id = auth.uid() OR e.student_id = auth.uid())
    )
  );

CREATE POLICY "Teachers manage timetable for own courses" ON public.timetable_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = timetable_slots.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins manage all timetable slots" ON public.timetable_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
