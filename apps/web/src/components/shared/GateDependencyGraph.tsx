interface GateNode {
  id: string;
  gate_number: number;
  short_title: string;
  title: string;
  color: string;
  light_color: string;
  prerequisites?: { gate_id: string; gate_number: number; short_title: string; reason?: string }[];
  dependents?: { gate_id: string; gate_number: number; short_title: string }[];
}

interface Edge {
  gate_id: string;
  prerequisite_gate_id: string;
  reason?: string;
}

interface Props {
  gates: GateNode[];
  edges: Edge[];
  compact?: boolean;
}

export function GateDependencyGraph({ gates, edges, compact }: Props) {
  // Build layers: gates with no prerequisites first, then their dependents
  const layers: GateNode[][] = [];
  const placed = new Set<string>();

  // Layer 0: gates with no prerequisites
  const roots = gates.filter(g => !edges.some(e => e.gate_id === g.id));
  if (roots.length > 0) {
    layers.push(roots);
    roots.forEach(g => placed.add(g.id));
  }

  // Build subsequent layers
  let safety = 0;
  while (placed.size < gates.length && safety < 10) {
    const nextLayer = gates.filter(g => {
      if (placed.has(g.id)) return false;
      const prereqs = edges.filter(e => e.gate_id === g.id);
      return prereqs.every(e => placed.has(e.prerequisite_gate_id));
    });
    if (nextLayer.length === 0) break;
    layers.push(nextLayer);
    nextLayer.forEach(g => placed.add(g.id));
    safety++;
  }

  // Add any remaining unplaced gates
  const remaining = gates.filter(g => !placed.has(g.id));
  if (remaining.length > 0) layers.push(remaining);

  const nodeSize = compact ? 52 : 64;

  return (
    <div className="space-y-4">
      {/* Flow diagram */}
      <div className="flex items-start gap-8 overflow-x-auto pb-2">
        {layers.map((layer, li) => (
          <div key={li} className="flex flex-col items-center gap-3 min-w-fit">
            <span className="text-[9px] text-gray-400 uppercase font-bold">
              {li === 0 ? 'Foundation' : `Level ${li}`}
            </span>
            <div className="flex flex-col gap-2">
              {layer.map(g => {
                const prereqs = edges.filter(e => e.gate_id === g.id);
                return (
                  <div key={g.id} className="flex items-center gap-2">
                    <div
                      className="gate-node rounded-full flex flex-col items-center justify-center"
                      style={{
                        width: nodeSize,
                        height: nodeSize,
                        border: `3px solid ${g.color}`,
                        background: g.light_color,
                      }}
                    >
                      <span className="font-black text-[11px]" style={{ color: g.color }}>G{g.gate_number}</span>
                      <span className="text-[8px] text-gray-500 text-center leading-tight px-1">{g.short_title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {li < layers.length - 1 && (
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-300" />
                <span className="text-gray-300 text-[10px]">▼</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dependency list */}
      <div className="space-y-1.5">
        <h4 className="section-header text-[10px]">Prerequisites</h4>
        {edges.map((e, i) => {
          const from = gates.find(g => g.id === e.prerequisite_gate_id);
          const to = gates.find(g => g.id === e.gate_id);
          if (!from || !to) return null;
          return (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded-lg bg-gray-50">
              <span className="font-bold" style={{ color: from.color }}>G{from.gate_number}</span>
              <span className="text-gray-400">→</span>
              <span className="font-bold" style={{ color: to.color }}>G{to.gate_number}</span>
              {e.reason && <span className="text-gray-500 ml-1">— {e.reason}</span>}
            </div>
          );
        })}

        {/* Show parallel gates */}
        {(() => {
          const parallelPairs: string[] = [];
          for (let i = 0; i < gates.length; i++) {
            for (let j = i + 1; j < gates.length; j++) {
              const a = gates[i], b = gates[j];
              const aToB = edges.some(e => e.gate_id === b.id && e.prerequisite_gate_id === a.id);
              const bToA = edges.some(e => e.gate_id === a.id && e.prerequisite_gate_id === b.id);
              if (!aToB && !bToA) {
                parallelPairs.push(`G${a.gate_number} (${a.short_title}) & G${b.gate_number} (${b.short_title})`);
              }
            }
          }
          if (parallelPairs.length === 0) return null;
          return (
            <div className="mt-2">
              <h4 className="section-header text-[10px] mb-1">Parallel Tracks (can be taught simultaneously)</h4>
              {parallelPairs.slice(0, 4).map((p, i) => (
                <div key={i} className="text-[11px] text-green-700 py-0.5 px-2 rounded-lg bg-green-50">
                  ↔ {p}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
