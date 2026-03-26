import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface GateNode {
  id: string; course_id: string; gate_number: number; title: string; short_title: string;
  color: string; avg_mastery: number; student_count: number;
}

interface Edge { gate_id: string; prerequisite_gate_id: string }

interface Bottleneck {
  from_gate: string; from_course: string; to_gate: string; to_course: string;
  blocked_students: number; total_students: number;
}

interface StudentSummary {
  id: string; name: string; overall_mastery: number; at_risk: boolean;
  courses: { course_id: string; course_title: string; avg_mastery: number }[];
}

interface ProgramKG {
  courses: { id: string; title: string; subject: string; class_level?: string }[];
  gates: GateNode[];
  within_edges: Edge[];
  cross_edges: Edge[];
  bottlenecks: Bottleneck[];
  students: StudentSummary[];
}

type ProgramTab = 'graph' | 'bottlenecks' | 'students';

export function ProgramViewPage() {
  const { programId } = useParams();
  const [data, setData] = useState<ProgramKG | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProgramTab>('graph');
  const [hoveredGate, setHoveredGate] = useState<string | null>(null);

  useEffect(() => {
    api.get<ProgramKG>(`/programs/${programId}/kg`).then(d => { setData(d); setLoading(false); });
  }, [programId]);

  if (loading || !data) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64 mb-4" /><div className="card p-6 h-96" /></div>;

  // Build lookup maps
  const gateMap = new Map(data.gates.map(g => [g.id, g]));
  const courseColors: Record<string, string> = {};
  data.courses.forEach((c, i) => { courseColors[c.id] = ['#2E75B6', '#1E7E34', '#7C3AED'][i % 3]; });

  // Instructor mapping for college courses
  const INSTRUCTORS: Record<string, string> = {
    'Computer Science': 'Prof. Rajesh Kumar',
    'Mathematics': 'Prof. Sunita Iyer',
    'Machine Learning': 'Prof. Amit Pandey',
  };

  // Get connected gates for hover highlighting
  const connectedGates = new Set<string>();
  if (hoveredGate) {
    connectedGates.add(hoveredGate);
    [...data.within_edges, ...data.cross_edges].forEach(e => {
      if (e.gate_id === hoveredGate) connectedGates.add(e.prerequisite_gate_id);
      if (e.prerequisite_gate_id === hoveredGate) connectedGates.add(e.gate_id);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
        <Link to="/teacher" className="hover:text-leap-blue">Dashboard</Link><span>›</span>
        <span className="text-gray-700 font-bold">Program Knowledge Graph</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Cross-Course Knowledge Graph</h1>
          <p className="text-[12px] text-gray-400">{data.courses.length} courses &middot; {data.gates.length} gates &middot; {data.cross_edges.length} cross-course dependencies</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {([
          { key: 'graph' as const, label: 'Knowledge Graph' },
          { key: 'bottlenecks' as const, label: `Bottlenecks${data.bottlenecks.length ? ` (${data.bottlenecks.length})` : ''}` },
          { key: 'students' as const, label: `Students (${data.students.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}>{t.label}</button>
        ))}
      </div>

      {/* Graph Tab */}
      {tab === 'graph' && (
        <div className="fade-in space-y-4">
          {/* Course Swim Lanes */}
          {data.courses.map(course => {
            const courseGates = data.gates.filter(g => g.course_id === course.id).sort((a, b) => a.gate_number - b.gate_number);
            const color = courseColors[course.id];

            return (
              <div key={course.id} className="card p-0 overflow-hidden">
                {/* Course Header */}
                <div className="px-5 py-3 flex items-center gap-3" style={{ background: `${color}10`, borderBottom: `2px solid ${color}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ background: color }}>
                    {course.class_level || 'C'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{course.title}</p>
                    <p className="text-[10px] text-gray-400">{course.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: color }}>
                      {(INSTRUCTORS[course.subject] || 'Prof.').split(' ').pop()?.charAt(0)}
                    </div>
                    <span className="text-[11px] font-medium text-gray-700">{INSTRUCTORS[course.subject] || 'Professor'}</span>
                  </div>
                </div>

                {/* Gates Row */}
                <div className="p-4 flex gap-3 items-center overflow-x-auto">
                  {courseGates.map((gate, gi) => {
                    // Find cross-course prereqs pointing TO this gate
                    const incomingCross = data.cross_edges.filter(e => e.gate_id === gate.id);
                    // Find cross-course edges FROM this gate
                    const outgoingCross = data.cross_edges.filter(e => e.prerequisite_gate_id === gate.id);
                    const hasCross = incomingCross.length > 0 || outgoingCross.length > 0;
                    const isHighlighted = !hoveredGate || connectedGates.has(gate.id);

                    return (
                      <div key={gate.id} className="flex items-center gap-3">
                        {/* Gate Node */}
                        <div
                          className={`relative rounded-2xl border-2 p-4 min-w-[140px] transition-all cursor-pointer ${isHighlighted ? '' : 'opacity-30'} ${hasCross ? 'ring-2 ring-offset-2 ring-purple-300' : ''}`}
                          style={{ borderColor: color }}
                          onMouseEnter={() => setHoveredGate(gate.id)}
                          onMouseLeave={() => setHoveredGate(null)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded" style={{ background: color }}>G{gate.gate_number}</span>
                            {hasCross && <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">CROSS</span>}
                          </div>
                          <p className="text-[11px] font-bold text-gray-800 mb-1">{gate.short_title}</p>
                          <p className={`text-lg font-black ${gate.avg_mastery >= 70 ? 'text-green-600' : gate.avg_mastery >= 50 ? 'text-yellow-600' : gate.avg_mastery > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                            {gate.avg_mastery > 0 ? `${gate.avg_mastery}%` : '—'}
                          </p>
                          {gate.student_count > 0 && <p className="text-[9px] text-gray-400">{gate.student_count} students</p>}

                          {/* Incoming cross-course arrows label */}
                          {incomingCross.length > 0 && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              {incomingCross.map(e => {
                                const prereq = gateMap.get(e.prerequisite_gate_id);
                                if (!prereq) return null;
                                const prereqCourse = data.courses.find(c => c.id === prereq.course_id);
                                return (
                                  <span key={e.prerequisite_gate_id} className="text-[8px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    needs {prereqCourse?.class_level || ''} G{prereq.gate_number}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Arrow to next gate */}
                        {gi < courseGates.length - 1 && (
                          <svg width="24" height="24" viewBox="0 0 24 24" className="flex-shrink-0 text-gray-300">
                            <path d="M4 12h14m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Cross-Course Edge Legend */}
          {data.cross_edges.length > 0 && (
            <div className="card p-4">
              <h3 className="section-header mb-3">Cross-Course Dependencies</h3>
              <div className="space-y-1.5">
                {data.cross_edges.map((edge, i) => {
                  const from = gateMap.get(edge.prerequisite_gate_id);
                  const to = gateMap.get(edge.gate_id);
                  if (!from || !to) return null;
                  const fromCourse = data.courses.find(c => c.id === from.course_id);
                  const toCourse = data.courses.find(c => c.id === to.course_id);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="font-bold px-2 py-0.5 rounded" style={{ background: courseColors[from.course_id] + '20', color: courseColors[from.course_id] }}>
                        {fromCourse?.class_level} G{from.gate_number}: {from.short_title}
                      </span>
                      <span className="text-purple-500 font-bold">→</span>
                      <span className="font-bold px-2 py-0.5 rounded" style={{ background: courseColors[to.course_id] + '20', color: courseColors[to.course_id] }}>
                        {toCourse?.class_level} G{to.gate_number}: {to.short_title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottlenecks Tab */}
      {tab === 'bottlenecks' && (
        <div className="fade-in space-y-3">
          {data.bottlenecks.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No cross-course bottlenecks detected</div>
          ) : data.bottlenecks.map((b, i) => (
            <div key={i} className="card p-4 border-l-4 border-l-red-400">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{b.blocked_students} student{b.blocked_students !== 1 ? 's' : ''} blocked</p>
                  <p className="text-[11px] text-gray-500">
                    Struggling in <strong>{b.from_gate}</strong> ({b.from_course}) → blocks <strong>{b.to_gate}</strong> ({b.to_course})
                  </p>
                </div>
                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full">
                  {b.blocked_students}/{b.total_students} students
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${(b.blocked_students / Math.max(b.total_students, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Students Tab */}
      {tab === 'students' && (
        <div className="fade-in">
          <div className="card p-5 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 text-gray-400 font-bold text-[10px]">Student</th>
                  {data.courses.map(c => (
                    <th key={c.id} className="text-center py-2 px-2 font-bold text-[10px]" style={{ color: courseColors[c.id] }}>{c.class_level || c.subject.slice(0, 6)}</th>
                  ))}
                  <th className="text-center py-2 pl-3 text-gray-400 font-bold text-[10px]">Overall</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(student => (
                  <tr key={student.id} className="border-t border-gray-50">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {student.at_risk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        <span className={`font-medium ${student.at_risk ? 'text-red-700' : 'text-gray-700'}`}>{student.name}</span>
                      </div>
                    </td>
                    {data.courses.map(c => {
                      const cs = student.courses.find(sc => sc.course_id === c.id);
                      const pct = cs?.avg_mastery || 0;
                      return (
                        <td key={c.id} className="text-center py-2 px-2">
                          <span className="inline-block w-12 py-0.5 rounded-md text-[10px] font-bold" style={{
                            background: pct >= 70 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : pct > 0 ? '#FEE2E2' : '#F3F4F6',
                            color: pct >= 70 ? '#065F46' : pct >= 50 ? '#92400E' : pct > 0 ? '#991B1B' : '#9CA3AF',
                          }}>{pct > 0 ? `${pct}%` : '—'}</span>
                        </td>
                      );
                    })}
                    <td className="text-center py-2 pl-3">
                      <span className={`font-black ${student.overall_mastery >= 70 ? 'text-green-700' : student.overall_mastery >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
                        {student.overall_mastery}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
