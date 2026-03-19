CREATE TYPE suggestion_status AS ENUM ('pending', 'accepted', 'edited', 'rejected');
CREATE TYPE suggestion_type AS ENUM ('lesson_refine', 'gate_delay', 'peer_teaching', 'remediation', 'pace_change');

CREATE TABLE public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  gate_id UUID REFERENCES public.gates(id),
  type suggestion_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  tag TEXT,
  status suggestion_status DEFAULT 'pending',
  teacher_edit TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);
