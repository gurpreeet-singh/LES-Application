import { getDIKWLevel, DIKW_COLORS, DIKW_LABELS, type DIKWLevel } from '@leap/shared';

export function DIKWBadge({ level, size = 'sm' }: { level: DIKWLevel; size?: 'sm' | 'md' }) {
  const colors = DIKW_COLORS[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${size === 'md' ? 'px-3 py-1 text-[11px]' : 'px-2 py-0.5 text-[9px]'}`}
      style={{ background: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.solid }} />
      {DIKW_LABELS[level]}
    </span>
  );
}

export function DIKWBadgeFromBloom({ bloomLevels, size }: { bloomLevels: string[]; size?: 'sm' | 'md' }) {
  const level = getDIKWLevel(bloomLevels);
  return <DIKWBadge level={level} size={size} />;
}
