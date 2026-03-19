CREATE TABLE public.student_gate_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  mastery_pct INTEGER DEFAULT 0 CHECK (mastery_pct BETWEEN 0 AND 100),
  bloom_ceiling bloom_level DEFAULT 'remember',
  bloom_scores JSONB NOT NULL DEFAULT '{"remember":0,"understand":0,"apply":0,"analyze":0,"evaluate":0,"create":0}',
  velocity JSONB DEFAULT '[]',
  time_spent_minutes INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  is_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, gate_id)
);

CREATE TABLE public.question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  question_id UUID NOT NULL REFERENCES public.questions(id),
  gate_id UUID NOT NULL REFERENCES public.gates(id),
  answer_text TEXT,
  is_correct BOOLEAN,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  bloom_level_demonstrated bloom_level,
  time_spent_seconds INTEGER,
  ai_feedback TEXT,
  misconceptions JSONB,
  attempted_at TIMESTAMPTZ DEFAULT now()
);
