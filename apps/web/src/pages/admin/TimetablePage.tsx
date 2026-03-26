import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface PeriodSlot {
  teacher_id: string; teacher_name: string; subject: string;
  class_level: string; section: string; status: 'normal' | 'absent' | 'substituted';
  course_id: string; lesson_title: string;
}

interface Period {
  period: number; start: string; end: string;
  slots: PeriodSlot[];
}

interface AffectedPeriod {
  period_number: number; subject: string; class_level: string; section: string;
  course_id: string; lesson_title: string; lesson_objective: string;
}

interface SubSuggestion {
  teacher_id: string; teacher_name: string; score: number; confidence: number;
  reasons: string[]; free_periods: number[]; same_subject: boolean; avg_mastery: number;
}

interface AbsentTeacher {
  id: string; name: string; email: string; reason: string;
  affected_periods: AffectedPeriod[];
  suggestions: SubSuggestion[];
}

interface TimetableData {
  date: string; day_name: string; day_of_week: number;
  periods: Period[]; absent_teachers: AbsentTeacher[];
  stats: { total_periods: number; covered: number; uncovered: number; teachers_present: number; teachers_absent: number; total_teachers: number };
}

const CLASS_OPTIONS = ['All Classes', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function TimetablePage() {
  const [data, setData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAbsent, setSelectedAbsent] = useState<string | null>(null);
  const [assignedSubs, setAssignedSubs] = useState<Record<string, string>>({});
  const [classFilter, setClassFilter] = useState('All Classes');

  useEffect(() => {
    api.get<TimetableData>('/admin/timetable/today').then(d => {
      setData(d);
      if (d.absent_teachers.length > 0) setSelectedAbsent(d.absent_teachers[0].id);
      setLoading(false);
    });
  }, []);

  if (loading || !data) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48 mb-4" /><div className="card p-6 h-64" /><div className="card p-6 h-96" /></div>;

  const assignSubstitute = (absentId: string, subId: string, subName: string) => {
    setAssignedSubs(prev => ({ ...prev, [absentId]: subName }));
    api.post('/admin/actions', { action_type: 'assign_mentor', target_teacher_id: subId, note: `Assigned as substitute for absent teacher` }).catch(() => {});
  };

  // Filter periods by class
  const filteredPeriods = data.periods.map(p => ({
    ...p,
    slots: classFilter === 'All Classes' ? p.slots : p.slots.filter(s => s.class_level === classFilter),
  }));

  // Get unique classes present in the timetable
  const allClasses = [...new Set(data.periods.flatMap(p => p.slots.map(s => s.class_level)))].sort((a, b) => Number(a) - Number(b));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Timetable — {data.day_name}</h1>
          <p className="text-[12px] text-gray-400">{new Date(data.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        {/* Class Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-gray-500">Class:</label>
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="input-field py-1.5 px-3 text-[12px] w-40"
          >
            <option>All Classes</option>
            {allClasses.map(c => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        <div className="card p-3 text-center"><p className="text-xl font-black text-leap-navy">{data.stats.total_periods}</p><p className="text-[9px] text-gray-400">Total Periods</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-black text-leap-green">{data.stats.covered}</p><p className="text-[9px] text-gray-400">Covered</p></div>
        <div className="card p-3 text-center"><p className={`text-xl font-black ${data.stats.uncovered > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{data.stats.uncovered}</p><p className="text-[9px] text-gray-400">Uncovered</p></div>
        <div className="card p-3 text-center"><p className="text-xl font-black text-leap-blue">{data.stats.teachers_present}</p><p className="text-[9px] text-gray-400">Present</p></div>
        <div className="card p-3 text-center"><p className={`text-xl font-black ${data.stats.teachers_absent > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{data.stats.teachers_absent}</p><p className="text-[9px] text-gray-400">Absent</p></div>
        <div className="card p-3 text-center">
          <p className="text-xl font-black text-leap-purple">{data.stats.total_periods > 0 ? Math.round((data.stats.covered / data.stats.total_periods) * 100) : 100}%</p>
          <p className="text-[9px] text-gray-400">Coverage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Period Grid (2/3 width) */}
        <div className="lg:col-span-2">
          <h2 className="section-header mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-leap-navy inline-block" />
            {classFilter === 'All Classes' ? "Today's Schedule — All Classes" : `Class ${classFilter} Schedule`}
          </h2>
          <div className="space-y-2">
            {filteredPeriods.map(period => (
              <div key={period.period} className="card p-0 overflow-hidden">
                <div className="flex">
                  <div className="w-20 bg-gray-50 p-3 flex flex-col items-center justify-center border-r border-gray-100 flex-shrink-0">
                    <p className="text-sm font-black text-leap-navy">P{period.period}</p>
                    <p className="text-[9px] text-gray-400">{period.start}</p>
                    <p className="text-[9px] text-gray-400">{period.end}</p>
                  </div>
                  <div className="flex-1 p-2 flex gap-2 flex-wrap">
                    {period.slots.length === 0 ? (
                      <p className="text-[11px] text-gray-300 p-2">No classes scheduled</p>
                    ) : period.slots.map((slot, i) => (
                      <div key={i} className={`px-3 py-2 rounded-xl text-[11px] border ${
                        slot.status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                      }`} style={{ minWidth: '150px' }}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            {slot.status === 'absent' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                            <span className={`font-bold ${slot.status === 'absent' ? 'text-red-700 line-through' : 'text-gray-800'}`}>{slot.teacher_name}</span>
                          </div>
                          <span className="text-[9px] font-bold bg-leap-navy/10 text-leap-navy px-1.5 py-0.5 rounded">{slot.class_level}{slot.section}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium">{slot.subject}</p>
                        <p className="text-[9px] text-gray-400 truncate">{slot.lesson_title}</p>
                        {slot.status === 'absent' && assignedSubs[slot.teacher_id] && (
                          <p className="text-[10px] text-green-700 font-bold mt-1">Sub: {assignedSubs[slot.teacher_id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Absent Teachers + Substitute Panel (1/3 width) */}
        <div>
          <h2 className="section-header mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-leap-red inline-block" />
            Absent Teachers ({data.absent_teachers.length})
          </h2>

          {data.absent_teachers.length === 0 ? (
            <div className="card p-6 text-center bg-green-50/30">
              <p className="text-sm font-bold text-green-700">All teachers present today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Absent Teacher Tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {data.absent_teachers.map(at => (
                  <button key={at.id} onClick={() => setSelectedAbsent(at.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${selectedAbsent === at.id ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                    {at.name}
                  </button>
                ))}
              </div>

              {/* Selected Absent Teacher Detail */}
              {data.absent_teachers.filter(at => at.id === selectedAbsent).map(absent => (
                <div key={absent.id} className="space-y-3">
                  {/* Info Card */}
                  <div className="card p-4 border-l-4 border-l-red-400 bg-red-50/20">
                    <p className="text-sm font-bold text-gray-900">{absent.name}</p>
                    <p className="text-[10px] text-gray-400">{absent.email}</p>
                    <p className="text-[11px] text-red-600 font-medium mt-1">{absent.reason}</p>
                  </div>

                  {/* Classes & Subjects Affected */}
                  <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50/20">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">Classes &amp; Subjects to Cover</p>
                    <div className="space-y-2">
                      {absent.affected_periods.map(p => (
                        <div key={p.period_number} className="flex items-start gap-3 bg-white/60 rounded-xl p-2.5 border border-amber-100">
                          <div className="w-10 h-10 rounded-lg bg-leap-navy/10 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-black text-leap-navy">P{p.period_number}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold bg-leap-navy text-white px-2 py-0.5 rounded">Class {p.class_level}{p.section}</span>
                              <span className="text-[11px] font-bold text-gray-800">{p.subject}</span>
                            </div>
                            <p className="text-[11px] text-gray-700">{p.lesson_title}</p>
                            {p.lesson_objective && <p className="text-[9px] text-gray-400 mt-0.5">{p.lesson_objective}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Substitute Suggestions */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">AI Substitute Suggestions</p>
                    {(absent.suggestions || []).length === 0 ? (
                      <div className="card p-4 text-center text-[12px] text-gray-400">No suitable substitutes found</div>
                    ) : (absent.suggestions || []).map((sub, i) => (
                      <div key={sub.teacher_id} className={`card p-4 mb-2 transition-all ${i === 0 ? 'ring-2 ring-green-300 bg-green-50/20' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${i === 0 ? 'bg-green-600' : 'bg-gray-400'}`}>
                              {i === 0 ? '★' : `#${i + 1}`}
                            </div>
                            <div>
                              <Link to={`/admin/teachers/${sub.teacher_id}`} className="text-[12px] font-bold text-gray-900 hover:text-leap-blue">{sub.teacher_name}</Link>
                              <p className="text-[9px] text-gray-400">Confidence: {Math.round(sub.confidence * 100)}%</p>
                            </div>
                          </div>
                          {!assignedSubs[absent.id] ? (
                            <button onClick={() => assignSubstitute(absent.id, sub.teacher_id, sub.teacher_name)}
                              className={`text-[10px] py-1.5 px-3 rounded-xl font-bold ${i === 0 ? 'btn-primary' : 'btn-secondary'}`}>
                              Assign
                            </button>
                          ) : assignedSubs[absent.id] === sub.teacher_name ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-3 py-1.5 rounded-xl">Assigned</span>
                          ) : null}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {sub.reasons.map((r, ri) => (
                            <span key={ri} className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${sub.same_subject && ri === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {r}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-[9px] text-gray-400">Mastery: <strong className={sub.avg_mastery >= 65 ? 'text-green-600' : 'text-yellow-600'}>{sub.avg_mastery}%</strong></span>
                          <span className="text-[9px] text-gray-400">Free periods: <strong>{sub.free_periods.join(', ')}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
