const BLOOM_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  Remember: { bg: '#DCFCE7', text: '#166534' },
  Understand: { bg: '#DBEAFE', text: '#1E40AF' },
  Apply: { bg: '#FEF3C7', text: '#92400E' },
  Analyze: { bg: '#EDE9FE', text: '#5B21B6' },
  Evaluate: { bg: '#FEE2E2', text: '#991B1B' },
  Create: { bg: '#FFEDD5', text: '#9A3412' },
};

interface Props {
  level: string;
  className?: string;
}

export function BloomBadge({ level, className = '' }: Props) {
  const color = BLOOM_BADGE_COLORS[level] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${className}`}
      style={{ background: color.bg, color: color.text }}
    >
      {level}
    </span>
  );
}
