CREATE TYPE course_status AS ENUM ('draft', 'processing', 'review', 'active', 'archived');

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_level TEXT,
  section TEXT,
  academic_year TEXT,
  syllabus_text TEXT,
  syllabus_file_url TEXT,
  status course_status DEFAULT 'draft',
  llm_provider TEXT DEFAULT 'anthropic',
  llm_model TEXT DEFAULT 'claude-sonnet-4-20250514',
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  mastery_threshold INTEGER DEFAULT 75,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, student_id)
);
