-- 014_academic_structure.sql
-- Layer 1: Academic years, programs, sections, timetable slots.
-- Unblocks: A-01 (Institution Config), A-03 (Program Setup), A-06 (Timetable Edit),
--           S-02 (Enrollment), S-05 (Timetable), F-08 (AI Timetable)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE program_type AS ENUM ('school_class', 'ug', 'pg', 'diploma', 'phd');
CREATE TYPE slot_type AS ENUM ('lecture', 'lab', 'tutorial', 'extra_class');

-- ============================================================
-- 2. academic_years
-- ============================================================

CREATE TABLE academic_years (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           VARCHAR(20)   NOT NULL,          -- '2026-2027'
  starts_at       DATE          NOT NULL,
  ends_at         DATE          NOT NULL,
  is_current      BOOLEAN       NOT NULL DEFAULT false,
  semesters       JSONB         NOT NULL DEFAULT '[]', -- [{name, start, end}]
  holidays        JSONB         DEFAULT '[]',          -- [{date, name}]
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_academic_year_dates CHECK (ends_at > starts_at)
);

-- Only one current academic year at a time
CREATE UNIQUE INDEX idx_academic_years_current ON academic_years (is_current) WHERE is_current = true;

-- ============================================================
-- 3. programs
-- ============================================================

CREATE TABLE programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(200) NOT NULL,         -- 'B.Tech CSE' or 'Class 10'
  code                VARCHAR(20)  UNIQUE,           -- 'BTCSE' or 'CLS10'
  program_type        program_type NOT NULL,
  department          VARCHAR(100),                   -- NULL for schools
  duration_semesters  SMALLINT     NOT NULL,          -- 8 for B.Tech, 2 for school year
  config              JSONB        DEFAULT '{}',      -- Elective rules, credit requirements
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_name ON programs (name);
CREATE INDEX idx_programs_type ON programs (program_type);

-- ============================================================
-- 4. sections
-- ============================================================

CREATE TABLE sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name              VARCHAR(50)   NOT NULL,          -- 'Section A', 'Batch 2026-A'
  academic_year_id  UUID          NOT NULL REFERENCES academic_years(id),
  max_students      INT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (program_id, name, academic_year_id)
);

-- ============================================================
-- 5. timetable_slots — weekly recurring schedule
-- ============================================================

CREATE TABLE timetable_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  day_of_week       SMALLINT      NOT NULL,          -- 1=Mon, 7=Sun
  start_time        TIME          NOT NULL,
  end_time          TIME          NOT NULL,
  room              VARCHAR(50),
  slot_type         slot_type     NOT NULL DEFAULT 'lecture',
  is_ai_generated   BOOLEAN       NOT NULL DEFAULT false,
  effective_from    DATE          NOT NULL,
  effective_until   DATE,                             -- NULL = ongoing
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_slot_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_slot_times CHECK (end_time > start_time)
);

CREATE INDEX idx_timetable_slots_course ON timetable_slots (course_id);
CREATE INDEX idx_timetable_slots_day_time ON timetable_slots (day_of_week, start_time);
CREATE INDEX idx_timetable_slots_room ON timetable_slots (room, day_of_week, start_time)
  WHERE room IS NOT NULL;

-- ============================================================
-- 6. Add FK columns to courses and enrollments now that referenced tables exist
-- ============================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS program_id       UUID REFERENCES programs(id),
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

CREATE INDEX IF NOT EXISTS idx_courses_program ON courses (program_id) WHERE program_id IS NOT NULL;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id);

-- ============================================================
-- 7. RLS for new tables
-- ============================================================

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

-- Academic years, programs, sections: readable by all authenticated users
CREATE POLICY "Authenticated users can view academic years"
  ON academic_years FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view programs"
  ON programs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view sections"
  ON sections FOR SELECT TO authenticated USING (true);

-- Timetable slots: course participants can view
CREATE POLICY "Course participants can view timetable slots"
  ON timetable_slots FOR SELECT TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE teacher_id = auth.uid()
      UNION
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );

-- Admin/teacher can manage academic structure
CREATE POLICY "Admins can manage academic years"
  ON academic_years FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

CREATE POLICY "Admins can manage programs"
  ON programs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

CREATE POLICY "Admins can manage sections"
  ON sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

CREATE POLICY "Teachers manage timetable for own courses"
  ON timetable_slots FOR ALL TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()))
  WITH CHECK (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Admins manage all timetable slots"
  ON timetable_slots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
