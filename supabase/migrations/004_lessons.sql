CREATE TYPE lesson_status AS ENUM ('draft', 'accepted', 'edited', 'rejected');

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  key_idea TEXT,
  conceptual_breakthrough TEXT,
  bloom_levels TEXT[],
  examples JSONB,
  exercises JSONB,
  duration_minutes INTEGER DEFAULT 40,
  status lesson_status DEFAULT 'draft',
  teacher_notes TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.socratic_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  stage_title TEXT NOT NULL,
  duration_minutes INTEGER,
  teacher_prompt TEXT NOT NULL,
  expected_response TEXT,
  follow_up TEXT,
  status lesson_status DEFAULT 'draft',
  sort_order INTEGER NOT NULL
);
