interface GateNode {
  id: string;
  gate_number: number;
  short_title: string;
  title: string;
  color: string;
  light_color: string;
  period?: string;
  sub_concepts?: { id: string }[];
}

interface Props {
  gates: GateNode[];
  onSelectGate?: (gate: GateNode) => void;
  selectedGateId?: string;
  showMastery?: boolean;
  masteryData?: Record<string, number>;
  compact?: boolean;
}

export function KGCircleNodes({ gates, onSelectGate, selectedGateId, showMastery, masteryData, compact }: Props) {
  const nodeSize = compact ? 60 : 78;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-0 min-w-max">
        {gates.map((g, i) => {
          const isSelected = selectedGateId === g.id;
          const mastery = masteryData?.[g.id];

          return (
            <div key={g.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="gate-node rounded-full flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    width: nodeSize,
                    height: nodeSize,
                    border: `3px solid ${g.color}`,
                    background: g.light_color,
                    boxShadow: isSelected ? `0 0 0 4px ${g.color}30` : undefined,
                    transform: isSelected ? 'scale(1.08)' : undefined,
                  }}
                  onClick={() => onSelectGate?.(g)}
                >
                  {showMastery && mastery !== undefined ? (
                    <>
                      <span className="font-black text-base leading-none" style={{ color: g.color }}>{mastery}%</span>
                      <span className="font-bold text-[10px] mt-0.5" style={{ color: g.color }}>G{g.gate_number}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-[10px]" style={{ color: g.color }}>G{g.gate_number}</span>
                      <span className="font-black text-[11px] mt-0.5 text-center leading-tight px-1" style={{ color: g.color }}>
                        {g.sub_concepts?.length || 0}
                      </span>
                      <span className="text-[8px] text-gray-400">concepts</span>
                    </>
                  )}
                </div>
                <div className="text-center max-w-[80px]">
                  <p className="text-[11px] font-semibold text-gray-700 leading-tight">{g.short_title}</p>
                  {g.period && <p className="text-[9px] text-gray-400">{g.period}</p>}
                </div>
              </div>
              {i < gates.length - 1 && (
                <div className="flex items-center mx-1.5" style={{ paddingBottom: compact ? 30 : 40 }}>
                  <div className="w-5 h-0.5 bg-gray-300" />
                  <span className="text-gray-300 text-[10px]">&#9654;</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
