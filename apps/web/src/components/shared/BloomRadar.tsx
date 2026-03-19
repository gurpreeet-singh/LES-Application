interface Props {
  data: Record<string, number>;
  color?: string;
  size?: number;
}

const LABELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

export function BloomRadar({ data, color = '#2E75B6', size = 200 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

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

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
      {/* Data */}
      <polygon points={dataPath.replace(/[MLZ]/g, ' ').trim()} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color} className="hover:r-5 transition-all">
          <title>{keys[i]}: {data[keys[i]] || data[keys[i].toLowerCase()] || 0}%</title>
        </circle>
      ))}
      {/* Labels */}
      {LABELS.map((label, i) => {
        const [x, y] = pt(i, r + 18);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#6B7280">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
