import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { BloomRadar } from '../shared/BloomRadar';

interface TrajectoryLesson {
  lesson_number: number;
  lesson_title: string;
  gate_number: number;
  gate_color: string;
  gate_title: string;
  class_average: number;
}

interface StudentData {
  id: string;
  name: string;
  scores: number[];
  average: number;
  rank: number;
  trend: number;
  recent_avg: number;
  prev_avg: number;
}

interface StudentDetail {
  name: string;
  overall_score: number;
  accuracy: number;
  total_attempts: number;
  correct_count: number;
  bloom_profile: Record<string, number>;
  gate_progress: { gate_number: number; gate_title: string; gate_color: string; mastery_pct: number; bloom_scores: Record<string, number> }[];
  misconceptions: { misconception: string; count: number }[];
  recommendation: string;
}

export function ClassTrajectory({ courseId }: { courseId: string }) {
  const [trajectory, setTrajectory] = useState<TrajectoryLesson[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; data: TrajectoryLesson } | null>(null);

  useEffect(() => {
    api.get<{ trajectory: TrajectoryLesson[]; students: StudentData[] }>(`/courses/${courseId}/analytics/class-trajectory`)
      .then(d => { setTrajectory(d.trajectory); setStudents(d.students); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!selectedStudent) { setStudentDetail(null); return; }
    setDetailLoading(true);
    api.get<{ student: StudentDetail }>(`/courses/${courseId}/analytics/student/${selectedStudent}`)
      .then(d => { setStudentDetail(d.student); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedStudent, courseId]);

  if (loading) return <div className="animate-pulse"><div className="card p-6 h-48" /></div>;
  if (trajectory.length === 0) return <div className="card p-8 text-center text-sm text-gray-500">No quiz data yet.</div>;

  const maxScore = 100;
  const chartW = 700;
  const chartH = 180;
  const pad = { top: 10, right: 20, bottom: 25, left: 35 };
  const w = chartW - pad.left - pad.right;
  const h = chartH - pad.top - pad.bottom;

  const classPoints = trajectory.map((t, i) => ({
    x: pad.left + (i / Math.max(1, trajectory.length - 1)) * w,
    y: pad.top + h - (t.class_average / maxScore) * h,
    ...t,
  }));

  const classPath = classPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-5">
      {/* Class Trajectory Chart */}
      <div className="card p-4">
        <h3 className="section-header mb-3">Class Score Trajectory</h3>
        <div className="overflow-x-auto relative">
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} onMouseLeave={() => setHover(null)}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(v => {
              const y = pad.top + h - (v / maxScore) * h;
              return (
                <g key={v}>
                  <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="#F3F4F6" />
                  <text x={pad.left - 5} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#9CA3AF">{v}</text>
                </g>
              );
            })}
            {/* Area fill */}
            <path
              d={`${classPath} L${classPoints[classPoints.length - 1]?.x || 0},${pad.top + h} L${pad.left},${pad.top + h} Z`}
              fill="url(#trajectoryGrad)" opacity="0.3"
            />
            <defs>
              <linearGradient id="trajectoryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2E75B6" />
                <stop offset="100%" stopColor="#2E75B6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Line */}
            <path d={classPath} fill="none" stroke="#2E75B6" strokeWidth="2.5" />
            {/* Hover vertical line */}
            {hover && (
              <line x1={classPoints.find(p => p.lesson_number === hover.data.lesson_number)?.x || 0} y1={pad.top} x2={classPoints.find(p => p.lesson_number === hover.data.lesson_number)?.x || 0} y2={pad.top + h} stroke="#2E75B6" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            )}
            {/* Points with gate colors — interactive */}
            {classPoints.map((p, i) => (
              <circle
                key={i} cx={p.x} cy={p.y} r={hover?.data.lesson_number === p.lesson_number ? 7 : 4}
                fill={p.gate_color} stroke="white" strokeWidth="2"
                className="cursor-pointer transition-all"
                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, data: p })}
                onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, data: p })}
              />
            ))}
            {/* Lesson numbers */}
            {classPoints.filter((_, i) => i % Math.max(1, Math.floor(trajectory.length / 10)) === 0).map(p => (
              <text key={p.lesson_number} x={p.x} y={chartH - 5} textAnchor="middle" fontSize="8" fill="#9CA3AF">L{p.lesson_number}</text>
            ))}
          </svg>
          {/* Tooltip */}
          {hover && (
            <div
              className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-xl shadow-lg text-[11px] pointer-events-none"
              style={{ left: hover.x + 12, top: hover.y - 40 }}
            >
              <p className="font-bold">Lesson {hover.data.lesson_number}: {hover.data.lesson_title}</p>
              <p className="text-gray-300">Gate: {hover.data.gate_title} | Class Avg: <span className="font-bold text-white">{hover.data.class_average}%</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Student Rankings with Sparklines */}
      <div className="card p-4">
        <h3 className="section-header mb-3">Student Performance & Trends</h3>
        <div className="space-y-1">
          {students.map(s => {
            const sparkW = 80;
            const sparkH = 24;
            const nonZero = s.scores.filter(v => v > 0);
            const sparkPath = nonZero.length > 1
              ? nonZero.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (nonZero.length - 1)) * sparkW},${sparkH - (v / 100) * sparkH}`).join(' ')
              : '';

            return (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(selectedStudent === s.id ? null : s.id)}
                className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl text-left transition-all ${selectedStudent === s.id ? 'bg-leap-navy/5 border border-leap-navy/20' : 'hover:bg-gray-50'}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.rank <= 3 ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {s.rank}
                </span>
                <span className="text-[12px] font-medium text-gray-700 w-24 truncate">{s.name}</span>
                {/* Sparkline */}
                <svg width={sparkW} height={sparkH} className="flex-shrink-0">
                  {sparkPath && <path d={sparkPath} fill="none" stroke={s.trend >= 0 ? '#10B981' : '#EF4444'} strokeWidth="1.5" />}
                </svg>
                <div className="w-20 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                  <div className="h-1.5 rounded-full" style={{ width: `${s.average}%`, background: s.average >= 70 ? '#10B981' : s.average >= 50 ? '#F59E0B' : '#EF4444' }} />
                </div>
                <span className="text-[12px] font-bold text-gray-700 w-10 text-right">{s.average}%</span>
                <span className={`text-[10px] font-bold w-8 text-right ${s.trend > 0 ? 'text-green-600' : s.trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {s.trend > 0 ? `+${s.trend}` : s.trend < 0 ? s.trend : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Student Deep Dive Modal */}
      {selectedStudent && studentDetail && !detailLoading && (
        <div className="card p-5 border-2 border-leap-navy/20 fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900">{studentDetail.name}</h3>
              <p className="text-[11px] text-gray-400">Score: {studentDetail.overall_score}% | Accuracy: {studentDetail.accuracy}% | Attempts: {studentDetail.total_attempts}</p>
            </div>
            <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Bloom Radar */}
            <div className="flex flex-col items-center">
              <p className="section-header mb-2">Bloom Profile</p>
              <BloomRadar data={studentDetail.bloom_profile} size={160} />
            </div>

            {/* Gate Progress */}
            <div>
              <p className="section-header mb-2">Gate Progress</p>
              <div className="space-y-2">
                {studentDetail.gate_progress.map(g => (
                  <div key={g.gate_number} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.gate_color }} />
                    <span className="text-[11px] text-gray-600 w-20 truncate">{g.gate_title}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${g.mastery_pct}%`, background: g.gate_color }} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 w-8 text-right">{g.mastery_pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Misconceptions */}
            <div>
              <p className="section-header mb-2">Top Misconceptions</p>
              {studentDetail.misconceptions.length > 0 ? (
                <div className="space-y-1.5">
                  {studentDetail.misconceptions.slice(0, 5).map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold flex-shrink-0">{m.count}</span>
                      <span className="text-gray-600">{m.misconception}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">No significant misconceptions detected.</p>
              )}
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">AI Recommendation</p>
            <p className="text-[12px] text-blue-800">{studentDetail.recommendation}</p>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-gray-200 rounded w-48 mb-2" /><div className="h-32 bg-gray-200 rounded" /></div>
      )}
    </div>
  );
}
