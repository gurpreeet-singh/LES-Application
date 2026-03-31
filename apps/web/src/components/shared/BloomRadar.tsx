import { useState } from 'react';
import { BLOOM_LEVEL_THRESHOLDS } from '@leap/shared';

interface Props {
  data: Record<string, number>;
  color?: string;
  size?: number;
  thresholds?: Record<string, number>;
}

const LABELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

export function BloomRadar({ data, color = '#2E75B6', size = 200, thresholds }: Props) {
  const t = thresholds || BLOOM_LEVEL_THRESHOLDS;
  // Add padding so labels don't get clipped
  const pad = 35;
  const innerSize = size;
  const totalSize = innerSize + pad * 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const r = innerSize * 0.32;

  const pt = (i: number, radius: number) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const keys = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

  const dataPoints = keys.map((k, i) => {
    const val = (data[k] || data[k.toLowerCase()] || 0) / 100;
    return pt(i, r * val);
  });

  const thresholdPoints = keys.map((k, i) => {
    const val = (t[k.toLowerCase()] || 0) / 100;
    return pt(i, r * val);
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
  const thresholdPath = thresholdPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  // Check if all thresholds are met
  const allMet = keys.every(k => {
    const score = data[k] || data[k.toLowerCase()] || 0;
    const req = t[k.toLowerCase()] || 0;
    return score >= req;
  });

  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${totalSize} ${totalSize}`} onMouseLeave={() => setHover(null)}>
        {/* Grid */}
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={Array.from({ length: 6 }, (_, i) => pt(i, r * level)).map(p => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {Array.from({ length: 6 }, (_, i) => {
          const [x, y] = pt(i, r);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
        })}
        {/* Threshold polygon (dashed) */}
        <polygon
          points={thresholdPath.replace(/[MLZ]/g, ' ').trim()}
          fill="#EF4444"
          fillOpacity="0.06"
          stroke="#EF4444"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />
        {/* Data polygon */}
        <polygon
          points={dataPath.replace(/[MLZ]/g, ' ').trim()}
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="2"
        />
        {/* Data points — interactive */}
        {dataPoints.map((p, i) => {
          const score = data[keys[i]] || data[keys[i].toLowerCase()] || 0;
          const req = t[keys[i].toLowerCase()] || 0;
          const met = score >= req;
          const isHovered = hover?.idx === i;
          return (
            <circle
              key={i} cx={p[0]} cy={p[1]}
              r={isHovered ? 6 : 4}
              fill={met ? color : '#EF4444'}
              stroke="white" strokeWidth={isHovered ? 2 : 0}
              className="cursor-pointer transition-all"
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
              onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, idx: i })}
            />
          );
        })}
        {/* Labels with threshold */}
        {LABELS.map((label, i) => {
          const [x, y] = pt(i, r + 28);
          const req = t[label.toLowerCase()] || 0;
          const score = data[label] || data[label.toLowerCase()] || 0;
          return (
            <g key={i}>
              <text x={x} y={y - 5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill="#374151">
                {label}
              </text>
              <text x={x} y={y + 7} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#9CA3AF">
                {score}% / {req}%
              </text>
            </g>
          );
        })}
      </svg>
      {/* Tooltip */}
      {hover !== null && (() => {
        const score = data[keys[hover.idx]] || data[keys[hover.idx].toLowerCase()] || 0;
        const req = t[keys[hover.idx].toLowerCase()] || 0;
        return (
          <div className="fixed z-50 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[10px] pointer-events-none" style={{ left: hover.x + 10, top: hover.y - 36 }}>
            <span className="font-bold">{keys[hover.idx]}</span>: {score}% <span className="text-gray-400">(min: {req}%)</span> {score >= req ? '  ✓' : '  ✗'}
          </div>
        );
      })()}
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1 text-[9px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-current" style={{ color }} /> Score</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t border-dashed border-red-400" /> Threshold</span>
        <span className={`font-bold ${allMet ? 'text-green-600' : 'text-red-500'}`}>{allMet ? 'Ready to advance' : 'Not yet ready'}</span>
      </div>
    </div>
  );
}
