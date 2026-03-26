export const MASTERY_THRESHOLD = 75;
export const AT_RISK_THRESHOLD = 60;
export const BLOOM_REACH_THRESHOLD = 50;

// Minimum score (%) a student needs at each Bloom level to be considered "ready" to advance.
// Descending: foundational levels require higher mastery, higher-order levels have lower bars.
export const BLOOM_LEVEL_THRESHOLDS: Record<string, number> = {
  remember: 80,
  understand: 75,
  apply: 65,
  analyze: 55,
  evaluate: 45,
  create: 35,
};

export const BLOOM_LEVEL_WEIGHTS = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
} as const;

export const GATE_COLORS = [
  { color: '#2E75B6', light: '#D5E8F0' },
  { color: '#1E7E34', light: '#D4EDDA' },
  { color: '#7C3AED', light: '#EDE9FE' },
  { color: '#B45309', light: '#FEF3C7' },
  { color: '#DC2626', light: '#FEE2E2' },
  { color: '#1B3A6B', light: '#DBEAFE' },
  { color: '#0E7490', light: '#CFFAFE' },
  { color: '#9333EA', light: '#F3E8FF' },
  { color: '#059669', light: '#D1FAE5' },
  { color: '#D97706', light: '#FEF3C7' },
] as const;
