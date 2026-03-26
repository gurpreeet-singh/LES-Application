import { useState } from 'react';

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function VelocitySVG({ data, color = '#2E75B6', width = 240, height = 100 }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  if (data.length < 2) return null;

  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * w,
    y: pad + h - (v / 100) * h,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${pad + h} L${points[0].x},${pad + h} Z`;

  const gradId = `vel-${color.replace('#', '')}`;

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
        {hover !== null && (
          <line x1={points[hover.idx].x} y1={pad} x2={points[hover.idx].x} y2={pad + h} stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
        )}
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={hover?.idx === i ? 5 : 3}
            fill={color} stroke="white" strokeWidth={hover?.idx === i ? 2 : 0}
            className="cursor-pointer transition-all"
            onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
            onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="fixed z-50 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[10px] pointer-events-none"
          style={{ left: hover.x + 10, top: hover.y - 32 }}
        >
          Session {hover.idx + 1}: <span className="font-bold">{data[hover.idx]}%</span>
        </div>
      )}
    </div>
  );
}
