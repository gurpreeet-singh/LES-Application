-- Phase 2: Adaptive learning features
-- F4: Pre-class prep tracking
-- F6: Spaced repetition flashcard reviews

-- Pre-class prep tracking on student_gate_progress
ALTER TABLE public.student_gate_progress ADD COLUMN IF NOT EXISTS prep_score INTEGER;
ALTER TABLE public.student_gate_progress ADD COLUMN IF NOT EXISTS prep_completed_at TIMESTAMPTZ;

-- Spaced repetition flashcard reviews
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  question_id UUID NOT NULL REFERENCES public.questions(id),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  confidence INTEGER NOT NULL DEFAULT 1,
  review_count INTEGER NOT NULL DEFAULT 1,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_student_due ON flashcard_reviews(student_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_course ON flashcard_reviews(course_id);

-- Metacognitive prediction (Phase 3 prep — add now to avoid future migration)
ALTER TABLE public.question_attempts ADD COLUMN IF NOT EXISTS predicted_score INTEGER;
