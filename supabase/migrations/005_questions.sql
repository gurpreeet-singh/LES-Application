CREATE TYPE question_type AS ENUM ('mcq', 'short_answer', 'open_ended', 'true_false');
CREATE TYPE bloom_level AS ENUM ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  sub_concept_id UUID REFERENCES public.sub_concepts(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL,
  bloom_level bloom_level NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  options JSONB,
  correct_answer TEXT,
  rubric TEXT,
  distractors JSONB,
  explanation TEXT,
  learning_style TEXT,
  is_diagnostic BOOLEAN DEFAULT false,
  status lesson_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);
