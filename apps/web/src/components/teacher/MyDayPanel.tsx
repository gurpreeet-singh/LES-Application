import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface SchedulePeriod {
  period: number; start: string; end: string;
  type: 'own' | 'substitute' | 'free';
  course_id?: string; subject?: string; class_level?: string; section?: string;
  lesson_title?: string; lesson_id?: string; lesson_objective?: string;
  absent_teacher?: string; absence_reason?: string; teaching_brief?: string;
}

interface ScheduleData {
  date: string; day_name: string; teacher_name: string;
  periods: SchedulePeriod[];
  stats: { total_periods: number; own_classes: number; substitutes: number; free_periods: number };
}

export function MyDayPanel() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSub, setExpandedSub] = useState<number | null>(null);

  useEffect(() => {
    api.get<ScheduleData>('/teacher/my-schedule/today')
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="card p-5 mb-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-48 mb-3" /><div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div></div>;
  if (!data) return null;

  const hasSubs = data.stats.substitutes > 0;

  return (
    <div className={`card p-0 mb-6 overflow-hidden ${hasSubs ? 'border-l-4 border-l-amber-400' : ''}`}>
      {/* Header */}
      <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-3">
          <span className="text-lg">📅</span>
          <div>
            <h2 className="text-sm font-black text-gray-900">My Schedule — {data.day_name}</h2>
            <p className="text-[10px] text-gray-400">
              {data.stats.own_classes} classes
              {hasSubs && <span className="text-amber-600 font-bold"> + {data.stats.substitutes} substitute{data.stats.substitutes > 1 ? 's' : ''}</span>}
              {' · '}{data.stats.free_periods} free
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasSubs && !collapsed && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full animate-pulse">
              Substitute assignment today
            </span>
          )}
          <span className={`text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}>&#9660;</span>
        </div>
      </button>

      {/* Schedule */}
      {!collapsed && (
        <div className="px-5 py-3 space-y-1.5">
          {data.periods.map(p => {
            if (p.type === 'free') {
              return (
                <div key={p.period} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50/50">
                  <div className="w-14 text-center flex-shrink-0">
                    <p className="text-[11px] font-bold text-gray-300">P{p.period}</p>
                    <p className="text-[8px] text-gray-300">{p.start}</p>
                  </div>
                  <p className="text-[11px] text-gray-300 italic">Free period</p>
                </div>
              );
            }

            if (p.type === 'substitute') {
              return (
                <div key={p.period}>
                  <button
                    onClick={() => setExpandedSub(expandedSub === p.period ? null : p.period)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/70 transition-colors"
                  >
                    <div className="w-14 text-center flex-shrink-0">
                      <p className="text-[11px] font-bold text-amber-700">P{p.period}</p>
                      <p className="text-[8px] text-amber-500">{p.start}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">SUBSTITUTE</span>
                        <span className="text-[11px] font-bold text-gray-800">{p.subject} — Class {p.class_level}{p.section}</span>
                      </div>
                      <p className="text-[10px] text-amber-700">Covering for {p.absent_teacher} ({p.absence_reason})</p>
                    </div>
                    <span className={`text-amber-400 transition-transform text-[10px] ${expandedSub === p.period ? 'rotate-180' : ''}`}>&#9660;</span>
                  </button>

                  {expandedSub === p.period && (
                    <div className="mt-1.5 ml-[4.5rem] animate-slide-down space-y-2">
                      {/* Teaching Brief */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">AI Teaching Brief</p>
                        <p className="text-[11px] font-bold text-gray-800 mb-1">{p.lesson_title}</p>
                        {p.lesson_objective && <p className="text-[10px] text-gray-600 mb-2">{p.lesson_objective}</p>}
                        <p className="text-[11px] text-blue-900 leading-relaxed">{p.teaching_brief}</p>
                      </div>
                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        {p.lesson_id && p.course_id && (
                          <Link to={`/teacher/courses/${p.course_id}/lessons/${p.lesson_id}`} className="btn-primary text-[10px] py-1.5">
                            View Full Lesson
                          </Link>
                        )}
                        {p.lesson_id && p.course_id && (
                          <Link to={`/teacher/courses/${p.course_id}/lessons/${p.lesson_id}`} className="btn-secondary text-[10px] py-1.5">
                            Download Slides
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Own class
            return (
              <div key={p.period} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="w-14 text-center flex-shrink-0">
                  <p className="text-[11px] font-bold text-leap-navy">P{p.period}</p>
                  <p className="text-[8px] text-gray-400">{p.start}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">YOUR CLASS</span>
                    <span className="text-[11px] font-bold text-gray-800">{p.subject} — Class {p.class_level}{p.section}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{p.lesson_title}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {p.lesson_id && p.course_id && (
                    <Link to={`/teacher/courses/${p.course_id}/lessons/${p.lesson_id}`} className="text-[9px] font-bold text-leap-blue hover:underline">
                      Open →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
