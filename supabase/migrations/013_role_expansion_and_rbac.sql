-- Migration 013: Role Expansion & RBAC
-- Adds 'management' role, expands profiles, creates RBAC and session tables

-- Add management role to existing user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'management';

-- Expand profiles table with Excel schema columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- RBAC permission matrix
CREATE TABLE public.roles_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(30) NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role, module, action)
);

-- Active login sessions for token-based auth
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_info JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_roles_permissions_role ON public.roles_permissions(role);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON public.user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- RLS
ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Roles permissions: all authenticated users can read, admins manage
CREATE POLICY "Anyone can read permissions" ON public.roles_permissions
  FOR SELECT USING (true);

CREATE POLICY "Admins manage permissions" ON public.roles_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- User sessions: users manage own sessions
CREATE POLICY "Users manage own sessions" ON public.user_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins view all sessions" ON public.user_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
