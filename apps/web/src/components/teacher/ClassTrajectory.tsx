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

export interface StudentData {
  id: string;
  name: string;
  scores: number[];
  average: number;
  rank: number;
  trend: number;
  recent_avg: number;
  prev_avg: number;
}

export interface StudentDetail {
  name: string;
  email: string;
  overall_score: number;
  accuracy: number;
  total_attempts: number;
  correct_count: number;
  bloom_profile: Record<string, number>;
  gate_progress: { gate_number: number; gate_title: string; gate_color: string; mastery_pct: number; bloom_scores: Record<string, number> }[];
  misconceptions: { misconception: string; count: number }[];
  recommendation: string;
}

// Chart-only component — renders the trajectory line chart
export function ClassTrajectory({ courseId, onStudentsLoaded }: { courseId: string; onStudentsLoaded?: (students: StudentData[]) => void }) {
  const [trajectory, setTrajectory] = useState<TrajectoryLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; data: TrajectoryLesson } | null>(null);

  useEffect(() => {
    api.get<{ trajectory: TrajectoryLesson[]; students: StudentData[] }>(`/courses/${courseId}/analytics/class-trajectory`)
      .then(d => {
        setTrajectory(d.trajectory);
        if (onStudentsLoaded) onStudentsLoaded(d.students);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="animate-pulse"><div className="card p-4 h-40" /></div>;
  if (trajectory.length === 0) return <div className="card p-6 text-center text-sm text-gray-500">No quiz data yet — trajectory will appear after sessions are completed.</div>;

  const maxScore = 100;
  const chartW = 800;
  const chartH = 160;
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
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="section-header">Class Score Trajectory</h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span>{trajectory.length} completed sessions</span>
          <span>Class Avg: {Math.round(trajectory.reduce((s, t) => s + t.class_average, 0) / trajectory.length)}%</span>
        </div>
      </div>
      <div className="overflow-x-auto relative">
        <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map(v => {
            const y = pad.top + h - (v / maxScore) * h;
            return (
              <g key={v}>
                <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="#F3F4F6" />
                <text x={pad.left - 5} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#9CA3AF">{v}</text>
              </g>
            );
          })}
          <path
            d={`${classPath} L${classPoints[classPoints.length - 1]?.x || 0},${pad.top + h} L${pad.left},${pad.top + h} Z`}
            fill="url(#trajectoryGrad2)" opacity="0.3"
          />
          <defs>
            <linearGradient id="trajectoryGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E75B6" />
              <stop offset="100%" stopColor="#2E75B6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={classPath} fill="none" stroke="#2E75B6" strokeWidth="2.5" />
          {hover && (
            <line x1={classPoints.find(p => p.lesson_number === hover.data.lesson_number)?.x || 0} y1={pad.top} x2={classPoints.find(p => p.lesson_number === hover.data.lesson_number)?.x || 0} y2={pad.top + h} stroke="#2E75B6" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
          )}
          {classPoints.map((p, i) => (
            <circle
              key={i} cx={p.x} cy={p.y} r={hover?.data.lesson_number === p.lesson_number ? 7 : 4}
              fill={p.gate_color} stroke="white" strokeWidth="2"
              className="cursor-pointer transition-all"
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, data: p })}
              onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, data: p })}
            />
          ))}
          {classPoints.filter((_, i) => i % Math.max(1, Math.floor(trajectory.length / 12)) === 0).map((p, _, arr) => {
            const sessionIdx = classPoints.indexOf(p) + 1;
            return (
              <text key={p.lesson_number} x={p.x} y={chartH - 5} textAnchor="middle" fontSize="8" fill="#9CA3AF">
                S{sessionIdx}
              </text>
            );
          })}
        </svg>
        {hover && (
          <div className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-xl shadow-lg text-[11px] pointer-events-none" style={{ left: hover.x + 12, top: hover.y - 40 }}>
            <p className="font-bold">Session {classPoints.findIndex(p => p.lesson_number === hover.data.lesson_number) + 1}: {hover.data.lesson_title}</p>
            <p className="text-gray-300">Gate: {hover.data.gate_title} | Class Avg: <span className="font-bold text-white">{hover.data.class_average}%</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
