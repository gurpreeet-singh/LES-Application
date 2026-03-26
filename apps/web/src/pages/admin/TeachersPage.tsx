import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface EffectivenessTeacher {
  id: string; full_name: string; email: string; avg_mastery: number;
  engagement_score: number; quadrant: 'star' | 'traditionalist' | 'striver' | 'needs_attention';
  total_courses: number; active_courses: number;
}

interface CourseSummary {
  id: string; title: string; subject: string; class_level?: string; section?: string;
  status: string; total_students: number; students_at_risk: number; avg_mastery: number;
}

interface TeacherSummary {
  id: string; full_name: string; email: string;
  stats: { total_courses: number; active_courses: number; total_students: number; students_at_risk: number; avg_mastery: number };
  courses: CourseSummary[];
}

const QUADRANT_CONFIG: Record<string, { title: string; desc: string; icon: string; borderClass: string; action: string }> = {
  star: { title: 'Stars', desc: 'High mastery, high engagement', icon: '⭐', borderClass: 'border-l-green-400', action: 'Ask to mentor others' },
  traditionalist: { title: 'Effective Traditionalists', desc: 'High mastery, low engagement', icon: '📖', borderClass: 'border-l-blue-400', action: 'Nudge to explore AI tools' },
  striver: { title: 'Engaged Strivers', desc: 'Low mastery, high engagement', icon: '🔧', borderClass: 'border-l-amber-400', action: 'Need pedagogical support' },
  needs_attention: { title: 'Needs Attention', desc: 'Low mastery, low engagement', icon: '🔴', borderClass: 'border-l-red-400', action: 'Schedule 1-on-1 meeting' },
};

export function TeachersPage() {
  const [effectiveness, setEffectiveness] = useState<EffectivenessTeacher[]>([]);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      api.get<{ teachers: EffectivenessTeacher[] }>('/admin/teacher-effectiveness'),
      api.get<{ teachers: TeacherSummary[] }>('/admin/teachers'),
    ]).then(([eff, t]) => {
      setEffectiveness(eff.teachers);
      setTeachers(t.teachers);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48 mb-4" />{[1,2,3,4].map(i => <div key={i} className="card p-5 h-32" />)}</div>;

  const filteredTeachers = filter === 'all' ? teachers : teachers.filter(t => {
    const eff = effectiveness.find(e => e.id === t.id);
    return eff?.quadrant === filter;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Teachers</h1>
          <p className="text-[12px] text-gray-400">{teachers.length} teachers across the school</p>
        </div>
      </div>

      {/* Effectiveness Quadrant */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(['star', 'traditionalist', 'striver', 'needs_attention'] as const).map(q => {
          const count = effectiveness.filter(t => t.quadrant === q).length;
          const cfg = QUADRANT_CONFIG[q];
          return (
            <button key={q} onClick={() => setFilter(filter === q ? 'all' : q)}
              className={`card p-4 text-left transition-all hover:shadow-card-hover ${filter === q ? 'ring-2 ring-leap-navy' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{cfg.icon}</span>
                <span className="text-2xl font-black text-gray-900">{count}</span>
              </div>
              <p className="text-[11px] font-bold text-gray-700">{cfg.title}</p>
              <p className="text-[9px] text-gray-400">{cfg.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Teacher List */}
      <h2 className="section-header mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-leap-navy inline-block" />
        {filter === 'all' ? 'All Teachers' : QUADRANT_CONFIG[filter]?.title || 'Teachers'}
        {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-[10px] text-leap-blue hover:underline font-normal normal-case tracking-normal ml-2">Show all</button>}
      </h2>

      <div className="space-y-2">
        {filteredTeachers.map(teacher => {
          const eff = effectiveness.find(e => e.id === teacher.id);
          return (
            <Link key={teacher.id} to={`/admin/teachers/${teacher.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-card-hover transition-all block">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-leap-navy text-white flex items-center justify-center text-base font-bold">
                  {teacher.full_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{teacher.full_name}</p>
                  <p className="text-[10px] text-gray-400">{teacher.email}</p>
                </div>
                {eff && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    eff.quadrant === 'star' ? 'bg-green-100 text-green-700' :
                    eff.quadrant === 'traditionalist' ? 'bg-blue-100 text-blue-700' :
                    eff.quadrant === 'striver' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{QUADRANT_CONFIG[eff.quadrant]?.title}</span>
                )}
              </div>
              <div className="flex items-center gap-5">
                <div className="text-center"><p className="text-sm font-black text-gray-900">{teacher.stats.total_courses}</p><p className="text-[9px] text-gray-400">Courses</p></div>
                <div className="text-center"><p className="text-sm font-black text-gray-900">{teacher.stats.total_students}</p><p className="text-[9px] text-gray-400">Students</p></div>
                <div className="text-center"><p className={`text-sm font-black ${teacher.stats.avg_mastery >= 75 ? 'text-green-600' : teacher.stats.avg_mastery >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{teacher.stats.avg_mastery}%</p><p className="text-[9px] text-gray-400">Mastery</p></div>
                <div className="text-center"><p className={`text-sm font-black ${teacher.stats.students_at_risk > 0 ? 'text-red-600' : 'text-green-600'}`}>{teacher.stats.students_at_risk}</p><p className="text-[9px] text-gray-400">At Risk</p></div>
                {eff && <div className="text-center"><p className={`text-sm font-black ${eff.engagement_score >= 60 ? 'text-blue-600' : 'text-gray-400'}`}>{eff.engagement_score}%</p><p className="text-[9px] text-gray-400">Engagement</p></div>}
                <div className="flex gap-1">{teacher.courses.slice(0, 3).map(c => (
                  <span key={c.id} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.class_level}{c.section}</span>
                ))}</div>
                <span className="text-gray-300">&#8250;</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
