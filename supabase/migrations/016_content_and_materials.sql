-- Migration 016: Content & Materials
-- Learning materials, pgvector embeddings for RAG, AI content generation jobs

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE content_item_type AS ENUM ('notes', 'mindmap', 'podcast', 'quiz_deck', 'flashcard_deck', 'transcript', 'summary');
CREATE TYPE content_source AS ENUM ('faculty_upload', 'ai_generated', 'lecture_transcript');
CREATE TYPE publish_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
CREATE TYPE content_gen_status AS ENUM ('queued', 'processing', 'completed', 'failed');
CREATE TYPE content_gen_target AS ENUM ('mindmap', 'podcast', 'quiz_deck', 'flashcard_deck', 'summary', 'embeddings');

-- All learning materials (faculty uploads + AI-generated)
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id),
  content_type content_item_type NOT NULL,
  title VARCHAR(300) NOT NULL,
  source content_source NOT NULL,
  parent_content_id UUID REFERENCES public.content_items(id),
  file_url TEXT,
  structured_data JSONB,
  topic_tags TEXT[],
  publish_status publish_status NOT NULL DEFAULT 'draft',
  scheduled_publish_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pgvector embeddings for RAG-based AI Tutor
CREATE TABLE public.content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chunk_index SMALLINT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI content generation task tracking
CREATE TABLE public.content_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  target_type content_gen_target NOT NULL,
  status content_gen_status NOT NULL DEFAULT 'queued',
  result_content_id UUID REFERENCES public.content_items(id),
  error_message TEXT,
  processing_ms INT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_content_items_course ON public.content_items(course_id);
CREATE INDEX idx_content_items_type ON public.content_items(content_type);
CREATE INDEX idx_content_items_source ON public.content_items(source);
CREATE INDEX idx_content_items_publish_status ON public.content_items(publish_status);
CREATE INDEX idx_content_items_created_by ON public.content_items(created_by_user_id);
CREATE INDEX idx_content_embeddings_content ON public.content_embeddings(content_id);
CREATE INDEX idx_content_embeddings_course ON public.content_embeddings(course_id);
CREATE INDEX idx_content_generation_jobs_source ON public.content_generation_jobs(source_content_id);
CREATE INDEX idx_content_generation_jobs_status ON public.content_generation_jobs(status);

-- HNSW index for vector similarity search
CREATE INDEX idx_content_embeddings_vector ON public.content_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Content items: teachers manage for their courses, students see published content
CREATE POLICY "Teachers manage content for own courses" ON public.content_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = content_items.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students view published content for enrolled courses" ON public.content_items
  FOR SELECT USING (
    publish_status = 'published' AND
    EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = content_items.course_id AND student_id = auth.uid())
  );

CREATE POLICY "Admins view all content" ON public.content_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Content embeddings: follow content_items access
CREATE POLICY "Teachers manage embeddings for own courses" ON public.content_embeddings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = content_embeddings.course_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students read embeddings for enrolled courses" ON public.content_embeddings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = content_embeddings.course_id AND student_id = auth.uid())
  );

-- Content generation jobs: teachers manage for their courses
CREATE POLICY "Teachers manage generation jobs" ON public.content_generation_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.id = content_generation_jobs.source_content_id AND c.teacher_id = auth.uid()
    )
  );
