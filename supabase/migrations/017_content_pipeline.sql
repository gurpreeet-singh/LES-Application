-- 017_content_pipeline.sql
-- Layer 1-2: Content items (notes, mindmaps, podcasts, flashcards), generation jobs, embeddings.
-- Unblocks: F-01 (Notes Upload), F-06 (Study Materials), F-08 (Transcript-based generation),
--           S-03 (Study Materials Browser), S-06 (Dashboard upcoming materials)
-- Depends on: 015 (sessions)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE content_type AS ENUM (
  'notes', 'mindmap', 'podcast', 'quiz_deck', 'flashcard_deck', 'transcript', 'summary'
);
CREATE TYPE content_source AS ENUM ('faculty_upload', 'ai_generated', 'lecture_transcript');
CREATE TYPE publish_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
CREATE TYPE generation_target AS ENUM (
  'mindmap', 'podcast', 'quiz_deck', 'flashcard_deck', 'summary', 'embeddings'
);
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed');

-- ============================================================
-- 2. content_items — all learning materials
-- ============================================================

CREATE TABLE content_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id          UUID          REFERENCES sessions(id),           -- per-session content
  content_type        content_type  NOT NULL,
  title               VARCHAR(300)  NOT NULL,
  source              content_source NOT NULL,
  parent_content_id   UUID          REFERENCES content_items(id),      -- AI content → source notes
  file_url            TEXT,                           -- S3 / Supabase Storage path
  structured_data     JSONB,                          -- flashcard pairs, mindmap nodes, quiz Qs
  topic_tags          TEXT[],                          -- mapped to syllabus topics
  publish_status      publish_status NOT NULL DEFAULT 'draft',
  scheduled_publish_at TIMESTAMPTZ,
  created_by_user_id  UUID          REFERENCES profiles(id),           -- faculty (NULL for AI)
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_items_course ON content_items (course_id);
CREATE INDEX idx_content_items_session ON content_items (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_content_items_type ON content_items (course_id, content_type);
CREATE INDEX idx_content_items_published ON content_items (course_id, publish_status)
  WHERE publish_status = 'published';
CREATE INDEX idx_content_items_parent ON content_items (parent_content_id)
  WHERE parent_content_id IS NOT NULL;
CREATE INDEX idx_content_items_scheduled ON content_items (scheduled_publish_at)
  WHERE publish_status = 'scheduled' AND scheduled_publish_at IS NOT NULL;

-- GIN index for topic_tags array search
CREATE INDEX idx_content_items_tags ON content_items USING GIN (topic_tags)
  WHERE topic_tags IS NOT NULL;

-- ============================================================
-- 3. content_generation_jobs — tracks AI content creation tasks
-- ============================================================

CREATE TABLE content_generation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id   UUID          NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  target_type         generation_target NOT NULL,
  status              job_status    NOT NULL DEFAULT 'queued',
  result_content_id   UUID          REFERENCES content_items(id),       -- output item
  error_message       TEXT,
  processing_ms       INT,
  queued_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_content_gen_jobs_source ON content_generation_jobs (source_content_id);
CREATE INDEX idx_content_gen_jobs_status ON content_generation_jobs (status)
  WHERE status IN ('queued', 'processing');

-- ============================================================
-- 4. content_embeddings — pgvector for RAG-based AI Tutor
-- ============================================================

-- PREREQUISITE: pgvector must be enabled BEFORE running this migration.
-- Enable it via Supabase Dashboard → Database → Extensions → search "vector" → Enable.
-- DO NOT use CREATE EXTENSION here — it requires superuser and will fail in migrations.
--
-- To verify it's enabled:  SELECT * FROM pg_extension WHERE extname = 'vector';

CREATE TABLE content_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      UUID          NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  course_id       UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,  -- denormalized
  chunk_index     SMALLINT      NOT NULL,             -- position within source
  chunk_text      TEXT          NOT NULL,              -- ~500 tokens, 50-token overlap
  embedding       vector(1536)  NOT NULL,              -- OpenAI ada-002 or equivalent
  chunk_metadata  JSONB         DEFAULT '{}',          -- {page, section, topic}
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_embeddings_content ON content_embeddings (content_id);
CREATE INDEX idx_content_embeddings_course ON content_embeddings (course_id);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_content_embeddings_vector ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

-- Content items: students see published for enrolled courses, teachers manage own
CREATE POLICY "Students view published content for enrolled courses"
  ON content_items FOR SELECT TO authenticated
  USING (
    publish_status = 'published'
    AND course_id IN (SELECT course_id FROM enrollments WHERE student_id = auth.uid())
  );

CREATE POLICY "Teachers manage content for own courses"
  ON content_items FOR ALL TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()))
  WITH CHECK (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));

CREATE POLICY "Admins view all content"
  ON content_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')));

-- Generation jobs: teachers manage for own content
CREATE POLICY "Teachers manage generation jobs for own content"
  ON content_generation_jobs FOR ALL TO authenticated
  USING (
    source_content_id IN (
      SELECT ci.id FROM content_items ci
      JOIN courses c ON ci.course_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Embeddings: accessible for RAG queries on enrolled courses
CREATE POLICY "Students query embeddings for enrolled courses"
  ON content_embeddings FOR SELECT TO authenticated
  USING (course_id IN (SELECT course_id FROM enrollments WHERE student_id = auth.uid()));

CREATE POLICY "Teachers manage embeddings for own courses"
  ON content_embeddings FOR ALL TO authenticated
  USING (course_id IN (SELECT id FROM courses WHERE teacher_id = auth.uid()));
