// Platform & tenancy: institutions, subscriptions, invoices, payments, coupons

export type InstitutionType = 'school' | 'college' | 'university';
export type PlanType = 'free_trial' | 'basic' | 'standard' | 'premium' | 'enterprise';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trial';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type PaymentGateway = 'razorpay' | 'stripe' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'captured' | 'failed' | 'refunded';
export type DiscountType = 'percentage' | 'fixed_amount';
export type PlatformAdminRole = 'super_admin' | 'support' | 'billing';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  institution_type: InstitutionType;
  config: Record<string, unknown>;
  schema_name: string;
  onboarded_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  institution_id: string;
  plan_type: PlanType;
  price_per_student_monthly: number;
  max_students?: number;
  billing_cycle: BillingCycle;
  starts_at: string;
  expires_at?: string;
  status: SubscriptionStatus;
  created_at: string;
}

export interface Invoice {
  id: string;
  institution_id: string;
  subscription_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  active_students: number;
  amount: number;
  tax_amount?: number;
  total_amount: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  gateway: PaymentGateway;
  gateway_payment_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway_response?: Record<string, unknown>;
  paid_at?: string;
  created_at: string;
}

export interface CouponCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses?: number;
  used_count: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string;
  role: PlatformAdminRole;
  is_active: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role: string;
  module: string;
  action: string;
  is_allowed: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  token_hash: string;
  device_info?: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}
