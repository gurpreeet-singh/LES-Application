import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBarSVG } from '../../components/shared/BloomBarSVG';
import { BloomRadar } from '../../components/shared/BloomRadar';
import { VelocitySVG } from '../../components/shared/VelocitySVG';
import { KGCircleNodes } from '../../components/shared/KGCircleNodes';
import { getMasteryColor } from '../../lib/utils';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import type { HeatmapData, BloomDistribution, DependencyRisk, AISuggestion, Course } from '@les/shared';

type AnalyticsTab = 'overview' | 'sessions' | 'students' | 'ai_guide';

interface AdaptiveSuggestion {
  id: string;
  type: string;
  priority: string;
  affects_sessions: number[];
  title: string;
  reason: string;
  affected_students?: string[];
  current: any;
  proposed: any;
  status: string;
  teacher_notes: string | null;
}

interface AdaptiveData {
  analysis_based_on: string;
  generated_at: string;
  current_session: number;
  suggestions: AdaptiveSuggestion[];
  history: { id: string; type: string; title: string; status: string; resolved_at: string; outcome: string }[];
}

interface SessionData {
  session_number: number;
  lesson_id: string;
  lesson_title: string;
  gate_id: string;
  gate_number: number;
  gate_color: string;
  gate_short_title: string;
  status: string;
  avg_quiz_score: number;
  students_attempted: number;
  students_passed: number;
  student_scores: { student_id: string; student_name: string; score: number }[];
}

interface GateStatus {
  gate_id: string;
  gate_number: number;
  short_title: string;
  title: string;
  color: string;
  light_color: string;
  status: string;
  sessions_in_gate: number;
  completed_sessions: number;
}

interface SessionAnalytics {
  current_session: number;
  total_sessions: number;
  completed_sessions: number;
  sessions: SessionData[];
  gates_status: GateStatus[];
  course_stats: {
    overall_completion_pct: number;
    avg_mastery: number;
    total_quizzes_completed: number;
    total_quizzes_possible: number;
    students_on_track: number;
    students_at_risk: number;
  };
}

export function ClassAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [course, setCourse] = useState<Course | null>(null);
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [selGate, setSelGate] = useState<string>('');
  const [bloomDist, setBloomDist] = useState<BloomDistribution | null>(null);
  const [risks, setRisks] = useState<DependencyRisk[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ course: Course }>(`/courses/${courseId}`),
      api.get<SessionAnalytics>(`/courses/${courseId}/analytics/sessions`),
      api.get<HeatmapData>(`/courses/${courseId}/analytics/heatmap`),
      api.get<{ risks: DependencyRisk[] }>(`/courses/${courseId}/analytics/dependency-risk`),
      api.get<{ suggestions: AISuggestion[] }>(`/courses/${courseId}/suggestions`),
      api.get<{ students: any[] }>(`/courses/${courseId}/analytics/attention`),
      api.get<AdaptiveData>(`/courses/${courseId}/suggestions/adaptive`),
    ]).then(([c, sa, h, r, s, a, ad]) => {
      setCourse(c.course);
      setSessionAnalytics(sa);
      setHeatmap(h);
      setRisks(r.risks);
      setSuggestions(s.suggestions);
      setAttention(a.students);
      setAdaptiveData(ad);
      if (h.gates.length > 0) setSelGate(h.gates[0].id);
      setLoading(false);
    });
  }, [courseId]);

  useEffect(() => {
    if (selGate) {
      api.get<BloomDistribution>(`/courses/${courseId}/analytics/bloom-dist/${selGate}`).then(setBloomDist);
    }
  }, [selGate, courseId]);

  const resolveSuggestion = async (id: string, status: string) => {
    const { suggestion } = await api.put<{ suggestion: AISuggestion }>(`/courses/${courseId}/suggestions/${id}`, { status });
    setSuggestions(prev => prev.map(s => s.id === id ? suggestion : s));
  };

  const resolveAdaptive = async (id: string, status: string, notes?: string) => {
    await api.put(`/courses/${courseId}/suggestions/adaptive/${id}`, { status, teacher_notes: notes });
    setAdaptiveData(prev => prev ? { ...prev, suggestions: prev.suggestions.map(s => s.id === id ? { ...s, status, teacher_notes: notes || s.teacher_notes } : s) } : prev);
  };

  const applyAllAccepted = async () => {
    const result = await api.post<{ applied: number; message: string }>(`/courses/${courseId}/suggestions/apply-all`);
    setAdaptiveData(prev => prev ? { ...prev, suggestions: prev.suggestions.map(s => s.status === 'accepted' ? { ...s, status: 'applied' } : s) } : prev);
    alert(result.message);
  };

  const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
    topic_shift: { icon: '🔄', label: 'Topic Shift', color: '#DC2626' },
    socratic_update: { icon: '💬', label: 'Socratic Update', color: '#7C3AED' },
    quiz_adjust: { icon: '📝', label: 'Quiz Adjustment', color: '#2E75B6' },
    add_remediation: { icon: '🩹', label: 'Remediation', color: '#B45309' },
    peer_teaching: { icon: '🤝', label: 'Peer Teaching', color: '#1E7E34' },
    pace_change: { icon: '⏱️', label: 'Pace Change', color: '#1B3A6B' },
    bloom_focus: { icon: '🧠', label: 'Bloom Focus', color: '#7C3AED' },
  };

  if (loading || !sessionAnalytics || !heatmap) return <SkeletonPage />;

  const sa = sessionAnalytics;
  const stats = sa.course_stats;

  const pendingSuggestions = adaptiveData?.suggestions.filter(s => s.status === 'pending').length || 0;
  const acceptedSuggestions = adaptiveData?.suggestions.filter(s => s.status === 'accepted').length || 0;

  const analyticsTabs = [
    { key: 'overview' as const, label: 'Course Overview' },
    { key: 'sessions' as const, label: `Sessions (${sa.completed_sessions}/${sa.total_sessions})` },
    { key: 'students' as const, label: `Students (${heatmap.students.length})` },
    { key: 'ai_guide' as const, label: `AI Guide${pendingSuggestions > 0 ? ` (${pendingSuggestions})` : ''}` },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link to={`/teacher/courses/${courseId}/detail`} className="text-[12px] text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Course</Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900">{course?.title} - Analytics</h1>
            <p className="text-[12px] text-gray-400">{heatmap.students.length} students | Session {sa.current_session} of {sa.total_sessions}</p>
          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="flex gap-1 mb-6">
        {analyticsTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB 1: COURSE OVERVIEW ===================== */}
      {tab === 'overview' && (
        <div className="fade-in space-y-5">
          {/* Course Progress Bar */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-header">Course Progress</h3>
              <span className="text-lg font-black text-les-navy">{stats.overall_completion_pct}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-les-blue to-les-navy h-full rounded-full transition-all duration-500" style={{ width: `${stats.overall_completion_pct}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Session {sa.current_session} of {sa.total_sessions} | {sa.completed_sessions} completed</p>
          </div>

          {/* Summary Stats with explanations */}
          <div className="grid grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-2xl font-black text-les-navy">{stats.avg_mastery}%</p>
              <p className="text-[11px] font-bold text-gray-700">Avg Mastery</p>
              <p className="text-[10px] text-gray-400 mt-1">Average quiz score across all completed sessions and students</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-les-green">{stats.total_quizzes_completed}<span className="text-sm text-gray-400 font-normal">/{stats.total_quizzes_possible}</span></p>
              <p className="text-[11px] font-bold text-gray-700">Quizzes Completed</p>
              <p className="text-[10px] text-gray-400 mt-1">Total quiz attempts by all students across completed sessions</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-les-blue">{stats.students_on_track}</p>
              <p className="text-[11px] font-bold text-gray-700">Students On Track</p>
              <p className="text-[10px] text-gray-400 mt-1">Students scoring above 75% mastery threshold consistently</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-les-red">{stats.students_at_risk}</p>
              <p className="text-[11px] font-bold text-gray-700">At Risk</p>
              <p className="text-[10px] text-gray-400 mt-1">Students below 60% in any active gate — need immediate attention</p>
            </div>
          </div>

          {/* Gate Status Cards */}
          <div>
            <h3 className="section-header mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-les-blue inline-block" />
              Gate Progress
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {sa.gates_status.map(g => (
                <div key={g.gate_id} className="card p-4" style={g.status === 'locked' ? { opacity: 0.5 } : {}}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: g.color }}>G{g.gate_number}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{g.short_title}</p>
                        <p className="text-[10px] text-gray-500">{g.completed_sessions}/{g.sessions_in_gate} sessions</p>
                      </div>
                    </div>
                    <span className={`badge ${
                      g.status === 'completed' ? 'bg-green-100 text-green-700' :
                      g.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      g.status === 'unlocked' ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {g.status === 'locked' ? '🔒 ' : ''}{g.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(g.completed_sessions / g.sessions_in_gate) * 100}%`, background: g.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mastery Heatmap */}
          <div className="card p-4">
            <h3 className="section-header mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-les-purple inline-block" />
              Student x Gate Mastery
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="text-left py-1 pr-2 text-[10px] text-gray-400 font-medium">Student</th>
                    {heatmap.gates.map(g => (
                      <th key={g.id} className="text-center py-1 px-1">
                        <div className="w-6 h-6 rounded-full mx-auto flex items-center justify-center text-white text-[9px] font-bold" style={{ background: g.color }}>{g.gate_number}</div>
                      </th>
                    ))}
                    <th className="text-center py-1 px-1 text-[10px] text-gray-400">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.students.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{s.name.charAt(0)}</div>
                          <span className="font-medium text-gray-700 text-[12px]">{s.name}</span>
                        </div>
                      </td>
                      {s.gate_scores.map(gs => {
                        const mc = getMasteryColor(gs.mastery_pct);
                        return (
                          <td key={gs.gate_id} className="text-center py-1.5 px-1">
                            <span className="inline-flex items-center justify-center w-12 h-7 rounded-md text-[11px] font-bold" style={{ background: mc.bg, color: mc.txt }}>
                              {gs.mastery_pct > 0 ? `${gs.mastery_pct}%` : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center py-1.5 px-1"><span className="text-[12px] font-bold text-gray-600">{s.average}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SESSION VIEW ===================== */}
      {tab === 'sessions' && (
        <div className="fade-in space-y-2">
          {/* Current session indicator */}
          <div className="card p-4 bg-les-navy/5 border-les-navy/20 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="badge bg-les-navy text-white text-[11px] px-3 py-1">NOW</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Session {sa.current_session}: {sa.sessions.find(s => s.session_number === sa.current_session)?.lesson_title}</p>
                  <p className="text-[11px] text-gray-500">Currently in progress</p>
                </div>
              </div>
              <span className="text-les-navy font-black text-lg">{sa.current_session}/{sa.total_sessions}</span>
            </div>
          </div>

          {/* Session list */}
          {sa.sessions.map(session => {
            const isExpanded = expandedSession === session.session_number;
            const isCurrent = session.session_number === sa.current_session;

            return (
              <div key={session.session_number} className={`card overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-les-navy/30' : ''}`}>
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : session.session_number)}
                  className="w-full text-left p-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black ${
                      session.status === 'completed' ? 'bg-green-100 text-green-700' :
                      session.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {session.status === 'completed' ? '✓' : session.session_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{session.lesson_title}</span>
                        {isCurrent && <span className="badge bg-blue-100 text-blue-700 text-[9px]">IN PROGRESS</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold" style={{ color: session.gate_color }}>G{session.gate_number}</span>
                        <span className="text-[10px] text-gray-400">Session {session.session_number}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {session.status === 'completed' && (
                      <>
                        <div className="text-right">
                          <p className="text-sm font-black" style={{ color: session.avg_quiz_score >= 75 ? '#1E7E34' : session.avg_quiz_score >= 60 ? '#B45309' : '#DC2626' }}>
                            {session.avg_quiz_score}%
                          </p>
                          <p className="text-[10px] text-gray-400">{session.students_passed}/{session.students_attempted} passed</p>
                        </div>
                      </>
                    )}
                    {session.status === 'upcoming' && <span className="text-[10px] text-gray-400">Upcoming</span>}
                    <span className="text-gray-400 text-sm transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
                  </div>
                </button>

                {/* Expanded: per-student scores */}
                {isExpanded && session.status === 'completed' && session.student_scores.length > 0 && (
                  <div className="animate-slide-down border-t border-gray-100 p-4">
                    <h4 className="section-header mb-2">Student Scores — Session {session.session_number}</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {session.student_scores.map(ss => {
                        const mc = getMasteryColor(ss.score);
                        return (
                          <div key={ss.student_id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">{ss.student_name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-gray-700 truncate">{ss.student_name}</p>
                            </div>
                            <span className="text-[12px] font-black" style={{ color: mc.txt }}>{ss.score}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isExpanded && session.status !== 'completed' && (
                  <div className="animate-slide-down border-t border-gray-100 p-4 text-center text-[12px] text-gray-400">
                    {session.status === 'in_progress' ? 'Session in progress — scores available after completion' : 'Session not yet started'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== TAB 3: STUDENT PERFORMANCE ===================== */}
      {tab === 'students' && (
        <div className="fade-in">
          <div className="grid grid-cols-3 gap-5">
            {/* Left: Heatmap + Bloom */}
            <div className="col-span-2 space-y-5">
              {/* Gate selector */}
              <div className="card p-4">
                <h3 className="section-header mb-3">Select Gate for Bloom Analysis</h3>
                <div className="flex gap-2 flex-wrap">
                  {heatmap.gates.map(g => (
                    <button key={g.id} onClick={() => setSelGate(g.id)}
                      className={`flex-1 min-w-[100px] p-2 rounded-xl border-2 transition-all text-left ${selGate === g.id ? '' : 'border-gray-200 bg-gray-50'}`}
                      style={selGate === g.id ? { borderColor: g.color, background: `${g.color}10` } : {}}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">G{g.gate_number}</span>
                        <span className="text-sm font-black" style={{ color: g.color }}>{g.avg}%</span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">{g.short_title}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Heatmap */}
              <div className="card p-4">
                <h3 className="section-header mb-3">Student x Gate Mastery</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
                    <thead>
                      <tr>
                        <th className="text-left py-1 pr-2 text-[10px] text-gray-400">Student</th>
                        {heatmap.gates.map(g => (
                          <th key={g.id} className="text-center py-1 px-1" style={selGate === g.id ? { borderBottom: `2px solid ${g.color}` } : {}}>
                            <div className="w-6 h-6 rounded-full mx-auto flex items-center justify-center text-white text-[9px] font-bold" style={{ background: g.color }}>{g.gate_number}</div>
                          </th>
                        ))}
                        <th className="text-center py-1 text-[10px] text-gray-400">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.students.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="py-1.5 pr-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold">{s.name.charAt(0)}</div>
                              <span className="text-[12px] font-medium text-gray-700">{s.name}</span>
                            </div>
                          </td>
                          {s.gate_scores.map(gs => {
                            const mc = getMasteryColor(gs.mastery_pct);
                            return (
                              <td key={gs.gate_id} className="text-center py-1.5 px-1">
                                <span className="inline-flex items-center justify-center w-12 h-7 rounded-md text-[11px] font-bold" style={{ background: mc.bg, color: mc.txt }}>
                                  {gs.mastery_pct > 0 ? `${gs.mastery_pct}%` : '—'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center py-1.5"><span className="text-[12px] font-bold text-gray-600">{s.average}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Knowledge Graph with Mastery */}
              <div className="card p-4">
                <h3 className="section-header mb-3">Knowledge Graph — Class Mastery</h3>
                <KGCircleNodes
                  gates={heatmap.gates.map(g => ({ ...g, id: g.id, light_color: g.color + '20', sub_concepts: [] }))}
                  showMastery
                  masteryData={Object.fromEntries(heatmap.gates.map(g => [g.id, g.avg]))}
                  onSelectGate={(g) => setSelGate(g.id)}
                  selectedGateId={selGate}
                />
              </div>

              {/* Bloom Distribution */}
              {bloomDist && (
                <div className="card p-4">
                  <h3 className="section-header mb-3">Bloom Distribution — {heatmap.gates.find(g => g.id === selGate)?.short_title}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <BloomBarSVG data={bloomDist.levels.map(l => ({ level: l.level.charAt(0).toUpperCase() + l.level.slice(1), pct: l.pct }))} />
                    </div>
                    <div className="flex items-center justify-center">
                      <BloomRadar
                        data={Object.fromEntries(bloomDist.levels.map(l => [l.level.charAt(0).toUpperCase() + l.level.slice(1), l.pct]))}
                        color={heatmap.gates.find(g => g.id === selGate)?.color || '#2E75B6'}
                        size={180}
                      />
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">{bloomDist.gap_analysis}</div>
                </div>
              )}

              {/* Learning Velocity */}
              <div className="card p-4">
                <h3 className="section-header mb-3">Class Learning Velocity</h3>
                <p className="text-[11px] text-gray-500 mb-3">Average mastery progression over the last 6 weeks</p>
                <VelocitySVG
                  data={[45, 52, 58, 63, 68, 72]}
                  color={heatmap.gates.find(g => g.id === selGate)?.color || '#2E75B6'}
                  width={380}
                  height={120}
                />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">
              {/* Dependency Risks */}
              <div className="card p-4">
                <h3 className="section-header mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-les-red inline-block" />
                  Dependency Risks
                </h3>
                {risks.length === 0 ? <p className="text-[11px] text-gray-400">No risks detected</p> : (
                  <div className="space-y-2">
                    {risks.map((r, i) => (
                      <div key={i} className={`p-2.5 rounded-xl border text-[11px] ${r.severity === 'critical' ? 'border-red-200 bg-red-50' : r.severity === 'high' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-bold">{r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : '🟡'} G{r.from_gate.number} → G{r.to_gate.number} ({r.affected_students.length} students)</p>
                        <p className="text-gray-600 mt-0.5">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Suggestions */}
              <div className="card p-4">
                <h3 className="section-header mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-les-blue pulse-dot inline-block" />
                  AI Suggestions
                </h3>
                {suggestions.length === 0 ? <p className="text-[11px] text-gray-400">No suggestions</p> : (
                  <div className="space-y-2">
                    {suggestions.map(s => (
                      <div key={s.id} className={`p-2.5 rounded-xl border text-[11px] ${s.status === 'accepted' ? 'border-green-200 bg-green-50' : s.status === 'rejected' ? 'opacity-60' : ''}`}>
                        <p className="font-bold text-gray-700">{s.title}</p>
                        <p className="text-gray-500">{s.description}</p>
                        {s.status === 'pending' && (
                          <div className="flex gap-1.5 mt-2">
                            <button onClick={() => resolveSuggestion(s.id, 'accepted')} className="btn-accept text-[10px] py-1 px-2.5">Accept</button>
                            <button onClick={() => resolveSuggestion(s.id, 'rejected')} className="btn-reject text-[10px] py-1 px-2.5">Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Immediate Attention */}
              <div className="card p-4">
                <h3 className="section-header mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-les-red inline-block" />
                  Immediate Attention
                </h3>
                {attention.length === 0 ? <p className="text-[11px] text-gray-400">No students at risk</p> : (
                  <div className="space-y-2">
                    {attention.map((s: any) => (
                      <div key={s.id} className="flex items-start gap-2 text-[11px] p-2 rounded-lg hover:bg-gray-50">
                        <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">{s.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-gray-700">{s.name}</p>
                          {s.at_risk_gates.map((g: any) => <p key={g.gate_number} className="text-red-600">G{g.gate_number} {g.short_title}: {g.mastery_pct}%</p>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: AI GUIDE ===================== */}
      {tab === 'ai_guide' && adaptiveData && (
        <div className="fade-in space-y-4">
          {/* Header Banner */}
          <div className="card p-5 bg-gradient-to-r from-les-navy/5 to-les-purple/5 border-les-navy/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-les-navy flex items-center justify-center text-lg">🤖</div>
              <div>
                <h3 className="text-sm font-black text-gray-900">AI Course Guide — Adaptive Suggestions</h3>
                <p className="text-[11px] text-gray-500">Based on {adaptiveData.analysis_based_on} | Generated {new Date(adaptiveData.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <p className="text-[12px] text-gray-600">
              {pendingSuggestions} pending suggestions for upcoming sessions.
              {acceptedSuggestions > 0 && ` ${acceptedSuggestions} accepted — ready to apply.`}
            </p>
          </div>

          {/* Suggestion Cards — grouped by priority */}
          {['high', 'medium', 'low'].map(priority => {
            const prioritySuggestions = adaptiveData.suggestions.filter(s => s.priority === priority && s.status !== 'applied');
            if (prioritySuggestions.length === 0) return null;
            const priorityConfig = { high: { label: 'HIGH PRIORITY', color: 'text-red-700', dot: 'bg-red-500' }, medium: { label: 'MEDIUM PRIORITY', color: 'text-amber-700', dot: 'bg-amber-500' }, low: { label: 'LOW PRIORITY', color: 'text-blue-700', dot: 'bg-blue-500' } }[priority]!;

            return (
              <div key={priority}>
                <h3 className={`section-header mb-2 flex items-center gap-2 ${priorityConfig.color}`}>
                  <span className={`w-2 h-2 rounded-full ${priorityConfig.dot} inline-block`} />
                  {priorityConfig.label}
                </h3>
                <div className="space-y-3">
                  {prioritySuggestions.map(s => {
                    const tc = TYPE_CONFIG[s.type] || { icon: '💡', label: s.type, color: '#6B7280' };
                    return (
                      <div key={s.id} className={`card p-5 transition-all ${s.status === 'accepted' ? 'border-l-4 border-l-green-400 bg-green-50/20' : s.status === 'rejected' ? 'opacity-50' : ''}`}>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tc.icon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="badge text-white text-[9px]" style={{ background: tc.color }}>{tc.label}</span>
                                {s.affects_sessions.map(sn => (
                                  <span key={sn} className="badge bg-gray-100 text-gray-600 text-[9px]">Session {sn}</span>
                                ))}
                                {s.status !== 'pending' && (
                                  <span className={`badge text-[9px] ${s.status === 'accepted' ? 'bg-green-100 text-green-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{s.status}</span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-gray-900 mt-1">{s.title}</h4>
                            </div>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="bg-amber-50 rounded-xl p-3 mb-3">
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Why this suggestion</p>
                          <p className="text-[12px] text-gray-700">{s.reason}</p>
                        </div>

                        {/* Affected Students */}
                        {s.affected_students && s.affected_students.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="text-[10px] text-gray-500 font-medium">Affects:</span>
                            {s.affected_students.map(name => (
                              <span key={name} className="badge bg-gray-100 text-gray-600 text-[9px]">{name}</span>
                            ))}
                          </div>
                        )}

                        {/* Current vs Proposed */}
                        {s.current && s.proposed && s.current.title && (
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                              <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Current Plan</p>
                              <p className="text-[12px] font-bold text-gray-900">{s.current.title}</p>
                              {s.current.objective && <p className="text-[11px] text-gray-600 mt-0.5">{s.current.objective}</p>}
                              {s.current.bloom_levels && (
                                <div className="flex gap-1 mt-1">{s.current.bloom_levels.map((b: string) => <span key={b} className="badge bg-gray-100 text-gray-500 text-[9px]">{b}</span>)}</div>
                              )}
                            </div>
                            <div className="bg-green-50/50 rounded-xl p-3 border border-green-100">
                              <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Proposed Change</p>
                              <p className="text-[12px] font-bold text-gray-900">{s.proposed.title || s.proposed.changes}</p>
                              {s.proposed.objective && <p className="text-[11px] text-gray-600 mt-0.5">{s.proposed.objective}</p>}
                              {s.proposed.bloom_levels && (
                                <div className="flex gap-1 mt-1">{s.proposed.bloom_levels.map((b: string) => <span key={b} className="badge bg-green-100 text-green-700 text-[9px]">{b}</span>)}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Proposed key changes list */}
                        {s.proposed?.key_changes && (
                          <div className="bg-blue-50/50 rounded-xl p-3 mb-3">
                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">What Changes</p>
                            <ul className="space-y-0.5">
                              {s.proposed.key_changes.map((c: string, i: number) => (
                                <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                                  <span className="text-blue-500 mt-0.5">→</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Socratic update specific */}
                        {s.proposed?.new_stage && (
                          <div className="bg-purple-50/50 rounded-xl p-3 mb-3 border-l-3 border-purple-300">
                            <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">New Socratic Stage: {s.proposed.new_stage.title}</p>
                            <p className="text-[11px] text-gray-700 italic">"{s.proposed.new_stage.teacher_prompt}"</p>
                            <p className="text-[10px] text-gray-500 mt-1">Expected: {s.proposed.new_stage.expected_response}</p>
                          </div>
                        )}

                        {/* Peer teaching pairs */}
                        {s.proposed?.pairs && (
                          <div className="space-y-1.5 mb-3">
                            {s.proposed.pairs.map((p: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 bg-green-50/50 rounded-lg p-2">
                                <span className="badge bg-green-100 text-green-700 text-[9px]">{p.mentor} ({p.mentor_score})</span>
                                <span className="text-gray-400 text-[10px]">mentors</span>
                                <span className="badge bg-amber-100 text-amber-700 text-[9px]">{p.mentee} ({p.mentee_score})</span>
                                <span className="text-[10px] text-gray-500">on {p.focus}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        {s.status === 'pending' && (
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <button onClick={() => resolveAdaptive(s.id, 'accepted')} className="btn-accept text-[11px] py-1.5">Accept</button>
                            <button onClick={() => resolveAdaptive(s.id, 'rejected')} className="btn-reject text-[11px] py-1.5">Reject</button>
                            <div className="flex-1" />
                            <input
                              placeholder="Add notes..."
                              className="input-field text-[11px] py-1.5 max-w-[200px]"
                              onBlur={e => { if (e.target.value) resolveAdaptive(s.id, s.status, e.target.value); }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Apply All Button */}
          {acceptedSuggestions > 0 && (
            <div className="card p-4 bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800">{acceptedSuggestions} suggestion{acceptedSuggestions !== 1 ? 's' : ''} accepted</p>
                  <p className="text-[11px] text-green-600">Apply changes to update the timetable for remaining sessions</p>
                </div>
                <button onClick={applyAllAccepted} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-green-700 transition-colors">
                  Apply All Accepted Changes
                </button>
              </div>
            </div>
          )}

          {/* History */}
          {adaptiveData.history.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowHistory(!showHistory)} className="section-header flex items-center gap-2 cursor-pointer hover:text-gray-600">
                <span className="transition-transform" style={{ transform: showHistory ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
                Previously Applied ({adaptiveData.history.length})
              </button>
              {showHistory && (
                <div className="space-y-2 mt-2 animate-slide-down">
                  {adaptiveData.history.map(h => (
                    <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-green-600 mt-0.5">✅</span>
                      <div>
                        <p className="text-[12px] font-bold text-gray-900">{h.title}</p>
                        <p className="text-[11px] text-green-700 mt-0.5">{h.outcome}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(h.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
