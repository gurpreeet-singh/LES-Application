-- V2 rich slide content stored as JSONB on lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS slide_content JSONB;
