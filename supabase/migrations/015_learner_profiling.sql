-- Learner profiling system: diagnostic assessment + strategy classification

-- Add profiling columns to learning_profiles
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS strategy_profile TEXT DEFAULT 'not_assessed';
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS prior_knowledge_score INTEGER DEFAULT 0;
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS bloom_ceiling TEXT DEFAULT 'remember';
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS diagnostic_results JSONB;
ALTER TABLE public.learning_profiles ADD COLUMN IF NOT EXISTS diagnostic_completed_at TIMESTAMPTZ;
