-- Migration 012: Principal Dashboard Support
-- Adds principal_actions table for tracking interventions

-- Principal action types
CREATE TYPE principal_action_type AS ENUM (
  'nudge_teacher',
  'schedule_meeting',
  'assign_mentor',
  'flag_observation',
  'notify_parent',
  'refer_counselor',
  'acknowledge_alert',
  'schedule_training',
  'request_workshop'
);

-- Tracks every action the principal takes from the dashboard
CREATE TABLE IF NOT EXISTS public.principal_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id    UUID NOT NULL REFERENCES public.profiles(id),
  action_type     principal_action_type NOT NULL,
  target_teacher_id UUID REFERENCES public.profiles(id),
  target_student_id UUID REFERENCES public.profiles(id),
  target_course_id  UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_principal_actions_principal ON public.principal_actions(principal_id);
CREATE INDEX idx_principal_actions_teacher ON public.principal_actions(target_teacher_id);
CREATE INDEX idx_principal_actions_created ON public.principal_actions(created_at DESC);

-- RLS
ALTER TABLE public.principal_actions ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own actions
CREATE POLICY "Admins manage own actions"
  ON public.principal_actions FOR ALL
  USING (principal_id = auth.uid());
