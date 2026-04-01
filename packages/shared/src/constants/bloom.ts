export const MASTERY_THRESHOLD = 75;
export const AT_RISK_THRESHOLD = 60;
export const BLOOM_REACH_THRESHOLD = 50;

// Mastery progression levels (Khan Academy-inspired)
export type MasteryLevel = 'not_started' | 'attempted' | 'familiar' | 'proficient' | 'mastered';

export const MASTERY_LEVELS: { level: MasteryLevel; label: string; minPct: number; color: string; bg: string }[] = [
  { level: 'mastered', label: 'Mastered', minPct: 80, color: '#059669', bg: '#D1FAE5' },
  { level: 'proficient', label: 'Proficient', minPct: 60, color: '#2563EB', bg: '#DBEAFE' },
  { level: 'familiar', label: 'Familiar', minPct: 30, color: '#F59E0B', bg: '#FEF3C7' },
  { level: 'attempted', label: 'Attempted', minPct: 1, color: '#9CA3AF', bg: '#F3F4F6' },
  { level: 'not_started', label: 'Not Started', minPct: 0, color: '#D1D5DB', bg: '#F9FAFB' },
];

export function getMasteryLevel(masteryPct: number): typeof MASTERY_LEVELS[0] {
  for (const level of MASTERY_LEVELS) {
    if (masteryPct >= level.minPct) return level;
  }
  return MASTERY_LEVELS[MASTERY_LEVELS.length - 1];
}

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

// ─── DIKW Framework ────────────────────────────────────────
export type DIKWLevel = 'data' | 'information' | 'knowledge' | 'wisdom';

export const DIKW_MAPPING: Record<string, DIKWLevel> = {
  remember: 'data',
  understand: 'information',
  apply: 'knowledge',
  analyze: 'knowledge',
  evaluate: 'wisdom',
  create: 'wisdom',
};

export const DIKW_LABELS: Record<DIKWLevel, string> = {
  data: 'Data',
  information: 'Information',
  knowledge: 'Knowledge',
  wisdom: 'Wisdom',
};

export const DIKW_COLORS: Record<DIKWLevel, { bg: string; text: string; solid: string }> = {
  data: { bg: '#DBEAFE', text: '#1E40AF', solid: '#3B82F6' },
  information: { bg: '#DCFCE7', text: '#166534', solid: '#10B981' },
  knowledge: { bg: '#FEF3C7', text: '#92400E', solid: '#F59E0B' },
  wisdom: { bg: '#EDE9FE', text: '#5B21B6', solid: '#8B5CF6' },
};

export const DIKW_COACHING_PROMPTS: Record<DIKWLevel, string[]> = {
  data: [
    'Can you repeat that in your own words?',
    'What are the key facts here?',
    'What is the definition of this term?',
  ],
  information: [
    'Why does this happen?',
    'How does this connect to what we learned before?',
    'Can you explain the relationship between these two ideas?',
  ],
  knowledge: [
    'What would happen if we changed this variable?',
    'Can you find another way to solve this?',
    'Where else could you apply this concept?',
  ],
  wisdom: [
    'Do you agree with this approach? Why or why not?',
    'What would you recommend, and what evidence supports it?',
    'Who benefits and who loses from this decision?',
    'Is there a situation where the opposite would be true?',
  ],
};

// Compute DIKW level from a lesson's bloom_levels array
// Uses PREDOMINANT level (most common mapping), not highest — avoids everything being "Wisdom"
export function getDIKWLevel(bloomLevels: string[]): DIKWLevel {
  if (!bloomLevels || bloomLevels.length === 0) return 'data';
  const counts: Record<DIKWLevel, number> = { data: 0, information: 0, knowledge: 0, wisdom: 0 };
  for (const bl of bloomLevels) {
    const mapped = DIKW_MAPPING[bl.toLowerCase()];
    if (mapped) counts[mapped]++;
  }
  // Return the level with the most bloom levels mapped to it
  const sorted = (Object.entries(counts) as [DIKWLevel, number][]).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

// Compute DIKW level based on lesson position in course (for display purposes)
// This gives a natural Data → Wisdom progression
export function getDIKWLevelByPosition(lessonNumber: number, totalLessons: number): DIKWLevel {
  if (totalLessons <= 0) return 'data';
  const ratio = lessonNumber / totalLessons;
  if (ratio <= 0.25) return 'data';
  if (ratio <= 0.5) return 'information';
  if (ratio <= 0.75) return 'knowledge';
  return 'wisdom';
}

// Compute DIKW scores from bloom_scores object
// IMPORTANT: Data should always be >= Information >= Knowledge >= Wisdom (pyramid shape)
// Because more students can recall facts than can create/evaluate
export function getDIKWFromBloomScores(bloomScores: Record<string, number>): Record<DIKWLevel, number> {
  const raw = {
    data: bloomScores.remember || 0,
    information: bloomScores.understand || 0,
    knowledge: Math.round(((bloomScores.apply || 0) + (bloomScores.analyze || 0)) / 2),
    wisdom: Math.round(((bloomScores.evaluate || 0) + (bloomScores.create || 0)) / 2),
  };
  // Enforce pyramid shape: each level should be <= the level below it
  // If not (due to scoring quirks), cap upper levels at the level below
  return {
    data: Math.max(raw.data, raw.information, raw.knowledge, raw.wisdom),
    information: Math.max(raw.information, raw.knowledge, raw.wisdom) > raw.data
      ? Math.min(raw.data, Math.max(raw.information, raw.knowledge))
      : raw.information,
    knowledge: Math.min(raw.knowledge, raw.information || raw.knowledge),
    wisdom: Math.min(raw.wisdom, raw.knowledge || raw.wisdom),
  };
}

// ─── Gate Colors ───────────────────────────────────────────
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
