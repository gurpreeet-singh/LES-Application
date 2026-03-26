import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────

type AdminTab = 'today' | 'teachers';

interface Overview {
  total_teachers: number;
  total_courses: number;
  active_courses: number;
  total_students: number;
  at_risk_students: number;
  avg_mastery: number;
}

interface BriefingAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  teacher_id?: string;
  teacher_name?: string;
  course_id?: string;
  course_title?: string;
  actions?: { type: string; label: string }[];
}

interface Briefing {
  date: string;
  alerts: BriefingAlert[];
  positives: { id: string; title: string; message: string; teacher_name: string }[];
  summary: { critical_count: number; warning_count: number; info_count: number };
}

interface EffectivenessTeacher {
  id: string;
  full_name: string;
  email: string;
  avg_mastery: number;
  engagement_score: number;
  quadrant: 'star' | 'traditionalist' | 'striver' | 'needs_attention';
  total_courses: number;
  active_courses: number;
}

interface CourseSummary {
  id: string; title: string; subject: string; class_level?: string; section?: string;
  status: string; total_students: number; students_on_track: number; students_at_risk: number;
  avg_mastery: number; total_gates: number; accepted_gates: number; total_lessons: number;
  accepted_lessons: number; completion_pct: number;
}

interface TeacherSummary {
  id: string; full_name: string; email: string;
  stats: { total_courses: number; active_courses: number; total_students: number; students_at_risk: number; avg_mastery: number };
  courses: CourseSummary[];
}

interface GateScore { gate_id: string; gate_number: number; short_title: string; mastery_pct: number; bloom_ceiling: string | null }
interface StudentPerf { id: string; name: string; avg_mastery: number; at_risk: boolean; gate_scores: GateScore[] }
interface GateInfo { id: string; gate_number: number; short_title: string; color: string }
interface CourseDetail {
  id: string; title: string; subject: string; class_level?: string; section?: string; status: string;
  gates: GateInfo[]; students: StudentPerf[]; avg_mastery: number; total_students: number;
  students_at_risk: number; suggestions: any[];
}
interface TeacherDetail { teacher: any; courses: CourseDetail[]; suggestions: { type: string; severity: 'critical' | 'warning' | 'info' | 'success'; teacher: string; course: string; message: string }[] }

// ─── Main Component ──────────────────────────────────────────

export function AdminDashboardPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>('today');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [effectiveness, setEffectiveness] = useState<EffectivenessTeacher[]>([]);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<TeacherDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{ alert: BriefingAlert; action: { type: string; label: string } } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      api.get<Overview>('/admin/overview'),
      api.get<Briefing>('/admin/briefing'),
      api.get<{ teachers: EffectivenessTeacher[] }>('/admin/teacher-effectiveness'),
      api.get<{ teachers: TeacherSummary[] }>('/admin/teachers'),
    ]).then(([ov, br, eff, t]) => {
      setOverview(ov);
      setBriefing(br);
      setEffectiveness(eff.teachers);
      setTeachers(t.teachers);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadTeacherDetail = async (teacherId: string) => {
    if (expandedTeacher === teacherId) { setExpandedTeacher(null); setTeacherDetail(null); return; }
    setExpandedTeacher(teacherId);
    setDetailLoading(true);
    const detail = await api.get<TeacherDetail>(`/admin/teachers/${teacherId}`);
    setTeacherDetail(detail);
    setDetailLoading(false);
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActionSaving(true);
    try {
      await api.post('/admin/actions', {
        action_type: actionModal.action.type,
        target_teacher_id: actionModal.alert.teacher_id || null,
        target_course_id: actionModal.alert.course_id || null,
        note: actionNote || `${actionModal.action.label} for ${actionModal.alert.teacher_name || 'school'}`,
      });
    } catch { /* graceful — action logging is best-effort */ }
    setDismissedAlerts(prev => new Set(prev).add(actionModal.alert.id));
    setActionModal(null);
    setActionNote('');
    setActionSaving(false);
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
    api.post('/admin/actions', { action_type: 'acknowledge_alert', note: `Dismissed alert ${alertId}` }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-72 mb-4" />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="card p-4 h-24" />)}
        </div>
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="card p-5 h-32" />)}</div>
      </div>
    );
  }

  const visibleAlerts = briefing?.alerts.filter(a => !dismissedAlerts.has(a.id)) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Principal's Dashboard</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Welcome, {profile?.full_name} &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard icon="👩‍🏫" value={overview.total_teachers} label="Teachers" color="leap-navy" />
          <StatCard icon="📚" value={overview.total_courses} label="Total Courses" sub={`${overview.active_courses} active`} color="leap-blue" />
          <StatCard icon="🎓" value={overview.total_students} label="Students" color="leap-green" />
          <StatCard icon="📊" value={`${overview.avg_mastery}%`} label="Avg Mastery" color="leap-purple" />
          <StatCard icon="⚠️" value={overview.at_risk_students} label="At Risk" color="leap-amber" />
          <StatCard icon="✅" value={overview.total_students > 0 ? `${Math.round(((overview.total_students - overview.at_risk_students) / overview.total_students) * 100)}%` : '—'} label="On Track" color="leap-green" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {([
          { key: 'today' as const, label: 'Today', badge: visibleAlerts.filter(a => a.severity === 'critical').length },
          { key: 'teachers' as const, label: 'Teachers' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}
          >
            {t.label}
            {t.badge ? <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ═══ TODAY TAB ═══ */}
      {tab === 'today' && (
        <div className="fade-in space-y-5">
          {/* Morning Briefing */}
          {briefing && (
            <>
              {/* Alerts */}
              {visibleAlerts.length > 0 ? (
                <div>
                  <h2 className="section-header mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-leap-red inline-block" />
                    Needs Your Attention
                    <span className="text-[10px] font-bold text-gray-300 normal-case tracking-normal ml-1">
                      {briefing.summary.critical_count} critical &middot; {briefing.summary.warning_count} warnings
                    </span>
                  </h2>
                  <div className="space-y-2.5">
                    {visibleAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`card p-4 border-l-4 ${
                          alert.severity === 'critical' ? 'border-l-red-500 bg-red-50/30'
                          : alert.severity === 'warning' ? 'border-l-amber-400 bg-amber-50/30'
                          : 'border-l-blue-400 bg-blue-50/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                background: alert.severity === 'critical' ? '#FEE2E2' : alert.severity === 'warning' ? '#FEF3C7' : '#DBEAFE',
                                color: alert.severity === 'critical' ? '#991B1B' : alert.severity === 'warning' ? '#92400E' : '#1E40AF',
                              }}>
                                {alert.severity.toUpperCase()}
                              </span>
                              <span className="text-[12px] font-bold text-gray-900">{alert.title}</span>
                            </div>
                            <p className="text-[12px] text-gray-600 leading-relaxed">{alert.message}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {(alert.actions || []).map((action, i) => (
                              <button
                                key={i}
                                onClick={() => setActionModal({ alert, action })}
                                className="btn-primary text-[10px] py-1.5 px-3 whitespace-nowrap"
                              >
                                {action.label}
                              </button>
                            ))}
                            <button
                              onClick={() => dismissAlert(alert.id)}
                              className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100"
                              title="Dismiss"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card p-6 text-center bg-green-50/30 border-l-4 border-l-green-400">
                  <p className="text-sm font-bold text-green-800">All clear today</p>
                  <p className="text-[12px] text-green-600">No critical alerts. All handled or acknowledged.</p>
                </div>
              )}

              {/* Positives */}
              {briefing.positives.length > 0 && (
                <div>
                  <h2 className="section-header mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-leap-green inline-block" />
                    Wins &amp; Highlights
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {briefing.positives.map(p => (
                      <div key={p.id} className="card p-4 border-l-4 border-l-green-400 bg-green-50/20">
                        <p className="text-[12px] font-bold text-green-800 mb-1">{p.title}</p>
                        <p className="text-[11px] text-green-700 leading-relaxed">{p.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TEACHERS TAB ═══ */}
      {tab === 'teachers' && (
        <div className="fade-in space-y-6">
          {/* Teacher Effectiveness Quadrant */}
          {effectiveness.length > 0 && (
            <div>
              <h2 className="section-header mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-leap-purple inline-block" />
                Teacher Effectiveness Quadrant
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {(['star', 'traditionalist', 'striver', 'needs_attention'] as const).map(q => {
                  const qTeachers = effectiveness.filter(t => t.quadrant === q);
                  if (qTeachers.length === 0) return null;
                  const config = QUADRANT_CONFIG[q];
                  return (
                    <div key={q} className={`card p-4 border-l-4 ${config.borderClass}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{config.icon}</span>
                        <div>
                          <p className="text-[12px] font-black text-gray-900">{config.title}</p>
                          <p className="text-[9px] text-gray-400">{config.desc}</p>
                        </div>
                        <span className="ml-auto text-lg font-black text-gray-300">{qTeachers.length}</span>
                      </div>
                      <div className="space-y-2">
                        {qTeachers.map(t => (
                          <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-leap-navy text-white flex items-center justify-center text-[11px] font-bold">
                                {t.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-gray-800">{t.full_name}</p>
                                <p className="text-[9px] text-gray-400">{t.active_courses} active course{t.active_courses !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <div className="text-center">
                                <p className={`text-[12px] font-black ${t.avg_mastery >= 75 ? 'text-green-600' : t.avg_mastery >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {t.avg_mastery}%
                                </p>
                                <p className="text-[8px] text-gray-400">Mastery</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-[12px] font-black ${t.engagement_score >= 60 ? 'text-blue-600' : t.engagement_score >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                  {t.engagement_score}%
                                </p>
                                <p className="text-[8px] text-gray-400">Engagement</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {config.action && (
                        <p className="text-[10px] text-gray-400 mt-2 italic">{config.action}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Teacher List with Drill-down (existing) */}
          <div>
            <h2 className="section-header mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leap-navy inline-block" />
              All Teachers — Detailed View
            </h2>
            {teachers.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">No teachers found</div>
            ) : (
              <div className="space-y-3">
                {teachers.map(teacher => (
                  <div key={teacher.id}>
                    <button
                      onClick={() => loadTeacherDetail(teacher.id)}
                      className={`w-full card p-5 text-left transition-all hover:shadow-card-hover ${expandedTeacher === teacher.id ? 'ring-2 ring-leap-navy' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-leap-navy text-white flex items-center justify-center text-lg font-bold">
                            {teacher.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{teacher.full_name}</p>
                            <p className="text-[11px] text-gray-400">{teacher.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <MiniStat label="Courses" value={teacher.stats.total_courses} sub={`${teacher.stats.active_courses} active`} />
                          <MiniStat label="Students" value={teacher.stats.total_students} />
                          <MiniStat label="Avg Mastery" value={`${teacher.stats.avg_mastery}%`} color={teacher.stats.avg_mastery >= 75 ? 'text-green-600' : teacher.stats.avg_mastery >= 50 ? 'text-yellow-600' : 'text-red-600'} />
                          <MiniStat label="At Risk" value={teacher.stats.students_at_risk} color={teacher.stats.students_at_risk > 0 ? 'text-red-600' : 'text-green-600'} />
                          <div className="flex gap-1.5">
                            {teacher.courses.map(c => (
                              <span key={c.id} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'review' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                {c.class_level}{c.section || ''} {c.subject?.slice(0, 4)}
                              </span>
                            ))}
                          </div>
                          <span className={`text-gray-400 transition-transform ${expandedTeacher === teacher.id ? 'rotate-180' : ''}`}>&#9660;</span>
                        </div>
                      </div>
                    </button>
                    {expandedTeacher === teacher.id && (
                      <div className="mt-2 animate-slide-down">
                        {detailLoading ? (
                          <div className="card p-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
                            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
                          </div>
                        ) : teacherDetail ? <TeacherDetailPanel detail={teacherDetail} /> : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-gray-900 mb-1">{actionModal.action.label}</h3>
            <p className="text-[12px] text-gray-500 mb-4">
              {actionModal.alert.teacher_name && `For ${actionModal.alert.teacher_name}`}
              {actionModal.alert.course_title && ` — ${actionModal.alert.course_title}`}
            </p>
            <textarea
              value={actionNote}
              onChange={e => setActionNote(e.target.value)}
              placeholder="Add a note (optional)..."
              className="input-field mb-4 h-24 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActionModal(null)} className="btn-secondary text-[12px]">Cancel</button>
              <button onClick={handleAction} disabled={actionSaving} className="btn-primary text-[12px]">
                {actionSaving ? 'Saving...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────

const QUADRANT_CONFIG: Record<string, { title: string; desc: string; icon: string; borderClass: string; action?: string }> = {
  star: {
    title: 'Stars',
    desc: 'High mastery, high engagement',
    icon: '⭐',
    borderClass: 'border-l-green-400',
    action: 'Consider asking these teachers to mentor others',
  },
  traditionalist: {
    title: 'Effective Traditionalists',
    desc: 'High mastery, low platform engagement',
    icon: '📖',
    borderClass: 'border-l-blue-400',
    action: 'Great results — a gentle nudge to explore AI tools could amplify their impact',
  },
  striver: {
    title: 'Engaged Strivers',
    desc: 'Low mastery, high engagement',
    icon: '🔧',
    borderClass: 'border-l-amber-400',
    action: 'These teachers are trying hard — they need pedagogical support, not tech training',
  },
  needs_attention: {
    title: 'Needs Attention',
    desc: 'Low mastery, low engagement',
    icon: '🔴',
    borderClass: 'border-l-red-400',
    action: 'Priority: schedule a 1-on-1 to understand barriers and offer support',
  },
};

// ─── Sub-components ──────────────────────────────────────────

function StatCard({ icon, value, label, sub, color }: { icon: string; value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center text-lg`}>{icon}</div>
        <div>
          <p className={`text-2xl font-black text-${color}`}>{value}</p>
          <p className="text-[11px] text-gray-500">{label}</p>
          {sub && <p className="text-[9px] text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <p className={`text-lg font-black ${color || 'text-gray-900'}`}>{value}</p>
      <p className="text-[9px] text-gray-400">{label}</p>
      {sub && <p className="text-[8px] text-gray-300">{sub}</p>}
    </div>
  );
}

function TeacherDetailPanel({ detail }: { detail: TeacherDetail }) {
  const [activeCourse, setActiveCourse] = useState(0);
  return (
    <div className="card p-0 overflow-hidden border-leap-navy/20">
      {detail.suggestions.length > 0 && (
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50/50 to-white">
          <h3 className="section-header mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-leap-amber inline-block" />
            Suggestions for {detail.teacher.full_name}
          </h3>
          <div className="space-y-2">
            {detail.suggestions.map((s, i) => (
              <div key={i} className={`p-3 rounded-xl text-[12px] leading-relaxed border ${s.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : s.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : s.severity === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                <span className="font-bold mr-1.5">{s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : s.severity === 'success' ? '🟢' : '🔵'}</span>
                {s.message}
              </div>
            ))}
          </div>
        </div>
      )}
      {detail.courses.length > 1 && (
        <div className="px-5 pt-4 flex gap-1.5">
          {detail.courses.map((c, i) => (
            <button key={c.id} onClick={() => setActiveCourse(i)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${i === activeCourse ? 'bg-leap-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {c.title}
            </button>
          ))}
        </div>
      )}
      {detail.courses.length > 0 && <CourseAnalyticsPanel course={detail.courses[activeCourse]} />}
    </div>
  );
}

function CourseAnalyticsPanel({ course }: { course: CourseDetail }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{course.title}</h3>
          <p className="text-[11px] text-gray-400">
            {course.subject} {course.class_level && `| Class ${course.class_level}${course.section || ''}`} |{' '}
            <span className={`font-bold ${course.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>{course.status}</span>
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-center"><p className={`text-lg font-black ${course.avg_mastery >= 75 ? 'text-leap-green' : course.avg_mastery >= 50 ? 'text-leap-amber' : 'text-leap-red'}`}>{course.avg_mastery}%</p><p className="text-[9px] text-gray-400">Avg Mastery</p></div>
          <div className="text-center"><p className="text-lg font-black text-leap-navy">{course.total_students}</p><p className="text-[9px] text-gray-400">Students</p></div>
          <div className="text-center"><p className={`text-lg font-black ${course.students_at_risk > 0 ? 'text-leap-red' : 'text-leap-green'}`}>{course.students_at_risk}</p><p className="text-[9px] text-gray-400">At Risk</p></div>
        </div>
      </div>
      {course.students.length > 0 && course.gates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-gray-400 font-bold text-[10px] w-36">Student</th>
                {course.gates.map(g => (<th key={g.id} className="text-center py-2 px-1 text-gray-400 font-bold text-[10px]" title={g.short_title}>G{g.gate_number}</th>))}
                <th className="text-center py-2 pl-3 text-gray-400 font-bold text-[10px]">Avg</th>
              </tr>
            </thead>
            <tbody>
              {course.students.sort((a, b) => b.avg_mastery - a.avg_mastery).map(student => (
                <tr key={student.id} className="border-t border-gray-50">
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      {student.at_risk && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                      <span className={`font-medium ${student.at_risk ? 'text-red-700' : 'text-gray-700'}`}>{student.name}</span>
                    </div>
                  </td>
                  {course.gates.map(gate => {
                    const pct = student.gate_scores.find(s => s.gate_id === gate.id)?.mastery_pct || 0;
                    return (
                      <td key={gate.id} className="text-center py-1.5 px-1">
                        <span className="inline-block w-10 py-0.5 rounded-md text-[10px] font-bold" style={{
                          background: pct >= 75 ? '#D1FAE5' : pct >= 60 ? '#FEF3C7' : pct > 0 ? '#FEE2E2' : '#F3F4F6',
                          color: pct >= 75 ? '#065F46' : pct >= 60 ? '#92400E' : pct > 0 ? '#991B1B' : '#9CA3AF',
                        }}>{pct > 0 ? `${pct}%` : '—'}</span>
                      </td>
                    );
                  })}
                  <td className="text-center py-1.5 pl-3">
                    <span className={`font-black ${student.avg_mastery >= 75 ? 'text-green-700' : student.avg_mastery >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>{student.avg_mastery}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 mt-3 flex-wrap">
            {course.gates.map(g => (<span key={g.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: g.color + '20', color: g.color }}>G{g.gate_number}: {g.short_title}</span>))}
          </div>
        </div>
      )}
      {course.students.length === 0 && <div className="text-center py-6 text-gray-400 text-sm">No student data available for this course</div>}
    </div>
  );
}
