import { useState } from 'react';

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function VelocitySVG({ data, color = '#2E75B6', width = 400, height = 180 }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  if (data.length < 2) return (
    <div className="text-center py-6 text-[11px] text-gray-400">Not enough session data for velocity chart</div>
  );

  const pad = { top: 12, right: 15, bottom: 25, left: 32 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data, 100);
  const points = data.map((v, i) => ({
    x: pad.left + (i / (data.length - 1)) * w,
    y: pad.top + h - (v / maxVal) * h,
    val: v,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${pad.top + h} L${points[0].x},${pad.top + h} Z`;
  const gradId = `vel-${color.replace('#', '')}-${width}`;

  // Trend indicator
  const firstHalf = data.slice(0, Math.ceil(data.length / 2));
  const secondHalf = data.slice(Math.ceil(data.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trend = secondAvg - firstAvg;

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = pad.top + h - (v / maxVal) * h;
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#F3F4F6" strokeWidth="1" />
              <text x={pad.left - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#9CA3AF">{v}</text>
            </g>
          );
        })}
        {/* Area + Line */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Hover vertical guide */}
        {hover !== null && (
          <line x1={points[hover.idx].x} y1={pad.top} x2={points[hover.idx].x} y2={pad.top + h} stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
        )}
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={hover?.idx === i ? 6 : 4}
            fill={color} stroke="white" strokeWidth={hover?.idx === i ? 2.5 : 1.5}
            className="cursor-pointer transition-all"
            onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
            onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
          />
        ))}
        {/* X-axis session labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={height - 5} textAnchor="middle" fontSize="8" fill="#9CA3AF">
            {i + 1}
          </text>
        ))}
      </svg>
      {/* Tooltip */}
      {hover !== null && (
        <div className="fixed z-50 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[10px] pointer-events-none" style={{ left: hover.x + 10, top: hover.y - 32 }}>
          Session {hover.idx + 1}: <span className="font-bold">{data[hover.idx]}%</span>
        </div>
      )}
      {/* Trend indicator */}
      <div className="flex items-center justify-center gap-2 mt-1 text-[10px]">
        <span className={`font-bold ${trend > 2 ? 'text-green-600' : trend < -2 ? 'text-red-500' : 'text-gray-500'}`}>
          {trend > 2 ? '↑ Improving' : trend < -2 ? '↓ Declining' : '→ Stable'}
          {Math.abs(trend) > 0.5 && ` (${trend > 0 ? '+' : ''}${Math.round(trend)}%)`}
        </span>
      </div>
    </div>
  );
}
