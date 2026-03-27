-- Migration 018: AI & Intelligence
-- AI Tutor conversations, voice feedback, AI recommendations, async job queue

CREATE TYPE voice_call_status AS ENUM ('scheduled', 'in_progress', 'completed', 'no_answer', 'declined', 'failed');
CREATE TYPE recommendation_category AS ENUM ('at_risk_student', 'low_satisfaction', 'missing_content', 'chronic_absence', 'grade_drop', 'faculty_improvement', 'curriculum_gap', 'engagement_drop');
CREATE TYPE recommendation_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE recommendation_status AS ENUM ('pending', 'acknowledged', 'acted_on', 'dismissed', 'auto_resolved');
CREATE TYPE ai_job_type AS ENUM ('content_generation', 'embedding', 'transcription', 'risk_scoring', 'feedback_analysis', 'report_generation', 'absentee_call');
CREATE TYPE ai_job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'retry');

-- AI Tutor chat sessions (one per student per course)
CREATE TABLE public.tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INT NOT NULL DEFAULT 0,
  topics_discussed TEXT[],
  comprehension_scores JSONB,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI voice agent weekly feedback calls with sentiment analysis
CREATE TABLE public.voice_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  call_sid VARCHAR(64) UNIQUE,
  call_status voice_call_status NOT NULL DEFAULT 'scheduled',
  transcript TEXT,
  duration_sec SMALLINT,
  sentiment JSONB,
  themes TEXT[],
  raw_feedback JSONB,
  week_number SMALLINT,
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-generated action items for all personas
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id),
  target_role user_role NOT NULL,
  category recommendation_category NOT NULL,
  severity recommendation_severity NOT NULL DEFAULT 'info',
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  status recommendation_status NOT NULL DEFAULT 'pending',
  acted_on_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Async job queue for all AI tasks
CREATE TABLE public.ai_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type ai_job_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  priority SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status ai_job_status NOT NULL DEFAULT 'queued',
  attempts SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 3,
  error_message TEXT,
  result JSONB,
  locked_by VARCHAR(100),
  locked_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tutor_conversations_student ON public.tutor_conversations(student_id);
CREATE INDEX idx_tutor_conversations_course ON public.tutor_conversations(course_id);
CREATE INDEX idx_tutor_conversations_last_active ON public.tutor_conversations(last_active_at);
CREATE INDEX idx_voice_feedback_student ON public.voice_feedback(student_id);
CREATE INDEX idx_voice_feedback_course ON public.voice_feedback(course_id);
CREATE INDEX idx_voice_feedback_status ON public.voice_feedback(call_status);
CREATE INDEX idx_ai_recommendations_target_user ON public.ai_recommendations(target_user_id);
CREATE INDEX idx_ai_recommendations_category ON public.ai_recommendations(category);
CREATE INDEX idx_ai_recommendations_severity ON public.ai_recommendations(severity);
CREATE INDEX idx_ai_recommendations_status ON public.ai_recommendations(status);
CREATE INDEX idx_ai_job_queue_status ON public.ai_job_queue(status);
CREATE INDEX idx_ai_job_queue_type ON public.ai_job_queue(job_type);
CREATE INDEX idx_ai_job_queue_priority_status ON public.ai_job_queue(priority, status);
CREATE INDEX idx_ai_job_queue_scheduled_for ON public.ai_job_queue(scheduled_for);

-- RLS
ALTER TABLE public.tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_job_queue ENABLE ROW LEVEL SECURITY;

-- Tutor conversations: students manage own, teachers view for their courses
CREATE POLICY "Students manage own tutor conversations" ON public.tutor_conversations
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view tutor conversations for own courses" ON public.tutor_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = tutor_conversations.course_id AND teacher_id = auth.uid())
  );

-- Voice feedback: students see own, teachers see for their courses
CREATE POLICY "Students view own voice feedback" ON public.voice_feedback
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view voice feedback for own courses" ON public.voice_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = voice_feedback.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins view all voice feedback" ON public.voice_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- AI recommendations: users see own recommendations
CREATE POLICY "Users view own recommendations" ON public.ai_recommendations
  FOR SELECT USING (target_user_id = auth.uid());

CREATE POLICY "Users update own recommendations" ON public.ai_recommendations
  FOR UPDATE USING (target_user_id = auth.uid());

CREATE POLICY "Admins view all recommendations" ON public.ai_recommendations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- AI job queue: service role only (no direct user access)
-- Jobs are managed by the backend service using supabaseAdmin
CREATE POLICY "Admins view job queue" ON public.ai_job_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
