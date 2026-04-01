import { BLOOM_COLORS, BLOOM_LEVEL_THRESHOLDS } from '@leap/shared';
import type { BloomLevel } from '@leap/shared';

interface BloomBar {
  level: string;
  pct: number;
}

interface Props {
  data: BloomBar[];
  thresholds?: Record<string, number>;
  compact?: boolean;
}

export function BloomBarSVG({ data, thresholds, compact }: Props) {
  const t = thresholds || BLOOM_LEVEL_THRESHOLDS;

  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map(d => {
        const color = BLOOM_COLORS[d.level.toLowerCase() as BloomLevel] || '#6B7280';
        const threshold = t[d.level.toLowerCase()] ?? 0;
        const met = d.pct >= threshold;

        return (
          <div key={d.level} className="flex items-center gap-2">
            <span className={`${compact ? 'w-16 text-[9px]' : 'w-20 text-[11px]'} font-semibold text-gray-700 text-right shrink-0`}>
              {d.level}
            </span>
            <div className="flex-1 relative">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${d.pct}%`, background: color, opacity: 0.85 }}
                />
              </div>
              {/* Threshold marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5"
                style={{
                  left: `${threshold}%`,
                  background: met ? '#10B981' : '#EF4444',
                  borderStyle: met ? 'solid' : 'dashed',
                }}
              />
            </div>
            <span className={`${compact ? 'text-[9px] w-8' : 'text-[11px] w-10'} font-bold text-right shrink-0`} style={{ color }}>
              {d.pct}%
            </span>
            <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} shrink-0 ${met ? 'text-green-600' : 'text-red-500'}`}>
              {met ? '✓' : '✗'}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 text-[8px] text-gray-400 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-gray-300" /> Score</span>
        <span className="flex items-center gap-1"><span className="inline-block w-px h-3 bg-red-400" /> Threshold</span>
      </div>
    </div>
  );
}
