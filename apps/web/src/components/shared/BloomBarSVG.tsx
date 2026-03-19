import { BLOOM_COLORS } from '@les/shared';
import type { BloomLevel } from '@les/shared';

interface BloomBar {
  level: string;
  pct: number;
}

interface Props {
  data: BloomBar[];
  width?: number;
  height?: number;
}

export function BloomBarSVG({ data, width = 400, height = 180 }: Props) {
  const pad = { top: 10, right: 20, bottom: 30, left: 80 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const barH = Math.min(20, h / data.length - 4);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const y = pad.top + (i * h) / data.length + (h / data.length - barH) / 2;
        const barW = (d.pct / 100) * w;
        const color = BLOOM_COLORS[d.level.toLowerCase() as BloomLevel] || '#6B7280';

        return (
          <g key={d.level}>
            <text x={pad.left - 8} y={y + barH / 2} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#374151">
              {d.level}
            </text>
            <rect x={pad.left} y={y} width={w} height={barH} fill="#F3F4F6" rx="4" />
            <rect x={pad.left} y={y} width={barW} height={barH} fill={color} rx="4" opacity="0.85">
              <title>{d.level}: {d.pct}%</title>
            </rect>
            <text x={pad.left + barW + 6} y={y + barH / 2} dominantBaseline="middle" fontSize="11" fill={color} fontWeight="700">
              {d.pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
