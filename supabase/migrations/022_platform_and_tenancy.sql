-- Migration 022: Platform & Tenancy
-- Platform-level tables in separate 'platform' schema for security isolation
-- These tables are NOT exposed via Supabase REST API (anon key)
-- Access only via service role (backend/admin operations)

CREATE SCHEMA IF NOT EXISTS platform;

-- ENUMs (created in platform schema)
CREATE TYPE platform.institution_type AS ENUM ('school', 'college', 'university');
CREATE TYPE platform.plan_type AS ENUM ('free_trial', 'basic', 'standard', 'premium', 'enterprise');
CREATE TYPE platform.billing_cycle AS ENUM ('monthly', 'quarterly', 'annual');
CREATE TYPE platform.subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trial');
CREATE TYPE platform.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE platform.payment_status AS ENUM ('pending', 'captured', 'failed', 'refunded');
CREATE TYPE platform.payment_gateway AS ENUM ('razorpay', 'stripe', 'bank_transfer');
CREATE TYPE platform.discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE platform.platform_admin_role AS ENUM ('super_admin', 'support', 'billing');

-- Master registry of all tenant institutions
CREATE TABLE platform.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  institution_type platform.institution_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  schema_name VARCHAR(100) NOT NULL UNIQUE,
  onboarded_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-institution subscription plans and billing config
CREATE TABLE platform.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES platform.institutions(id) ON DELETE CASCADE,
  plan_type platform.plan_type NOT NULL,
  price_per_student_monthly DECIMAL(8,2) NOT NULL,
  max_students INT,
  billing_cycle platform.billing_cycle NOT NULL,
  starts_at DATE NOT NULL,
  expires_at DATE,
  status platform.subscription_status NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly/quarterly/annual invoices per institution
CREATE TABLE platform.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES platform.institutions(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES platform.subscriptions(id),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  active_students INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(12,2) NOT NULL,
  status platform.invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment transactions from gateway webhooks (Razorpay/Stripe)
CREATE TABLE platform.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES platform.invoices(id) ON DELETE CASCADE,
  gateway platform.payment_gateway NOT NULL,
  gateway_payment_id VARCHAR(100) UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status platform.payment_status NOT NULL DEFAULT 'pending',
  gateway_response JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Discount coupons for subscriptions
CREATE TABLE platform.coupon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  discount_type platform.discount_type NOT NULL,
  discount_value DECIMAL(8,2) NOT NULL,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LES internal team (separate from institutional users)
CREATE TABLE platform.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role platform.platform_admin_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_institutions_slug ON platform.institutions(slug);
CREATE INDEX idx_institutions_type ON platform.institutions(institution_type);
CREATE INDEX idx_institutions_active ON platform.institutions(is_active);
CREATE INDEX idx_subscriptions_institution ON platform.subscriptions(institution_id);
CREATE INDEX idx_subscriptions_status ON platform.subscriptions(status);
CREATE INDEX idx_invoices_institution ON platform.invoices(institution_id);
CREATE INDEX idx_invoices_subscription ON platform.invoices(subscription_id);
CREATE INDEX idx_invoices_status ON platform.invoices(status);
CREATE INDEX idx_invoices_due_date ON platform.invoices(due_date);
CREATE INDEX idx_payments_invoice ON platform.payments(invoice_id);
CREATE INDEX idx_payments_gateway_id ON platform.payments(gateway_payment_id);
CREATE INDEX idx_payments_status ON platform.payments(status);
CREATE INDEX idx_coupon_codes_code ON platform.coupon_codes(code);
CREATE INDEX idx_coupon_codes_active ON platform.coupon_codes(is_active);
CREATE INDEX idx_platform_admins_email ON platform.platform_admins(email);

-- RLS (platform tables accessed only via service role, but enable RLS as a safety net)
ALTER TABLE platform.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform tables are managed exclusively via service role (supabaseAdmin)
-- No anon/authenticated user policies — these tables are not exposed via REST API
-- The following policies allow platform_admins to query via authenticated sessions if needed

CREATE POLICY "Service role full access to institutions" ON platform.institutions
  FOR ALL USING (true);

CREATE POLICY "Service role full access to subscriptions" ON platform.subscriptions
  FOR ALL USING (true);

CREATE POLICY "Service role full access to invoices" ON platform.invoices
  FOR ALL USING (true);

CREATE POLICY "Service role full access to payments" ON platform.payments
  FOR ALL USING (true);

CREATE POLICY "Service role full access to coupon_codes" ON platform.coupon_codes
  FOR ALL USING (true);

CREATE POLICY "Service role full access to platform_admins" ON platform.platform_admins
  FOR ALL USING (true);
