-- 018_ai_intelligence.sql
-- Layer 1-4: AI Tutor conversations, voice feedback, async job queue.
-- Unblocks: S-01 (AI Tutor Chat), F-07 (Smart Feedback Dashboard),
--           M-04 (Satisfaction Analytics), A-04 (Absentee Agent)
-- Depends on: 017 (content_embeddings for RAG)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE call_status AS ENUM (
  'scheduled', 'in_progress', 'completed', 'no_answer', 'declined', 'failed'
);
CREATE TYPE ai_job_type AS ENUM (
  'content_generation', 'embedding', 'transcription', 'risk_scoring',
  'feedback_analysis', 'report_generation', 'absentee_call'
);
CREATE TYPE ai_job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'retry');

-- ============================================================
-- 2. tutor_conversations — AI Tutor chat sessions
-- ============================================================

CREATE TABLE tutor_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES profiles(id),  -- student
  course_id             UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  messages              JSONB         NOT NULL DEFAULT '[]',
    -- [{role: 'user'|'assistant', content, timestamp, tokens_used}]
  message_count         INT           NOT NULL DEFAULT 0,
  topics_discussed      TEXT[],                        -- AI-extracted topic list
  comprehension_scores  JSONB         DEFAULT '{}',    -- {topic_name: score}
  last_active_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, course_id)
);

CREATE INDEX idx_tutor_conversations_student ON tutor_conversations (user_id);
CREATE INDEX idx_tutor_conversations_course ON tutor_conversations (course_id);
CREATE INDEX idx_tutor_conversations_active ON tutor_conversations (last_active_at DESC)
  WHERE last_active_at IS NOT NULL;

-- ============================================================
-- 3. voice_feedback — weekly AI voice call feedback
-- ============================================================

CREATE TABLE voice_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES profiles(id),  -- student
  course_id       UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  call_sid        VARCHAR(64)   UNIQUE,               -- Twilio Call SID
  call_status     call_status   NOT NULL DEFAULT 'scheduled',
  transcript      TEXT,                                -- full conversation text
  duration_sec    SMALLINT,
  sentiment       JSONB,
    -- {overall: 4.2, scores: {quality: 4.4, pace: 3.2, content: 4.3, faculty: 4.5}}
  themes          TEXT[],                              -- ['too fast', 'need examples']
  raw_feedback    JSONB,                               -- [{question, answer}]
  week_number     SMALLINT,
  called_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_feedback_student ON voice_feedback (user_id);
CREATE INDEX idx_voice_feedback_course ON voice_feedback (course_id);
CREATE INDEX idx_voice_feedback_week ON voice_feedback (course_id, week_number);
CREATE INDEX idx_voice_feedback_status ON voice_feedback (call_status)
  WHERE call_status IN ('scheduled', 'in_progress');

-- GIN index for themes array search
CREATE INDEX idx_voice_feedback_themes ON voice_feedback USING GIN (themes)
  WHERE themes IS NOT NULL;

-- ============================================================
-- 4. ai_job_queue — async job queue for all AI tasks
-- ============================================================

CREATE TABLE ai_job_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        ai_job_type   NOT NULL,
  payload         JSONB         NOT NULL,              -- job-specific params
  priority        SMALLINT      NOT NULL DEFAULT 5,    -- 1=highest, 10=lowest
  status          ai_job_status NOT NULL DEFAULT 'queued',
  attempts        SMALLINT      NOT NULL DEFAULT 0,
  max_attempts    SMALLINT      NOT NULL DEFAULT 3,
  error_message   TEXT,
  result          JSONB,
  locked_by       VARCHAR(100),                        -- worker ID
  locked_at       TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_priority CHECK (priority BETWEEN 1 AND 10)
);

CREATE INDEX idx_ai_jobs_pending ON ai_job_queue (priority, scheduled_for)
  WHERE status = 'queued' AND scheduled_for <= now();
CREATE INDEX idx_ai_jobs_status ON ai_job_queue (status)
  WHERE status IN ('queued', 'processing');
CREATE INDEX idx_ai_jobs_locked ON ai_job_queue (locked_by, locked_at)
  WHERE locked_by IS NOT NULL;
CREATE INDEX idx_ai_jobs_type ON ai_job_queue (job_type, status);

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_job_queue ENABLE ROW LEVEL SECURITY;

-- Tutor conversations: students manage own, teachers view for own courses
CREATE POLICY "Students manage own tutor conversations"
  ON tutor_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers view tutor conversations for own courses"
  ON tutor_conversations FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

-- Voice feedback: students see own, teachers/admin see for own courses, mgmt sees all
CREATE POLICY "Students view own voice feedback"
  ON voice_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers view voice feedback for own courses"
  ON voice_feedback FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Admin and management view all voice feedback"
  ON voice_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

-- System inserts voice feedback (service role)
CREATE POLICY "Service role manages voice feedback"
  ON voice_feedback FOR ALL TO service_role USING (true);

-- AI job queue: service role only (workers poll this)
CREATE POLICY "Service role manages ai jobs"
  ON ai_job_queue FOR ALL TO service_role USING (true);

CREATE POLICY "Admins view ai jobs"
  ON ai_job_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
