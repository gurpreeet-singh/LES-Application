CREATE TABLE public.learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  logical INTEGER DEFAULT 50 CHECK (logical BETWEEN 0 AND 100),
  visual INTEGER DEFAULT 50 CHECK (visual BETWEEN 0 AND 100),
  reflective INTEGER DEFAULT 50 CHECK (reflective BETWEEN 0 AND 100),
  kinesthetic INTEGER DEFAULT 50 CHECK (kinesthetic BETWEEN 0 AND 100),
  auditory INTEGER DEFAULT 50 CHECK (auditory BETWEEN 0 AND 100),
  inferred_from_attempts INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, course_id)
);
