-- Progressive session generation support
-- Allows courses to generate sessions iteratively (one at a time) instead of all at once

-- Add generation mode and session tracking to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS generation_mode TEXT DEFAULT 'batch';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS current_session_number INTEGER DEFAULT 0;

-- Add teacher feedback and generation context to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS session_scores_summary JSONB;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS generation_context JSONB;

-- Add structure_ready status for progressive mode courses
-- (course structure is ready but no lessons generated yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'structure_ready' AND enumtypid = 'course_status'::regtype) THEN
    ALTER TYPE course_status ADD VALUE 'structure_ready' BEFORE 'review';
  END IF;
END$$;
