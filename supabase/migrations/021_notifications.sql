-- Migration 021: Notifications
-- Multi-channel notification system (in-app, WhatsApp, email, push)

CREATE TYPE notification_channel AS ENUM ('in_app', 'whatsapp', 'email', 'push');
CREATE TYPE notification_category AS ENUM ('assessment', 'content', 'attendance', 'recording', 'recommendation', 'system');
CREATE TYPE delivery_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- In-app, WhatsApp, email, push notifications for all users
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  category notification_category NOT NULL,
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  external_id VARCHAR(100),
  delivery_status delivery_status NOT NULL DEFAULT 'queued',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_channel ON public.notifications(channel);
CREATE INDEX idx_notifications_category ON public.notifications(category);
CREATE INDEX idx_notifications_status ON public.notifications(delivery_status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id)
  WHERE delivery_status != 'read';

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see and manage only their own notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- Admins can view all notifications
CREATE POLICY "Admins view all notifications" ON public.notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
