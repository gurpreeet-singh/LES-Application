import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface GateScore { gate_id: string; gate_number: number; short_title: string; mastery_pct: number; bloom_ceiling: string | null }
interface StudentPerf { id: string; name: string; avg_mastery: number; at_risk: boolean; gate_scores: GateScore[] }
interface GateInfo { id: string; gate_number: number; short_title: string; color: string }
interface CourseDetail {
  id: string; title: string; subject: string; class_level?: string; section?: string; status: string;
  gates: GateInfo[]; students: StudentPerf[]; avg_mastery: number; total_students: number;
  students_at_risk: number; suggestions: any[];
}
interface Suggestion { type: string; severity: 'critical' | 'warning' | 'info' | 'success'; teacher: string; course: string; message: string }
interface TeacherDetail { teacher: any; courses: CourseDetail[]; suggestions: Suggestion[] }

type ProfileTab = 'overview' | 'courses' | 'insights';

export function TeacherProfilePage() {
  const { teacherId } = useParams();
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId) return;
    api.get<TeacherDetail>(`/admin/teachers/${teacherId}`).then(d => { setDetail(d); setLoading(false); });
  }, [teacherId]);

  if (loading || !detail) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64 mb-4" /><div className="card p-6 h-48" /><div className="card p-6 h-64" /></div>;

  const { teacher, courses, suggestions } = detail;
  const activeCourses = courses.filter(c => c.status === 'active');
  const totalStudents = courses.reduce((s, c) => s + c.total_students, 0);
  const totalAtRisk = courses.reduce((s, c) => s + c.students_at_risk, 0);
  const avgMastery = activeCourses.length > 0
    ? Math.round(activeCourses.filter(c => c.avg_mastery > 0).reduce((s, c) => s + c.avg_mastery, 0) / (activeCourses.filter(c => c.avg_mastery > 0).length || 1))
    : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
        <Link to="/admin/teachers" className="hover:text-leap-blue">Teachers</Link>
        <span>›</span>
        <span className="text-gray-700 font-bold">{teacher.full_name}</span>
      </div>

      {/* Profile Header */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-leap-navy text-white flex items-center justify-center text-2xl font-bold">
              {teacher.full_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">{teacher.full_name}</h1>
              <p className="text-[12px] text-gray-400">{teacher.email}</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center"><p className="text-xl font-black text-leap-navy">{courses.length}</p><p className="text-[9px] text-gray-400">Courses</p></div>
            <div className="text-center"><p className="text-xl font-black text-leap-blue">{totalStudents}</p><p className="text-[9px] text-gray-400">Students</p></div>
            <div className="text-center"><p className={`text-xl font-black ${avgMastery >= 75 ? 'text-leap-green' : avgMastery >= 50 ? 'text-leap-amber' : 'text-leap-red'}`}>{avgMastery}%</p><p className="text-[9px] text-gray-400">Avg Mastery</p></div>
            <div className="text-center"><p className={`text-xl font-black ${totalAtRisk > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{totalAtRisk}</p><p className="text-[9px] text-gray-400">At Risk</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {([
          { key: 'overview' as const, label: 'Overview' },
          { key: 'courses' as const, label: `Courses (${courses.length})` },
          { key: 'insights' as const, label: `AI Insights${suggestions.length > 0 ? ` (${suggestions.length})` : ''}` },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}>{t.label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="fade-in space-y-5">
          {/* Course Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {courses.map(course => (
              <Link key={course.id} to={`/admin/teachers/${teacherId}/courses/${course.id}`}
                className="card-interactive p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{course.title}</h3>
                    <p className="text-[10px] text-gray-400">{course.subject} {course.class_level && `| Class ${course.class_level}${course.section || ''}`}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${course.status === 'active' ? 'bg-green-100 text-green-700' : course.status === 'review' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{course.status}</span>
                </div>
                <div className="flex gap-4">
                  <div><p className={`text-lg font-black ${course.avg_mastery >= 75 ? 'text-leap-green' : course.avg_mastery >= 50 ? 'text-leap-amber' : 'text-leap-red'}`}>{course.avg_mastery}%</p><p className="text-[9px] text-gray-400">Mastery</p></div>
                  <div><p className="text-lg font-black text-leap-navy">{course.total_students}</p><p className="text-[9px] text-gray-400">Students</p></div>
                  <div><p className={`text-lg font-black ${course.students_at_risk > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{course.students_at_risk}</p><p className="text-[9px] text-gray-400">At Risk</p></div>
                  <div><p className="text-lg font-black text-leap-purple">{course.gates.length}</p><p className="text-[9px] text-gray-400">Gates</p></div>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h2 className="section-header mb-3">Top Suggestions</h2>
              <div className="space-y-2">
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl text-[12px] border ${s.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : s.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : s.severity === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                    <span className="font-bold mr-1.5">{s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : s.severity === 'success' ? '🟢' : '🔵'}</span>{s.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courses Tab */}
      {tab === 'courses' && (
        <div className="fade-in space-y-4">
          {courses.map(course => (
            <div key={course.id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{course.title}</h3>
                  <p className="text-[10px] text-gray-400">{course.subject} {course.class_level && `| Class ${course.class_level}${course.section || ''}`} | <span className={`font-bold ${course.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>{course.status}</span></p>
                </div>
                <Link to={`/admin/teachers/${teacherId}/courses/${course.id}`} className="btn-primary text-[10px] py-1.5">Full Analytics</Link>
              </div>
              {/* Heatmap */}
              {course.students.length > 0 && course.gates.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead><tr>
                      <th className="text-left py-2 pr-3 text-gray-400 font-bold text-[10px] w-32">Student</th>
                      {course.gates.map(g => <th key={g.id} className="text-center py-2 px-1 text-gray-400 font-bold text-[10px]" title={g.short_title}>G{g.gate_number}</th>)}
                      <th className="text-center py-2 pl-3 text-gray-400 font-bold text-[10px]">Avg</th>
                    </tr></thead>
                    <tbody>
                      {course.students.sort((a, b) => b.avg_mastery - a.avg_mastery).map(student => (
                        <tr key={student.id} className="border-t border-gray-50">
                          <td className="py-1.5 pr-3"><div className="flex items-center gap-1.5">{student.at_risk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}<span className={`font-medium ${student.at_risk ? 'text-red-700' : 'text-gray-700'}`}>{student.name}</span></div></td>
                          {course.gates.map(g => {
                            const pct = student.gate_scores.find(s => s.gate_id === g.id)?.mastery_pct || 0;
                            return <td key={g.id} className="text-center py-1.5 px-1"><span className="inline-block w-10 py-0.5 rounded-md text-[10px] font-bold" style={{ background: pct >= 75 ? '#D1FAE5' : pct >= 60 ? '#FEF3C7' : pct > 0 ? '#FEE2E2' : '#F3F4F6', color: pct >= 75 ? '#065F46' : pct >= 60 ? '#92400E' : pct > 0 ? '#991B1B' : '#9CA3AF' }}>{pct > 0 ? `${pct}%` : '—'}</span></td>;
                          })}
                          <td className="text-center py-1.5 pl-3"><span className={`font-black ${student.avg_mastery >= 75 ? 'text-green-700' : student.avg_mastery >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>{student.avg_mastery}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2 mt-2 flex-wrap">{course.gates.map(g => <span key={g.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: g.color + '20', color: g.color }}>G{g.gate_number}: {g.short_title}</span>)}</div>
                </div>
              )}
              {course.students.length === 0 && <p className="text-[12px] text-gray-400 text-center py-4">No student data</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI Insights Tab */}
      {tab === 'insights' && (
        <div className="fade-in space-y-3">
          {suggestions.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No AI suggestions for this teacher</div>
          ) : (
            suggestions.map((s, i) => (
              <div key={i} className={`card p-4 border-l-4 ${s.severity === 'critical' ? 'border-l-red-500 bg-red-50/30' : s.severity === 'warning' ? 'border-l-amber-400 bg-amber-50/30' : s.severity === 'success' ? 'border-l-green-400 bg-green-50/30' : 'border-l-blue-400 bg-blue-50/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.severity === 'critical' ? '#FEE2E2' : s.severity === 'warning' ? '#FEF3C7' : s.severity === 'success' ? '#D1FAE5' : '#DBEAFE', color: s.severity === 'critical' ? '#991B1B' : s.severity === 'warning' ? '#92400E' : s.severity === 'success' ? '#065F46' : '#1E40AF' }}>{s.severity.toUpperCase()}</span>
                  <span className="text-[11px] text-gray-500">{s.course}</span>
                </div>
                <p className="text-[12px] text-gray-800 leading-relaxed">{s.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
