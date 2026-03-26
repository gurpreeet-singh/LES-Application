import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { BloomBarSVG } from '../shared/BloomBarSVG';
import { BLOOM_LEVEL_THRESHOLDS } from '@leap/shared';

interface LessonAnalysisData {
  lesson_title: string;
  lesson_number: number;
  total_students: number;
  students_attempted: number;
  class_average: number;
  pass_rate: number;
  distribution: number[];
  questions: {
    question_number: number;
    question_text: string;
    question_type: string;
    bloom_level: string;
    avg_score: number;
    correct_pct: number;
    correct_count: number;
    total_attempts: number;
    top_misconceptions: { misconception: string; count: number }[];
  }[];
  bloom_breakdown: { level: string; avg: number; threshold: number; met: boolean }[];
  leaderboard: { student_id: string; name: string; avg: number; rank: number }[];
  heatmap: { student_id: string; name: string; scores: (number | null)[] }[];
}

export function LessonAnalysis({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [data, setData] = useState<LessonAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ analysis: LessonAnalysisData | null }>(`/courses/${courseId}/analytics/lesson/${lessonId}`)
      .then(d => { setData(d.analysis); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId, lessonId]);

  if (loading) return <div className="animate-pulse"><div className="card p-6 h-64" /></div>;
  if (!data) return (
    <div className="card p-8 text-center">
      <p className="text-sm text-gray-500">No quiz data yet. Students need to complete the quiz first.</p>
    </div>
  );

  const distLabels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
  const maxDist = Math.max(...data.distribution, 1);
  const allMisconceptions = data.questions.flatMap(q => q.top_misconceptions).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5 fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-leap-navy">{data.students_attempted}/{data.total_students}</p>
          <p className="text-[10px] text-gray-400">Students Attempted</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-black ${data.class_average >= 70 ? 'text-leap-green' : data.class_average >= 50 ? 'text-leap-amber' : 'text-leap-red'}`}>{data.class_average}%</p>
          <p className="text-[10px] text-gray-400">Class Average</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-leap-blue">{data.pass_rate}%</p>
          <p className="text-[10px] text-gray-400">Pass Rate (&ge;60%)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-leap-purple">{data.questions.length}</p>
          <p className="text-[10px] text-gray-400">Questions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Score Distribution */}
        <div className="card p-4">
          <h3 className="section-header mb-3">Score Distribution</h3>
          <div className="flex items-end gap-2 h-32">
            {data.distribution.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-700">{count}</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(count / maxDist) * 100}%`,
                    minHeight: count > 0 ? '8px' : '2px',
                    background: i < 2 ? '#EF4444' : i < 3 ? '#F59E0B' : '#10B981',
                    opacity: 0.8,
                  }}
                />
                <span className="text-[9px] text-gray-400">{distLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bloom Level Breakdown */}
        <div className="card p-4">
          <h3 className="section-header mb-3">Bloom Level Performance</h3>
          <BloomBarSVG
            data={data.bloom_breakdown.map(b => ({ level: b.level.charAt(0).toUpperCase() + b.level.slice(1), pct: b.avg }))}
            width={380}
            height={160}
          />
        </div>
      </div>

      {/* Question Heatmap */}
      <div className="card p-4 overflow-x-auto">
        <h3 className="section-header mb-3">Student × Question Heatmap</h3>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left">
              <th className="py-1.5 px-2 text-gray-400 font-bold">Student</th>
              {data.questions.map((q, i) => (
                <th key={i} className="py-1.5 px-1.5 text-center text-gray-400 font-bold" title={q.question_text}>
                  Q{q.question_number}
                </th>
              ))}
              <th className="py-1.5 px-2 text-center text-gray-400 font-bold">Avg</th>
            </tr>
          </thead>
          <tbody>
            {data.heatmap.map(row => {
              const avg = row.scores.filter(s => s !== null).length > 0
                ? Math.round(row.scores.filter(s => s !== null).reduce((a, b) => a! + b!, 0)! / row.scores.filter(s => s !== null).length)
                : 0;
              return (
                <tr key={row.student_id} className="border-t border-gray-50">
                  <td className="py-1.5 px-2 font-medium text-gray-700">{row.name}</td>
                  {row.scores.map((s, i) => (
                    <td key={i} className="py-1 px-1 text-center">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold mx-auto"
                        style={{
                          background: s === null ? '#F3F4F6' : s >= 80 ? '#D1FAE5' : s >= 50 ? '#FEF3C7' : '#FEE2E2',
                          color: s === null ? '#9CA3AF' : s >= 80 ? '#065F46' : s >= 50 ? '#92400E' : '#991B1B',
                        }}
                      >
                        {s !== null ? s : '—'}
                      </div>
                    </td>
                  ))}
                  <td className="py-1.5 px-2 text-center font-bold" style={{ color: avg >= 70 ? '#10B981' : avg >= 50 ? '#F59E0B' : '#EF4444' }}>
                    {avg}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Question-by-Question Analysis */}
      <div className="card p-4">
        <h3 className="section-header mb-3">Question Analysis</h3>
        <div className="space-y-2">
          {data.questions.map(q => (
            <div key={q.question_number} className={`p-3 rounded-xl border ${q.correct_pct >= 70 ? 'border-green-100 bg-green-50/30' : q.correct_pct >= 40 ? 'border-amber-100 bg-amber-50/30' : 'border-red-100 bg-red-50/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Q{q.question_number}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{q.bloom_level}</span>
                    <span className="text-[10px] text-gray-400">{q.question_type}</span>
                  </div>
                  <p className="text-[12px] text-gray-700">{q.question_text.slice(0, 120)}{q.question_text.length > 120 ? '...' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${q.correct_pct >= 70 ? 'text-green-600' : q.correct_pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{q.correct_pct}%</p>
                  <p className="text-[9px] text-gray-400">{q.correct_count}/{q.total_attempts} correct</p>
                </div>
              </div>
              {q.top_misconceptions.length > 0 && (
                <div className="mt-2 pl-2 border-l-2 border-red-200">
                  {q.top_misconceptions.map((m, mi) => (
                    <p key={mi} className="text-[10px] text-red-600">{m.count} students: {m.misconception}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Misconception Summary */}
      {allMisconceptions.length > 0 && (
        <div className="card p-4">
          <h3 className="section-header mb-3">Top Misconceptions to Address</h3>
          <div className="space-y-2">
            {allMisconceptions.slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">{m.count}</div>
                <p className="text-[12px] text-red-800">{m.misconception}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card p-4">
        <h3 className="section-header mb-3">Student Ranking</h3>
        <div className="space-y-1">
          {data.leaderboard.map(s => (
            <div key={s.student_id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.rank <= 3 ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-500'}`}>{s.rank}</span>
              <span className="text-[12px] font-medium text-gray-700 flex-1">{s.name}</span>
              <div className="w-24 bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full" style={{ width: `${s.avg}%`, background: s.avg >= 70 ? '#10B981' : s.avg >= 50 ? '#F59E0B' : '#EF4444' }} />
              </div>
              <span className="text-[12px] font-bold text-gray-700 w-10 text-right">{s.avg}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
