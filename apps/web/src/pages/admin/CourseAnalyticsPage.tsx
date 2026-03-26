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
interface TeacherDetail { teacher: any; courses: CourseDetail[]; suggestions: any[] }

type AnalyticsTab = 'assessment' | 'students' | 'insights';

export function AdminCourseAnalyticsPage() {
  const { teacherId, courseId } = useParams();
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [tab, setTab] = useState<AnalyticsTab>('assessment');
  const [loading, setLoading] = useState(true);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId) return;
    api.get<TeacherDetail>(`/admin/teachers/${teacherId}`).then(d => { setDetail(d); setLoading(false); });
  }, [teacherId]);

  if (loading || !detail) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64 mb-4" /><div className="card p-6 h-64" /></div>;

  const course = detail.courses.find(c => c.id === courseId);
  if (!course) return <div className="card p-8 text-center text-gray-400">Course not found</div>;

  const courseSuggestions = detail.suggestions.filter(s => s.course === course.title);
  const onTrack = course.students.filter(s => !s.at_risk).length;

  // Bloom distribution per gate
  const bloomData = selectedGate ? course.students.map(s => {
    const gs = s.gate_scores.find(g => g.gate_id === selectedGate);
    return { name: s.name, mastery: gs?.mastery_pct || 0, bloom_ceiling: gs?.bloom_ceiling || 'N/A' };
  }).sort((a, b) => b.mastery - a.mastery) : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
        <Link to="/admin/teachers" className="hover:text-leap-blue">Teachers</Link><span>›</span>
        <Link to={`/admin/teachers/${teacherId}`} className="hover:text-leap-blue">{detail.teacher.full_name}</Link><span>›</span>
        <span className="text-gray-700 font-bold">{course.title}</span>
      </div>

      {/* Course Header */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900">{course.title}</h1>
            <p className="text-[12px] text-gray-400">{course.subject} {course.class_level && `| Class ${course.class_level}${course.section || ''}`} | Teacher: {detail.teacher.full_name}</p>
          </div>
          <div className="flex gap-5">
            <div className="text-center"><p className={`text-xl font-black ${course.avg_mastery >= 75 ? 'text-leap-green' : course.avg_mastery >= 50 ? 'text-leap-amber' : 'text-leap-red'}`}>{course.avg_mastery}%</p><p className="text-[9px] text-gray-400">Avg Mastery</p></div>
            <div className="text-center"><p className="text-xl font-black text-leap-navy">{course.total_students}</p><p className="text-[9px] text-gray-400">Students</p></div>
            <div className="text-center"><p className="text-xl font-black text-leap-green">{onTrack}</p><p className="text-[9px] text-gray-400">On Track</p></div>
            <div className="text-center"><p className={`text-xl font-black ${course.students_at_risk > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{course.students_at_risk}</p><p className="text-[9px] text-gray-400">At Risk</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {([
          { key: 'assessment' as const, label: 'Assessment Data' },
          { key: 'students' as const, label: `Students (${course.students.length})` },
          { key: 'insights' as const, label: `Insights${courseSuggestions.length ? ` (${courseSuggestions.length})` : ''}` },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}>{t.label}</button>
        ))}
      </div>

      {/* Assessment Tab */}
      {tab === 'assessment' && (
        <div className="fade-in space-y-5">
          {/* Gate Overview Cards */}
          <div>
            <h2 className="section-header mb-3">Knowledge Gates</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {course.gates.map(gate => {
                const scores = course.students.map(s => s.gate_scores.find(g => g.gate_id === gate.id)?.mastery_pct || 0).filter(s => s > 0);
                const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                const atRisk = scores.filter(s => s < 60).length;
                return (
                  <button key={gate.id} onClick={() => setSelectedGate(selectedGate === gate.id ? null : gate.id)}
                    className={`card p-3 text-left transition-all hover:shadow-card-hover ${selectedGate === gate.id ? 'ring-2' : ''}`}
                    style={selectedGate === gate.id ? { borderColor: gate.color } : {}}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: gate.color }}>G{gate.gate_number}</div>
                      <p className="text-[10px] font-bold text-gray-700 truncate">{gate.short_title}</p>
                    </div>
                    <p className={`text-lg font-black ${avg >= 75 ? 'text-green-600' : avg >= 60 ? 'text-yellow-600' : avg > 0 ? 'text-red-600' : 'text-gray-300'}`}>{avg > 0 ? `${avg}%` : '—'}</p>
                    {atRisk > 0 && <p className="text-[9px] text-red-500 font-bold">{atRisk} at risk</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gate Detail (when selected) */}
          {selectedGate && bloomData && (
            <div className="card p-5 animate-slide-down">
              <h3 className="section-header mb-3">Student Performance — {course.gates.find(g => g.id === selectedGate)?.short_title}</h3>
              <div className="space-y-1.5">
                {bloomData.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-600 w-28 truncate">{s.name}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${s.mastery}%`,
                        background: s.mastery >= 75 ? '#10B981' : s.mastery >= 60 ? '#F59E0B' : '#EF4444',
                      }} />
                    </div>
                    <span className={`text-[11px] font-bold w-10 text-right ${s.mastery >= 75 ? 'text-green-600' : s.mastery >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{s.mastery}%</span>
                    <span className="text-[9px] text-gray-400 w-16">{s.bloom_ceiling}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Heatmap */}
          <div>
            <h2 className="section-header mb-3">Student × Gate Mastery Matrix</h2>
            {course.students.length > 0 && (
              <div className="card p-5 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr>
                    <th className="text-left py-2 pr-3 text-gray-400 font-bold text-[10px] w-32">Student</th>
                    {course.gates.map(g => <th key={g.id} className="text-center py-2 px-1 text-gray-400 font-bold text-[10px]" title={g.short_title}>G{g.gate_number}</th>)}
                    <th className="text-center py-2 pl-3 text-gray-400 font-bold text-[10px]">Avg</th>
                  </tr></thead>
                  <tbody>{course.students.sort((a, b) => b.avg_mastery - a.avg_mastery).map(student => (
                    <tr key={student.id} className="border-t border-gray-50">
                      <td className="py-1.5 pr-3"><div className="flex items-center gap-1.5">{student.at_risk && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}<span className={`font-medium ${student.at_risk ? 'text-red-700' : 'text-gray-700'}`}>{student.name}</span></div></td>
                      {course.gates.map(g => { const pct = student.gate_scores.find(s => s.gate_id === g.id)?.mastery_pct || 0; return <td key={g.id} className="text-center py-1.5 px-1"><span className="inline-block w-10 py-0.5 rounded-md text-[10px] font-bold" style={{ background: pct >= 75 ? '#D1FAE5' : pct >= 60 ? '#FEF3C7' : pct > 0 ? '#FEE2E2' : '#F3F4F6', color: pct >= 75 ? '#065F46' : pct >= 60 ? '#92400E' : pct > 0 ? '#991B1B' : '#9CA3AF' }}>{pct > 0 ? `${pct}%` : '—'}</span></td>; })}
                      <td className="text-center py-1.5 pl-3"><span className={`font-black ${student.avg_mastery >= 75 ? 'text-green-700' : student.avg_mastery >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>{student.avg_mastery}%</span></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="flex gap-2 mt-3 flex-wrap">{course.gates.map(g => <span key={g.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: g.color + '20', color: g.color }}>G{g.gate_number}: {g.short_title}</span>)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students Tab */}
      {tab === 'students' && (
        <div className="fade-in space-y-3">
          {course.students.sort((a, b) => a.avg_mastery - b.avg_mastery).map(student => (
            <div key={student.id} className={`card p-4 ${student.at_risk ? 'border-l-4 border-l-red-400' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white ${student.at_risk ? 'bg-red-500' : 'bg-leap-navy'}`}>{student.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{student.name}</p>
                    <p className="text-[10px] text-gray-400">{student.at_risk ? 'At Risk' : 'On Track'} — {student.avg_mastery}% avg mastery</p>
                  </div>
                </div>
                <span className={`text-lg font-black ${student.avg_mastery >= 75 ? 'text-green-600' : student.avg_mastery >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{student.avg_mastery}%</span>
              </div>
              <div className="flex gap-1.5">
                {student.gate_scores.map(gs => (
                  <div key={gs.gate_id} className="flex-1">
                    <div className="h-2 rounded-full" style={{ background: gs.mastery_pct >= 75 ? '#10B981' : gs.mastery_pct >= 60 ? '#F59E0B' : gs.mastery_pct > 0 ? '#EF4444' : '#E5E7EB' }} />
                    <p className="text-[8px] text-gray-400 text-center mt-0.5">G{gs.gate_number}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights Tab */}
      {tab === 'insights' && (
        <div className="fade-in space-y-3">
          {courseSuggestions.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No AI insights for this course yet</div>
          ) : courseSuggestions.map((s, i) => (
            <div key={i} className={`card p-4 border-l-4 ${s.severity === 'critical' ? 'border-l-red-500 bg-red-50/30' : s.severity === 'warning' ? 'border-l-amber-400 bg-amber-50/30' : s.severity === 'success' ? 'border-l-green-400 bg-green-50/30' : 'border-l-blue-400 bg-blue-50/30'}`}>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-2" style={{ background: s.severity === 'critical' ? '#FEE2E2' : s.severity === 'warning' ? '#FEF3C7' : s.severity === 'success' ? '#D1FAE5' : '#DBEAFE', color: s.severity === 'critical' ? '#991B1B' : s.severity === 'warning' ? '#92400E' : s.severity === 'success' ? '#065F46' : '#1E40AF' }}>{s.severity.toUpperCase()}</span>
              <p className="text-[12px] text-gray-800 leading-relaxed mt-1.5">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
