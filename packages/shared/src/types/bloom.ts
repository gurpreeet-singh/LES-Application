export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface BloomScores {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
  evaluate: number;
  create: number;
}

export interface BloomTarget extends BloomScores {
  gate_id: string;
}

export const BLOOM_LEVELS: BloomLevel[] = [
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
];

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyze',
  evaluate: 'Evaluate',
  create: 'Create',
};

export const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: '#3B82F6',
  understand: '#10B981',
  apply: '#F59E0B',
  analyze: '#EF4444',
  evaluate: '#8B5CF6',
  create: '#EC4899',
};
