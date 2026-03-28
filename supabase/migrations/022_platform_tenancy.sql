-- 022_platform_tenancy.sql
-- Layer 6: Multi-tenancy, billing, subscriptions, platform admin.
-- Unblocks: M-01 (Billing Config), M-05 (Revenue Dashboard), M-06 (Benchmarks),
--           A-01 (Institution Config — institution entity)
-- Independent of tenant-level tables. Can be built in any order.

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE institution_type AS ENUM ('school', 'college', 'university');
CREATE TYPE plan_type AS ENUM ('free_trial', 'basic', 'standard', 'premium', 'enterprise');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'annual');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trial');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_gateway AS ENUM ('razorpay', 'stripe', 'bank_transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'captured', 'failed', 'refunded');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE platform_admin_role AS ENUM ('super_admin', 'support', 'billing');

-- ============================================================
-- 2. institutions — master tenant registry
-- ============================================================

CREATE TABLE institutions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(300)  NOT NULL,
  slug              VARCHAR(100)  NOT NULL UNIQUE,     -- URL-safe, used as schema name suffix
  institution_type  institution_type NOT NULL,
  config            JSONB         NOT NULL DEFAULT '{}',
    -- {grading_system, timezone, academic_calendar, logo_url, contact}
  schema_name       VARCHAR(100)  NOT NULL UNIQUE,     -- 'inst_{slug}'
  onboarded_at      TIMESTAMPTZ,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_slug ON institutions (slug);
CREATE INDEX idx_institutions_active ON institutions (is_active) WHERE is_active = true;

-- ============================================================
-- 3. subscriptions
-- ============================================================

CREATE TABLE subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id            UUID          NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  plan_type                 plan_type     NOT NULL,
  price_per_student_monthly DECIMAL(8,2)  NOT NULL,
  max_students              INT,                       -- NULL = unlimited
  billing_cycle             billing_cycle NOT NULL,
  starts_at                 DATE          NOT NULL,
  expires_at                DATE,                      -- NULL = auto-renew
  status                    subscription_status NOT NULL DEFAULT 'trial',
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_institution ON subscriptions (institution_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status) WHERE status = 'active';

-- ============================================================
-- 4. invoices
-- ============================================================

CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID          NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subscription_id   UUID          NOT NULL REFERENCES subscriptions(id),
  invoice_number    VARCHAR(30)   NOT NULL UNIQUE,     -- LES-2026-00123
  period_start      DATE          NOT NULL,
  period_end        DATE          NOT NULL,
  active_students   INT           NOT NULL,            -- count during period
  amount            DECIMAL(12,2) NOT NULL,
  tax_amount        DECIMAL(10,2),                     -- GST
  total_amount      DECIMAL(12,2) NOT NULL,
  status            invoice_status NOT NULL DEFAULT 'draft',
  due_date          DATE          NOT NULL,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_invoice_amounts CHECK (total_amount >= amount)
);

CREATE INDEX idx_invoices_institution ON invoices (institution_id);
CREATE INDEX idx_invoices_status ON invoices (status) WHERE status IN ('sent', 'overdue');
CREATE INDEX idx_invoices_due ON invoices (due_date) WHERE status NOT IN ('paid', 'cancelled');

-- ============================================================
-- 5. payments
-- ============================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID          NOT NULL REFERENCES invoices(id),
  gateway             payment_gateway NOT NULL,
  gateway_payment_id  VARCHAR(100)  UNIQUE,            -- Razorpay/Stripe ID
  amount              DECIMAL(12,2) NOT NULL,
  currency            VARCHAR(3)    NOT NULL DEFAULT 'INR',
  status              payment_status NOT NULL DEFAULT 'pending',
  gateway_response    JSONB,                           -- raw webhook payload
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_invoice ON payments (invoice_id);
CREATE INDEX idx_payments_gateway ON payments (gateway, gateway_payment_id);
CREATE INDEX idx_payments_status ON payments (status) WHERE status = 'pending';

-- ============================================================
-- 6. coupon_codes
-- ============================================================

CREATE TABLE coupon_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(30)   NOT NULL UNIQUE,       -- EARLYBIRD2026
  discount_type   discount_type NOT NULL,
  discount_value  DECIMAL(8,2)  NOT NULL,              -- 20.00 for 20% or Rs 5000
  max_uses        INT,                                 -- NULL = unlimited
  used_count      INT           NOT NULL DEFAULT 0,
  valid_from      DATE          NOT NULL,
  valid_until     DATE,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT chk_coupon_usage CHECK (max_uses IS NULL OR used_count <= max_uses),
  CONSTRAINT chk_coupon_dates CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX idx_coupons_code ON coupon_codes (code);
CREATE INDEX idx_coupons_active ON coupon_codes (is_active, valid_from, valid_until)
  WHERE is_active = true;

-- ============================================================
-- 7. platform_admins — LES internal team
-- ============================================================

CREATE TABLE platform_admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255)  NOT NULL UNIQUE,
  full_name       VARCHAR(200)  NOT NULL,
  role            platform_admin_role NOT NULL,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. roles_permissions — RBAC matrix
-- ============================================================

CREATE TABLE roles_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            user_role     NOT NULL,
  module          VARCHAR(50)   NOT NULL,
    -- 'courses', 'assessments', 'content', 'analytics', 'billing', 'users'
  action          VARCHAR(30)   NOT NULL,
    -- 'read', 'create', 'update', 'delete', 'export'
  is_allowed      BOOLEAN       NOT NULL DEFAULT false,

  UNIQUE (role, module, action)
);

-- ============================================================
-- 9. user_sessions — active login sessions
-- ============================================================

CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255)  NOT NULL,              -- SHA-256 of JWT
  device_info     JSONB,                               -- {browser, os, device_type, ip}
  expires_at      TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions (token_hash);
CREATE INDEX idx_user_sessions_expiry ON user_sessions (expires_at)
  WHERE expires_at > now();

-- ============================================================
-- 10. RLS — platform tables are managed by service role / platform admins
-- ============================================================

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Management users can view billing data
CREATE POLICY "Management views institutions"
  ON institutions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'management'));

CREATE POLICY "Management views subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'management'));

CREATE POLICY "Management views invoices"
  ON invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'management'));

CREATE POLICY "Management views payments"
  ON payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'management'));

CREATE POLICY "Management views coupons"
  ON coupon_codes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'management'));

-- Service role manages all platform tables
CREATE POLICY "Service role manages institutions" ON institutions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages subscriptions" ON subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages invoices" ON invoices FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages payments" ON payments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages coupons" ON coupon_codes FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages platform admins" ON platform_admins FOR ALL TO service_role USING (true);
CREATE POLICY "Service role manages roles" ON roles_permissions FOR ALL TO service_role USING (true);

-- Users see own sessions
CREATE POLICY "Users view own sessions"
  ON user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages user sessions"
  ON user_sessions FOR ALL TO service_role USING (true);

-- Roles permissions readable by all authenticated users
CREATE POLICY "All users can read role permissions"
  ON roles_permissions FOR SELECT TO authenticated USING (true);
