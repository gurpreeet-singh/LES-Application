import { DIKW_COLORS, DIKW_LABELS, type DIKWLevel } from '@leap/shared';

interface Props {
  scores: Record<DIKWLevel, number>;
  size?: number;
}

const LEVELS: DIKWLevel[] = ['wisdom', 'knowledge', 'information', 'data']; // Top to bottom

export function DIKWPyramid({ scores, size = 200 }: Props) {
  const w = size;
  const h = size * 0.9;
  const layerH = h / 4;
  const pad = 8;

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`}>
        {LEVELS.map((level, i) => {
          const topWidth = (w * 0.3) + (i * (w * 0.7) / 4);
          const bottomWidth = (w * 0.3) + ((i + 1) * (w * 0.7) / 4);
          const y = i * layerH + pad;
          const colors = DIKW_COLORS[level];
          const score = scores[level] || 0;

          const x1 = (w - topWidth) / 2;
          const x2 = (w + topWidth) / 2;
          const x3 = (w + bottomWidth) / 2;
          const x4 = (w - bottomWidth) / 2;

          return (
            <g key={level}>
              {/* Layer background */}
              <polygon
                points={`${x1},${y} ${x2},${y} ${x3},${y + layerH - 2} ${x4},${y + layerH - 2}`}
                fill={colors.bg}
                stroke={colors.solid}
                strokeWidth="1.5"
                opacity="0.9"
              />
              {/* Score fill (proportional) */}
              {score > 0 && (
                <polygon
                  points={`${x1},${y} ${x1 + (x2 - x1) * (score / 100)},${y} ${x4 + (x3 - x4) * (score / 100)},${y + layerH - 2} ${x4},${y + layerH - 2}`}
                  fill={colors.solid}
                  opacity="0.3"
                />
              )}
              {/* Label */}
              <text
                x={w / 2}
                y={y + layerH / 2 - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="700"
                fill={colors.text}
              >
                {DIKW_LABELS[level]}
              </text>
              {/* Score */}
              <text
                x={w / 2}
                y={y + layerH / 2 + 9}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill={colors.text}
                opacity="0.7"
              >
                {score}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
