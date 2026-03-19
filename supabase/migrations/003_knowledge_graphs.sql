CREATE TYPE gate_status AS ENUM ('draft', 'accepted', 'rejected');

CREATE TABLE public.gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  gate_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  color TEXT DEFAULT '#2E75B6',
  light_color TEXT DEFAULT '#D5E8F0',
  period TEXT,
  status gate_status DEFAULT 'draft',
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, gate_number)
);

CREATE TABLE public.gate_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  prerequisite_gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  UNIQUE(gate_id, prerequisite_gate_id),
  CHECK(gate_id != prerequisite_gate_id)
);

CREATE TABLE public.sub_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  bloom_levels JSONB,
  status gate_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.gate_bloom_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  remember INTEGER DEFAULT 90,
  understand INTEGER DEFAULT 80,
  apply INTEGER DEFAULT 75,
  analyze INTEGER DEFAULT 60,
  evaluate INTEGER DEFAULT 40,
  create_level INTEGER DEFAULT 30,
  UNIQUE(gate_id)
);
