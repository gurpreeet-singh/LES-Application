-- 021_notifications.sql
-- Layer 1: Multi-channel notification system.
-- Unblocks: A-04 (Absentee Agent parent notifications), A-05 (Compliance reminders),
--           A-09 (Auto-reminders to lagging faculty)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE notification_channel AS ENUM ('in_app', 'whatsapp', 'email', 'push');
CREATE TYPE notification_category AS ENUM (
  'assessment', 'content', 'attendance', 'recording', 'recommendation', 'system'
);
CREATE TYPE delivery_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- ============================================================
-- 2. notifications
-- ============================================================

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES profiles(id),
  channel           notification_channel NOT NULL,
  category          notification_category NOT NULL,
  title             VARCHAR(300)  NOT NULL,
  body              TEXT          NOT NULL,
  action_url        TEXT,                              -- deep link into app
  external_id       VARCHAR(100),                      -- WhatsApp/email message ID
  delivery_status   delivery_status NOT NULL DEFAULT 'queued',
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id, delivery_status)
  WHERE delivery_status NOT IN ('read');
CREATE INDEX idx_notifications_delivery ON notifications (delivery_status)
  WHERE delivery_status IN ('queued', 'sent');
CREATE INDEX idx_notifications_category ON notifications (user_id, category);

-- ============================================================
-- 3. RLS policies
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see own notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can mark own as read
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role creates notifications
CREATE POLICY "Service role manages notifications"
  ON notifications FOR ALL TO service_role USING (true);
