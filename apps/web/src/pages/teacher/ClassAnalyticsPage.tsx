import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { BloomBarSVG } from '../../components/shared/BloomBarSVG';
import { BloomRadar } from '../../components/shared/BloomRadar';
import { DIKWPyramid } from '../../components/shared/DIKWPyramid';
import { getDIKWFromBloomScores } from '@leap/shared';
import { VelocitySVG } from '../../components/shared/VelocitySVG';
import { KGCircleNodes } from '../../components/shared/KGCircleNodes';
import { getMasteryColor } from '../../lib/utils';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import { ClassTrajectory } from '../../components/teacher/ClassTrajectory';
import type { HeatmapData, BloomDistribution, DependencyRisk, AISuggestion, Course } from '@leap/shared';

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

interface CrossCourseContext {
  courses: { id: string; title: string; subject: string; class_level?: string }[];
  gates: { id: string; course_id: string; gate_number: number; short_title: string; avg_mastery: number }[];
  cross_edges: { gate_id: string; prerequisite_gate_id: string }[];
  bottlenecks: { from_gate: string; from_course: string; to_gate: string; to_course: string; blocked_students: number; total_students: number }[];
  students: { id: string; name: string; overall_mastery: number; at_risk: boolean; courses: { course_id: string; course_title: string; avg_mastery: number }[] }[];
}

export function ClassAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { profile } = useAuth();
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
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<any>(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [crossCourse, setCrossCourse] = useState<CrossCourseContext | null>(null);

  const isCollege = profile?.school === 'Horizon University College' || profile?.email?.includes('college') || profile?.email?.includes('university') || profile?.email?.includes('hu.ac.ae');

  useEffect(() => {
    // Fetch each independently so one failure doesn't block the rest
    const fetchData = async () => {
      try {
        const [c, sa, h] = await Promise.all([
          api.get<{ course: Course }>(`/courses/${courseId}`),
          api.get<SessionAnalytics>(`/courses/${courseId}/analytics/sessions`),
          api.get<HeatmapData>(`/courses/${courseId}/analytics/heatmap`),
        ]);
        setCourse(c.course);
        setSessionAnalytics(sa);
        setHeatmap(h);
        if (h.gates.length > 0) setSelGate(h.gates[0].id);
      } catch (err) {
        console.error('Analytics core data failed:', err);
      }

      // These can fail independently without breaking the page
      try { const r = await api.get<{ risks: DependencyRisk[] }>(`/courses/${courseId}/analytics/dependency-risk`); setRisks(r.risks); } catch {}
      try { const s = await api.get<{ suggestions: AISuggestion[] }>(`/courses/${courseId}/suggestions`); setSuggestions(s.suggestions); } catch {}
      try { const a = await api.get<{ students: any[] }>(`/courses/${courseId}/analytics/attention`); setAttention(a.students); } catch {}
      try { const ad = await api.get<AdaptiveData>(`/courses/${courseId}/suggestions/adaptive`); setAdaptiveData(ad); } catch {}

      if (isCollege) {
        try { const cc = await api.get<CrossCourseContext>('/programs/prog-default/kg'); setCrossCourse(cc); } catch {}
      }

      setLoading(false);
    };
    fetchData();
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

  if (loading) return <SkeletonPage />;
  if (!sessionAnalytics || !heatmap) return (
    <div className="max-w-3xl mx-auto text-center py-16">
      <h2 className="text-lg font-bold text-gray-700 mb-2">Analytics not available</h2>
      <p className="text-sm text-gray-500 mb-4">This course may not have session data yet. Try activating the course first.</p>
      <Link to={`/teacher/courses/${courseId}/detail`} className="btn-primary inline-block">Back to Course</Link>
    </div>
  );

  const sa = sessionAnalytics;
  const stats = sa.course_stats;

  const pendingSuggestions = adaptiveData?.suggestions.filter(s => s.status === 'pending').length || 0;
  const acceptedSuggestions = adaptiveData?.suggestions.filter(s => s.status === 'accepted').length || 0;

  // Cross-course data for this course
  const thisCourseCrossEdges = crossCourse ? crossCourse.cross_edges.filter(e => {
    const gateIds = new Set(crossCourse.gates.filter(g => g.course_id === courseId).map(g => g.id));
    return gateIds.has(e.gate_id) || gateIds.has(e.prerequisite_gate_id);
  }) : [];
  const thisCourseBottlenecks = crossCourse?.bottlenecks.filter(b =>
    b.to_course === course?.title || b.from_course === course?.title
  ) || [];

  const analyticsTabs: { key: AnalyticsTab; label: string }[] = [
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

      {/* Cross-Course Context Banner (college only) */}
      {isCollege && crossCourse && thisCourseCrossEdges.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-l-purple-500 bg-purple-50/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12px] font-black text-purple-900">Cross-Course Dependencies</h3>
              <p className="text-[10px] text-purple-600">This course has {thisCourseCrossEdges.length} connections to other courses</p>
            </div>
            <Link to="/teacher/programs/prog-default" className="text-[10px] font-bold text-purple-700 hover:underline">View Full Program Graph →</Link>
          </div>

          {/* Prerequisites this course needs */}
          {(() => {
            const thisGateIds = new Set(crossCourse.gates.filter(g => g.course_id === courseId).map(g => g.id));
            const incomingEdges = crossCourse.cross_edges.filter(e => thisGateIds.has(e.gate_id));
            const outgoingEdges = crossCourse.cross_edges.filter(e => thisGateIds.has(e.prerequisite_gate_id));
            const gateMap = new Map(crossCourse.gates.map(g => [g.id, g]));
            const courseMap = new Map(crossCourse.courses.map(c => [c.id, c]));

            return (
              <div className="space-y-2">
                {incomingEdges.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-purple-700 uppercase tracking-wider mb-1">Requires from other courses</p>
                    <div className="space-y-1">
                      {incomingEdges.map((e, i) => {
                        const prereqGate = gateMap.get(e.prerequisite_gate_id);
                        const targetGate = gateMap.get(e.gate_id);
                        const prereqCourse = prereqGate ? courseMap.get(prereqGate.course_id) : null;
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px] bg-white rounded-lg px-3 py-1.5 border border-purple-100">
                            <span className="font-bold" style={{ color: prereqGate?.avg_mastery && prereqGate.avg_mastery >= 70 ? '#059669' : prereqGate?.avg_mastery && prereqGate.avg_mastery >= 50 ? '#D97706' : '#DC2626' }}>
                              {prereqGate?.avg_mastery || 0}%
                            </span>
                            <span className="text-gray-600">G{prereqGate?.gate_number}: {prereqGate?.short_title}</span>
                            <span className="text-[9px] text-gray-400">({prereqCourse?.title})</span>
                            <span className="text-purple-400">→</span>
                            <span className="text-gray-800 font-medium">G{targetGate?.gate_number}: {targetGate?.short_title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {outgoingEdges.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-1">Feeds into other courses</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {outgoingEdges.map((e, i) => {
                        const targetGate = gateMap.get(e.gate_id);
                        const targetCourse = targetGate ? courseMap.get(targetGate.course_id) : null;
                        const srcGate = gateMap.get(e.prerequisite_gate_id);
                        return (
                          <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                            G{srcGate?.gate_number} → {targetCourse?.title} G{targetGate?.gate_number}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Bottleneck alerts */}
                {thisCourseBottlenecks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] font-bold text-red-700 uppercase tracking-wider mb-1">Bottleneck Alerts</p>
                    {thisCourseBottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] bg-red-50 rounded-lg px-3 py-1.5 border border-red-100 mb-1">
                        <span className="text-red-600 font-bold">{b.blocked_students} blocked</span>
                        <span className="text-gray-600">{b.from_gate} ({b.from_course}) → {b.to_gate} ({b.to_course})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

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
              <span className="text-lg font-black text-leap-navy">{stats.overall_completion_pct}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-leap-blue to-leap-navy h-full rounded-full transition-all duration-500" style={{ width: `${stats.overall_completion_pct}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Session {sa.current_session} of {sa.total_sessions} | {sa.completed_sessions} completed</p>
          </div>

          {/* Summary Stats with explanations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-2xl font-black text-leap-navy">{stats.avg_mastery}%</p>
              <p className="text-[11px] font-bold text-gray-700">Avg Mastery</p>
              <p className="text-[10px] text-gray-400 mt-1">Average quiz score across all completed sessions and students</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-leap-green">{stats.total_quizzes_completed}<span className="text-sm text-gray-400 font-normal">/{stats.total_quizzes_possible}</span></p>
              <p className="text-[11px] font-bold text-gray-700">Quizzes Completed</p>
              <p className="text-[10px] text-gray-400 mt-1">Total quiz attempts by all students across completed sessions</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-leap-blue">{stats.students_on_track}</p>
              <p className="text-[11px] font-bold text-gray-700">Students On Track</p>
              <p className="text-[10px] text-gray-400 mt-1">Students scoring above 75% mastery threshold consistently</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-black text-leap-red">{stats.students_at_risk}</p>
              <p className="text-[11px] font-bold text-gray-700">At Risk</p>
              <p className="text-[10px] text-gray-400 mt-1">Students below 60% in any active gate — need immediate attention</p>
            </div>
          </div>

          {/* DIKW Distribution */}
          <div className="card p-4">
            <h3 className="section-header mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              DIKW Learning Progression
            </h3>
            <p className="text-[10px] text-gray-400 mb-3">Where your class sits on the Data → Wisdom journey</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { level: 'Data', desc: 'Recall facts', color: '#3B82F6', bg: '#DBEAFE' },
                { level: 'Information', desc: 'Understand meaning', color: '#10B981', bg: '#DCFCE7' },
                { level: 'Knowledge', desc: 'Apply & analyze', color: '#F59E0B', bg: '#FEF3C7' },
                { level: 'Wisdom', desc: 'Judge & create', color: '#8B5CF6', bg: '#EDE9FE' },
              ].map(d => {
                // Compute from bloom dist: map bloom levels to DIKW
                const bloomMap: Record<string, string> = { remember: 'Data', understand: 'Information', apply: 'Knowledge', analyze: 'Knowledge', evaluate: 'Wisdom', create: 'Wisdom' };
                const gateAvgs = heatmap.gates.map(g => g.avg);
                const overallAvg = gateAvgs.length > 0 ? Math.round(gateAvgs.reduce((a, b) => a + b, 0) / gateAvgs.length) : 0;
                // Simple estimation based on overall mastery
                const dikwEstimate: Record<string, number> = {
                  Data: Math.min(100, overallAvg + 15),
                  Information: overallAvg,
                  Knowledge: Math.max(0, overallAvg - 12),
                  Wisdom: Math.max(0, overallAvg - 25),
                };
                const score = dikwEstimate[d.level] || 0;
                return (
                  <div key={d.level} className="rounded-xl p-3 text-center" style={{ background: d.bg }}>
                    <p className="text-xl font-black" style={{ color: d.color }}>{score}%</p>
                    <p className="text-[11px] font-bold" style={{ color: d.color }}>{d.level}</p>
                    <p className="text-[9px] text-gray-500">{d.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mastery Heatmap — scrollable */}
          <div className="card p-4">
            <h3 className="section-header mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leap-purple inline-block" />
              Student x Gate Mastery
              <span className="text-[10px] font-normal text-gray-400 ml-2">{heatmap.students.length} students</span>
            </h3>
            <div className="overflow-auto" style={{ maxHeight: '40vh' }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="text-left py-1 pr-2 text-[10px] text-gray-400 font-medium bg-white">Student</th>
                    {heatmap.gates.map(g => (
                      <th key={g.id} className="text-center py-1 px-1 bg-white">
                        <div className="w-6 h-6 rounded-full mx-auto flex items-center justify-center text-white text-[9px] font-bold" style={{ background: g.color }}>{g.gate_number}</div>
                      </th>
                    ))}
                    <th className="text-center py-1 px-1 text-[10px] text-gray-400 bg-white">Avg</th>
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
          <div className="card p-4 bg-leap-navy/5 border-leap-navy/20 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="badge bg-leap-navy text-white text-[11px] px-3 py-1">NOW</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Session {sa.current_session}: {sa.sessions.find(s => s.session_number === sa.current_session)?.lesson_title}</p>
                  <p className="text-[11px] text-gray-500">Currently in progress</p>
                </div>
              </div>
              <span className="text-leap-navy font-black text-lg">{sa.current_session}/{sa.total_sessions}</span>
            </div>
          </div>

          {/* Session list */}
          {sa.sessions.map(session => {
            const isExpanded = expandedSession === session.session_number;
            const isCurrent = session.session_number === sa.current_session;

            return (
              <div key={session.session_number} className={`card overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-leap-navy/30' : ''}`}>
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
                        {(() => {
                          // Compute DIKW from gate position
                          const totalGates = sa.gates_status.length || 1;
                          const gateIdx = sa.gates_status.findIndex(g => g.gate_number === session.gate_number);
                          const ratio = totalGates > 1 ? gateIdx / (totalGates - 1) : 0.5;
                          const dikw = ratio <= 0.25 ? 'Data' : ratio <= 0.5 ? 'Information' : ratio <= 0.75 ? 'Knowledge' : 'Wisdom';
                          const colors: Record<string, { bg: string; text: string }> = { Data: { bg: '#DBEAFE', text: '#1E40AF' }, Information: { bg: '#DCFCE7', text: '#166534' }, Knowledge: { bg: '#FEF3C7', text: '#92400E' }, Wisdom: { bg: '#EDE9FE', text: '#5B21B6' } };
                          const c = colors[dikw];
                          return <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>{dikw}</span>;
                        })()}
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
        <div className="fade-in space-y-5">
          {/* 1. Class Score Trajectory — full width, top */}
          <ClassTrajectory courseId={courseId!} />

          {/* 2. KG + Bloom + Velocity — 3-column row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-4">
              <h3 className="section-header mb-3">Gate Mastery</h3>
              <div className="space-y-2">
                {heatmap.gates.map((g, gi) => {
                  const isSelected = selGate === g.id;
                  return (
                    <button key={g.id} onClick={() => setSelGate(g.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${isSelected ? 'ring-2 bg-white shadow-sm' : 'hover:bg-gray-50'}`}
                      style={isSelected ? { borderColor: g.color, ringColor: g.color } : {}}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: g.color }}>G{g.gate_number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-700 truncate">{g.short_title}</span>
                          <span className="text-[11px] font-black ml-2" style={{ color: g.color }}>{g.avg}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${g.avg}%`, background: g.color }} />
                        </div>
                      </div>
                      {gi < heatmap.gates.length - 1 && (
                        <span className="text-gray-300 text-[10px] shrink-0">→</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="section-header mb-2">Bloom — {heatmap.gates.find(g => g.id === selGate)?.short_title || 'Select Gate'}</h3>
              <div className="flex gap-1 flex-wrap mb-2">
                {heatmap.gates.map(g => (
                  <button key={g.id} onClick={() => setSelGate(g.id)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all ${selGate === g.id ? 'text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    style={selGate === g.id ? { background: g.color } : {}}>
                    G{g.gate_number} {g.avg}%
                  </button>
                ))}
              </div>
              {bloomDist ? (
                <>
                  <BloomBarSVG data={bloomDist.levels.map(l => ({ level: l.level.charAt(0).toUpperCase() + l.level.slice(1), pct: l.pct }))} />
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">{bloomDist.gap_analysis}</div>
                </>
              ) : <p className="text-[11px] text-gray-400 text-center py-4">Select a gate</p>}
            </div>
            <div className="card p-4">
              <h3 className="section-header mb-2">Class Learning Velocity</h3>
              <VelocitySVG
                data={(() => {
                  const completed = sessionAnalytics?.sessions.filter(s => s.status === 'completed' && s.avg_quiz_score > 0) || [];
                  if (completed.length < 2) return [0, 0];
                  const step = Math.max(1, Math.floor(completed.length / 8));
                  return Array.from({ length: Math.min(8, completed.length) }, (_, i) => {
                    const idx = Math.min(i * step, completed.length - 1);
                    return completed[idx].avg_quiz_score;
                  });
                })()}
                color={heatmap.gates.find(g => g.id === selGate)?.color || '#2E75B6'}
                width={400}
                height={180}
              />
              {bloomDist && (
                <div className="mt-3 flex justify-center">
                  <BloomRadar
                    data={Object.fromEntries(bloomDist.levels.map(l => [l.level.charAt(0).toUpperCase() + l.level.slice(1), l.pct]))}
                    color={heatmap.gates.find(g => g.id === selGate)?.color || '#2E75B6'}
                    size={180}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. Student Table (left) + Detail Panel (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT: Combined student table with heatmap data */}
            <div className="lg:col-span-3">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-header">Students <span className="text-[10px] font-normal text-gray-400">({heatmap.students.length})</span></h3>
                  <span className="text-[10px] text-gray-400">Click a row for details</span>
                </div>
                <div className="overflow-auto" style={{ maxHeight: '45vh' }}>
                  <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 pl-3 pr-1 text-[10px] text-gray-400 font-medium rounded-l-lg">#</th>
                        <th className="text-left py-2 pr-2 text-[10px] text-gray-400 font-medium">Student</th>
                        {heatmap.gates.map(g => (
                          <th key={g.id} className="text-center py-2 px-0.5" style={selGate === g.id ? { borderBottom: `2px solid ${g.color}` } : {}}>
                            <span className="text-[9px] font-bold" style={{ color: g.color }}>G{g.gate_number}</span>
                          </th>
                        ))}
                        <th className="text-center py-2 px-1 text-[10px] text-gray-400 font-medium rounded-r-lg">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...heatmap.students].sort((a, b) => b.average - a.average).map((s, rank) => {
                        const isSelected = selectedStudent === s.id;
                        return (
                          <tr key={s.id}
                            onClick={() => {
                              setSelectedStudent(s.id);
                              setStudentDetailLoading(true);
                              setStudentDetail(null);
                              api.get<any>(`/courses/${courseId}/analytics/student/${s.id}`).then(d => {
                                setStudentDetail(d.student);
                                setStudentDetailLoading(false);
                              }).catch(() => setStudentDetailLoading(false));
                            }}
                            className={`cursor-pointer transition-all ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <td className="py-1.5 pl-3 pr-1">
                              <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[9px] font-bold ${rank < 3 ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-400'}`}>{rank + 1}</span>
                            </td>
                            <td className="py-1.5 pr-2">
                              <span className={`text-[12px] font-medium ${isSelected ? 'text-leap-navy' : 'text-gray-700'}`}>{s.name}</span>
                            </td>
                            {s.gate_scores.map(gs => {
                              const mc = getMasteryColor(gs.mastery_pct);
                              return (
                                <td key={gs.gate_id} className="text-center py-1 px-0.5">
                                  <span className="inline-flex items-center justify-center w-10 h-6 rounded text-[10px] font-bold" style={{ background: mc.bg, color: mc.txt }}>
                                    {gs.mastery_pct > 0 ? gs.mastery_pct : '—'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="text-center py-1.5 px-1">
                              <span className={`text-[11px] font-black ${s.average >= 75 ? 'text-green-600' : s.average >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{s.average}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT: Student detail + Risks + Attention + Suggestions */}
            <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start space-y-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              {/* Student Detail */}
              <div className="card p-4">
                {!selectedStudent ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">👈</p>
                    <p className="text-[12px] text-gray-500 font-medium">Select a student from the table</p>
                    <p className="text-[10px] text-gray-400 mt-1">Click any row to see their full performance breakdown</p>
                  </div>
                ) : studentDetailLoading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-leap-navy border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[11px] text-gray-400">Loading...</p>
                  </div>
                ) : studentDetail ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-leap-navy text-white flex items-center justify-center text-sm font-bold">{studentDetail.name.charAt(0)}</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-black text-gray-900">{studentDetail.name}</h3>
                        <p className="text-[10px] text-gray-400">{studentDetail.email}</p>
                      </div>
                      <button onClick={() => { setSelectedStudent(null); setStudentDetail(null); }} className="text-gray-300 hover:text-gray-500">&times;</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-leap-blue">{studentDetail.overall_score}%</p>
                        <p className="text-[8px] text-gray-400">Score</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-leap-green">{studentDetail.accuracy}%</p>
                        <p className="text-[8px] text-gray-400">Accuracy</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-leap-purple">{studentDetail.total_attempts}</p>
                        <p className="text-[8px] text-gray-400">Attempts</p>
                      </div>
                    </div>
                    {studentDetail.bloom_profile && Object.keys(studentDetail.bloom_profile).length > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-center mb-2">
                          <BloomRadar
                            data={Object.fromEntries(Object.entries(studentDetail.bloom_profile).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]))}
                            color="#1B3A6B" size={170}
                          />
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5 text-center">DIKW Level</p>
                        <div className="flex justify-center">
                          <DIKWPyramid scores={getDIKWFromBloomScores(studentDetail.bloom_profile as Record<string, number>)} size={150} />
                        </div>
                      </div>
                    )}
                    {studentDetail.gate_progress?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Gate Progress</p>
                        <div className="space-y-1">
                          {studentDetail.gate_progress.map((g: any) => (
                            <div key={g.gate_number} className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-gray-400 w-5">G{g.gate_number}</span>
                              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${g.mastery_pct}%`, background: g.gate_color }} />
                              </div>
                              <span className="text-[9px] font-bold w-7 text-right" style={{ color: g.gate_color }}>{g.mastery_pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {studentDetail.misconceptions?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Misconceptions</p>
                        {studentDetail.misconceptions.slice(0, 4).map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] mb-0.5">
                            <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[8px] font-bold shrink-0">{m.count}</span>
                            <span className="text-gray-600 truncate">{m.misconception}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {studentDetail.recommendation && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-800">
                        <p className="font-bold mb-0.5">AI Recommendation</p>
                        <p>{studentDetail.recommendation}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Dependency Risks */}
              <div className="card p-3">
                <h3 className="section-header mb-2 flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-leap-red inline-block" /> Dependency Risks
                </h3>
                {risks.length === 0 ? <p className="text-[10px] text-gray-400">No risks detected</p> : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {risks.slice(0, 5).map((r, i) => (
                      <div key={i} className={`p-2 rounded-lg border text-[10px] ${r.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                        <span className="font-bold">{r.severity === 'critical' ? '🔴' : '🟠'} G{r.from_gate.number}→G{r.to_gate.number}</span>
                        <span className="text-gray-500 ml-1">({r.affected_students.length} students)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Immediate Attention */}
              <div className="card p-3">
                <h3 className="section-header mb-2 flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-leap-red inline-block" /> Needs Attention
                </h3>
                {attention.length === 0 ? <p className="text-[10px] text-gray-400">No students at risk</p> : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {attention.slice(0, 6).map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedStudent(s.id); setStudentDetailLoading(true); setStudentDetail(null);
                          api.get<any>(`/courses/${courseId}/analytics/student/${s.id}`).then(d => { setStudentDetail(d.student); setStudentDetailLoading(false); }).catch(() => setStudentDetailLoading(false));
                        }}>
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[9px] font-bold shrink-0">{s.name.charAt(0)}</span>
                        <span className="text-gray-700 font-medium truncate flex-1">{s.name}</span>
                        <span className="text-red-600 font-bold">{s.at_risk_gates[0]?.mastery_pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Suggestions */}
              <div className="card p-3">
                <h3 className="section-header mb-2 flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-leap-blue pulse-dot inline-block" /> AI Suggestions
                  <button onClick={() => setTab('ai_guide')} className="text-[9px] text-blue-600 hover:underline ml-auto font-normal normal-case tracking-normal">View all →</button>
                </h3>
                {!adaptiveData || adaptiveData.suggestions.length === 0 ? <p className="text-[10px] text-gray-400">No suggestions</p> : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {adaptiveData.suggestions.filter(s => s.status === 'pending').slice(0, 3).map(s => {
                      const tc = TYPE_CONFIG[s.type] || { icon: '💡', label: s.type, color: '#6B7280' };
                      return (
                        <div key={s.id} className="p-2 rounded-lg border text-[10px]">
                          <div className="flex items-center gap-1 mb-1">
                            <span>{tc.icon}</span>
                            <span className="font-bold text-gray-700 truncate">{s.title}</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => resolveAdaptive(s.id, 'accepted')} className="btn-accept text-[9px] py-0.5 px-2">Accept</button>
                            <button onClick={() => resolveAdaptive(s.id, 'rejected')} className="btn-reject text-[9px] py-0.5 px-2">Reject</button>
                          </div>
                        </div>
                      );
                    })}
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
          <div className="card p-5 bg-gradient-to-r from-leap-navy/5 to-leap-purple/5 border-leap-navy/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-leap-navy flex items-center justify-center text-lg">🤖</div>
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
