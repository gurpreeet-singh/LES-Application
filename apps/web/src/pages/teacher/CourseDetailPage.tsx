import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { KGCircleNodes } from '../../components/shared/KGCircleNodes';
import { GateDependencyGraph } from '../../components/shared/GateDependencyGraph';
import { JourneySteps } from '../../components/shared/JourneySteps';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import type { Course, Gate, Lesson, Question, SubConcept } from '@leap/shared';
import { getDIKWLevelByPosition } from '@leap/shared';
import { DIKWBadgeFromBloom, DIKWBadge } from '../../components/shared/DIKWBadge';

type Tab = 'overview' | 'students_tab' | 'syllabus' | 'kg' | 'lessons' | 'scripts' | 'questions' | 'timetable' | 'settings';

interface SessionPlan {
  id: string;
  session_number: number;
  lesson_id: string;
  lesson_portion: string;
  topic_summary: string;
  quiz_included: boolean;
  lesson?: Lesson;
  questions?: Question[];
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [course, setCourse] = useState<Course | null>(null);
  const [gates, setGates] = useState<(Gate & { sub_concepts?: SubConcept[] })[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<SessionPlan[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [expandedGate, setExpandedGate] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentProfiles, setStudentProfiles] = useState<any[]>([]);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<any>(null);
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [genFeedback, setGenFeedback] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ course: Course }>(`/courses/${courseId}`),
      api.get<{ gates: (Gate & { sub_concepts?: SubConcept[] })[] }>(`/courses/${courseId}/kg/gates`),
      api.get<{ lessons: Lesson[] }>(`/courses/${courseId}/lessons`),
      api.get<{ questions: Question[] }>(`/courses/${courseId}/questions`),
    ]).then(([c, g, l, q]) => {
      setCourse(c.course);
      setGates(g.gates);
      setEdges(g.edges || []);
      setLessons(l.lessons);
      setQuestions(q.questions);
      setLoading(false);

      // Load timetable if available
      if (c.course.total_sessions) {
        api.get<{ sessions: SessionPlan[] }>(`/courses/${courseId}/timetable`).then(t => {
          setSessions(t.sessions || []);
        }).catch(() => {});
      }
    });
  }, [courseId]);

  if (loading || !course) return <SkeletonPage />;

  const hasTimetable = course.total_sessions;

  // Bloom level distribution across all lessons
  const bloomOrder = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const bloomCounts: Record<string, number> = {};
  lessons.forEach(l => {
    l.bloom_levels?.forEach(bl => {
      const key = bl.toLowerCase();
      bloomCounts[key] = (bloomCounts[key] || 0) + 1;
    });
  });
  const bloomColorMap: Record<string, string> = {
    remember: 'bg-slate-100 text-slate-700',
    understand: 'bg-blue-100 text-blue-700',
    apply: 'bg-green-100 text-green-700',
    analyze: 'bg-amber-100 text-amber-700',
    evaluate: 'bg-orange-100 text-orange-700',
    create: 'bg-rose-100 text-rose-700',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    processing: 'bg-yellow-100 text-yellow-800',
    structure_ready: 'bg-purple-100 text-purple-800',
    review: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
  };

  const tabs: { key: Tab; label: string; count?: number; hidden?: boolean }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'students_tab', label: 'Students' },
    { key: 'syllabus', label: 'Syllabus & Objectives', hidden: gates.length === 0 && (!course.syllabus_text || course.syllabus_text.length < 200) },
    { key: 'kg', label: 'Knowledge Graph', count: gates.length },
    { key: 'lessons', label: 'Lessons', count: lessons.length },
    { key: 'scripts', label: 'Socratic Scripts', count: lessons.filter(l => l.socratic_scripts?.length).length },
    { key: 'questions', label: 'Questions', count: questions.length },
    { key: 'timetable', label: 'Timetable', count: sessions.length, hidden: !hasTimetable },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/teacher/courses" className="text-[12px] text-blue-600 hover:underline mb-2 inline-block">&larr; All Courses</Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900">{course.title}</h1>
            <p className="text-[12px] text-gray-500 mt-1">
              {course.subject} {course.class_level && `| Class ${course.class_level}`}{course.section && course.section} | {course.academic_year}
              <span className={`ml-3 badge ${statusColors[course.status]}`}>{course.status}</span>
            </p>
            <div className="mt-2">
              <JourneySteps status={course.status} />
            </div>
          </div>
          <div className="flex gap-2">
            {course.status === 'draft' && (
              <Link to={`/teacher/courses/${courseId}/upload`} className="btn-primary">Upload Syllabus</Link>
            )}
            {course.status === 'structure_ready' && (
              <Link to={`/teacher/courses/${courseId}/review`} className="btn-primary">Review Structure & Start</Link>
            )}
            {course.status === 'review' && (
              <Link to={`/teacher/courses/${courseId}/review`} className="btn-primary">Review & Finalize</Link>
            )}
            {course.status === 'active' && (
              <Link to={`/teacher/courses/${courseId}/analytics`} className="btn-primary">View Analytics</Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.filter(t => !t.hidden).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="fade-in grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            {/* Progressive Generation Card */}
            {['structure_ready', 'active'].includes(course.status) && (() => {
              const currentSession = lessons.length;
              const total = course.total_sessions || 30;
              return (
                <div className="card p-5 border-2 border-leap-navy/20 bg-gradient-to-r from-leap-navy/5 to-blue-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-leap-navy flex items-center justify-center text-white text-lg">🔄</div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900">Progressive Session Generation</h3>
                      <p className="text-[11px] text-gray-500">Each session adapts to the previous session's student outcomes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-leap-navy rounded-full transition-all" style={{ width: `${(currentSession / total) * 100}%` }} />
                    </div>
                    <span className="text-sm font-black text-leap-navy">{currentSession}/{total}</span>
                  </div>
                  {currentSession < total && (
                    <>
                      <textarea
                        value={genFeedback}
                        onChange={e => setGenFeedback(e.target.value)}
                        placeholder="Notes for the next session (optional) — e.g., 'Students struggled with negative fractions, focus more on number line visualization'"
                        className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-leap-navy mb-3 resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setGenerating(true);
                            try {
                              // Use direct Railway URL to avoid Netlify proxy timeout
                              const directUrl = (import.meta as any).env?.VITE_DIRECT_API_URL || (import.meta as any).env?.VITE_API_URL || '/api/v1';
                              const stored = localStorage.getItem('les_demo_session');
                              const token = stored ? JSON.parse(stored)?.session?.access_token : '';
                              const res = await fetch(`${directUrl}/courses/${courseId}/generate-next-session`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ teacher_feedback: genFeedback || undefined }),
                              });
                              if (!res.ok) {
                                const err = await res.json();
                                throw new Error(err.error || 'Generation failed');
                              }
                              const result = await res.json();
                              setGenFeedback('');
                              alert(`Session ${result.session_number} generated: "${result.lesson?.title}"`);
                              window.location.reload();
                            } catch (err: any) {
                              alert(err.message || 'Generation failed');
                            }
                            setGenerating(false);
                          }}
                          disabled={generating}
                          className="btn-primary text-[12px] py-2 px-4"
                        >
                          {generating ? '🤖 Generating...' : `Generate Session ${currentSession + 1}`}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Generate all ${total - currentSession} remaining sessions in batch? Each session will build on the previous one's structure.`)) return;
                            setGenerating(true);
                            const directUrl2 = (import.meta as any).env?.VITE_DIRECT_API_URL || '/api/v1';
                            const stored2 = localStorage.getItem('les_demo_session');
                            const token2 = stored2 ? JSON.parse(stored2)?.session?.access_token : '';
                            await fetch(`${directUrl2}/courses/${courseId}/generate-all-remaining`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
                              body: JSON.stringify({ teacher_feedback: genFeedback || undefined }),
                            });
                            alert('Generating all remaining sessions in background. Refresh the page in a few minutes.');
                            setGenerating(false);
                          }}
                          disabled={generating}
                          className="btn-secondary text-[12px] py-2 px-4"
                        >
                          Generate All Remaining ({total - currentSession})
                        </button>
                      </div>
                    </>
                  )}
                  {currentSession >= total && (
                    <p className="text-sm text-green-700 font-bold">All {total} sessions generated!</p>
                  )}
                </div>
              );
            })()}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { val: gates.length, label: 'Gates', color: 'text-leap-blue' },
                { val: lessons.length, label: 'Lessons', color: 'text-leap-green' },
                { val: questions.length, label: 'Questions', color: 'text-leap-purple' },
                { val: lessons.filter(l => l.socratic_scripts?.length).length, label: 'Scripts', color: 'text-leap-amber' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* DIKW Progression */}
            {lessons.length > 0 && (() => {
              const dikwCounts: Record<string, number> = { Data: 0, Information: 0, Knowledge: 0, Wisdom: 0 };
              const totalL = lessons.length;
              lessons.forEach(l => {
                const level = getDIKWLevelByPosition(l.lesson_number, totalL);
                const label = { data: 'Data', information: 'Information', knowledge: 'Knowledge', wisdom: 'Wisdom' }[level];
                dikwCounts[label]++;
              });
              const colors: Record<string, string> = { Data: '#3B82F6', Information: '#10B981', Knowledge: '#F59E0B', Wisdom: '#8B5CF6' };
              const total = lessons.length;
              return (
                <div className="card p-5">
                  <h3 className="section-header mb-3">Learning Progression (DIKW)</h3>
                  <div className="flex rounded-full overflow-hidden h-3 mb-2">
                    {Object.entries(dikwCounts).filter(([, c]) => c > 0).map(([level, count]) => (
                      <div key={level} className="h-full" style={{ width: `${(count / total) * 100}%`, background: colors[level] }} title={`${level}: ${count} lessons`} />
                    ))}
                  </div>
                  <div className="flex gap-3 text-[10px]">
                    {Object.entries(dikwCounts).map(([level, count]) => (
                      <span key={level} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: colors[level] }} />
                        <span className="font-bold" style={{ color: colors[level] }}>{level}</span>
                        <span className="text-gray-400">{count} lessons</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Syllabus Preview */}
            {course.syllabus_text && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-header">Uploaded Syllabus</h3>
                  <button onClick={() => setShowSyllabus(!showSyllabus)} className="text-[11px] text-blue-600 hover:underline">
                    {showSyllabus ? 'Hide' : 'Show full text'}
                  </button>
                </div>
                <p className="text-[12px] text-gray-600 whitespace-pre-wrap">
                  {showSyllabus ? course.syllabus_text : course.syllabus_text.slice(0, 300) + (course.syllabus_text.length > 300 ? '...' : '')}
                </p>
              </div>
            )}

            {/* KG Visual - Circle Nodes */}
            <div className="card p-5">
              <h3 className="section-header mb-4">Knowledge Graph — Gate Progression</h3>
              <KGCircleNodes gates={gates} />
            </div>

            {/* Gate Dependencies */}
            {edges.length > 0 && (
              <div className="card p-5">
                <h3 className="section-header mb-4">Gate Dependencies</h3>
                <GateDependencyGraph gates={gates} edges={edges} compact />
              </div>
            )}

            {/* Quick Lesson Overview */}
            <div className="card p-5">
              <h3 className="section-header mb-3">Lesson Plan Overview</h3>
              <div className="space-y-2">
                {lessons.slice(0, 6).map(l => (
                  <div key={l.id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 w-6 text-[12px] font-bold">L{l.lesson_number}</span>
                    <span className="text-gray-700 flex-1">{l.title}</span>
                    <div className="flex gap-1">{l.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}</div>
                  </div>
                ))}
                {lessons.length > 6 && <p className="text-[11px] text-gray-400 pt-1">+ {lessons.length - 6} more lessons</p>}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <div className="card p-5">
              <h3 className="section-header mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {course.status === 'draft' && (
                  <Link to={`/teacher/courses/${courseId}/upload`} className="btn-primary block w-full text-center">Upload Syllabus</Link>
                )}
                {course.status === 'review' && (
                  <Link to={`/teacher/courses/${courseId}/review`} className="btn-primary block w-full text-center">Review Content</Link>
                )}
                {course.status === 'active' && (
                  <>
                    <Link to={`/teacher/courses/${courseId}/analytics`} className="btn-primary block w-full text-center">Class Analytics</Link>
                    <button onClick={() => setTab('kg')} className="btn-secondary block w-full">View Knowledge Graph</button>
                    <button onClick={() => setTab('lessons')} className="btn-secondary block w-full">View Lessons</button>
                    <Link to={`/teacher/courses/${courseId}/students`} className="btn-secondary block w-full text-center">Manage Students</Link>
                    {hasTimetable && (
                      <button onClick={() => setTab('timetable')} className="btn-secondary block w-full">View Timetable</button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="section-header mb-3">Course Info</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div><span className="text-gray-400 text-[11px]">Subject:</span> {course.subject}</div>
                <div><span className="text-gray-400 text-[11px]">Class:</span> {course.class_level}{course.section && ` ${course.section}`}</div>
                <div><span className="text-gray-400 text-[11px]">Year:</span> {course.academic_year}</div>
                <div><span className="text-gray-400 text-[11px]">AI Provider:</span> {course.llm_provider}</div>
                <div><span className="text-gray-400 text-[11px]">Mastery Threshold:</span> {course.mastery_threshold}%</div>
                {hasTimetable && (
                  <div><span className="text-gray-400 text-[11px]">Sessions:</span> {course.total_sessions} x {course.session_duration_minutes}min</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Syllabus & Objectives Tab */}
      {tab === 'syllabus' && (
        <div className="fade-in space-y-5">
          {/* Summary Bar */}
          {gates.length > 0 && (
            <div className="card p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-leap-blue">{gates.length}</p>
                  <p className="text-[11px] text-gray-400">Units / Gates</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-leap-green">{lessons.length}</p>
                  <p className="text-[11px] text-gray-400">Lessons</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-leap-purple">{lessons.filter(l => l.objective).length}</p>
                  <p className="text-[11px] text-gray-400">Learning Objectives</p>
                </div>
              </div>
              {Object.keys(bloomCounts).length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-2">Bloom Level Coverage</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {bloomOrder.filter(bl => bloomCounts[bl]).map(bl => (
                      <span key={bl} className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${bloomColorMap[bl]}`}>
                        {bl.charAt(0).toUpperCase() + bl.slice(1)} ({bloomCounts[bl]})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* DIKW Course Progression */}
              {lessons.length > 0 && (() => {
                const dikwMap: Record<string, string> = { remember: 'Data', understand: 'Information', apply: 'Knowledge', analyze: 'Knowledge', evaluate: 'Wisdom', create: 'Wisdom' };
                const dikwCounts: Record<string, number> = { Data: 0, Information: 0, Knowledge: 0, Wisdom: 0 };
                lessons.forEach(l => {
                  let highest = 'Data';
                  const order = ['Data', 'Information', 'Knowledge', 'Wisdom'];
                  (l.bloom_levels || []).forEach(bl => {
                    const mapped = dikwMap[bl.toLowerCase()];
                    if (mapped && order.indexOf(mapped) > order.indexOf(highest)) highest = mapped;
                  });
                  dikwCounts[highest]++;
                });
                const colors: Record<string, string> = { Data: '#3B82F6', Information: '#10B981', Knowledge: '#F59E0B', Wisdom: '#8B5CF6' };
                const total = lessons.length;
                return (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 mb-2">DIKW Learning Progression</p>
                    <div className="flex rounded-full overflow-hidden h-4 mb-2">
                      {Object.entries(dikwCounts).filter(([, c]) => c > 0).map(([level, count]) => (
                        <div key={level} className="h-full transition-all" style={{ width: `${(count / total) * 100}%`, background: colors[level] }} title={`${level}: ${count} lessons`} />
                      ))}
                    </div>
                    <div className="flex gap-3 text-[9px]">
                      {Object.entries(dikwCounts).filter(([, c]) => c > 0).map(([level, count]) => (
                        <span key={level} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: colors[level] }} />
                          <span className="font-bold" style={{ color: colors[level] }}>{level}</span>
                          <span className="text-gray-400">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Structured Syllabus — Gate by Gate */}
          {[...gates].sort((a, b) => a.gate_number - b.gate_number).map(g => {
            const gateLessons = lessons.filter(l => l.gate_id === g.id).sort((a, b) => a.lesson_number - b.lesson_number);
            return (
              <div key={g.id} className="card overflow-hidden">
                {/* Gate Header */}
                <div className="p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${g.color || '#6366f1'}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: g.color || '#6366f1' }}>
                    G{g.gate_number}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{g.title}</h3>
                    <p className="text-[11px] text-gray-500">
                      {gateLessons.length} lesson{gateLessons.length !== 1 ? 's' : ''}
                      {g.sub_concepts && g.sub_concepts.length > 0 ? ` · ${g.sub_concepts.length} sub-concepts` : ''}
                      {g.period ? ` · ${g.period}` : ''}
                    </p>
                  </div>
                </div>

                {/* Sub-concepts */}
                {g.sub_concepts && g.sub_concepts.length > 0 && (
                  <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                    {g.sub_concepts.map(sc => (
                      <span key={sc.id} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{sc.title}</span>
                    ))}
                  </div>
                )}

                {/* Lessons with Objectives */}
                <div className="border-t border-gray-100">
                  {gateLessons.map((l, idx) => (
                    <div key={l.id} className={`px-5 py-3 ${idx < gateLessons.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-[11px] font-bold text-gray-400 mt-0.5 w-7 shrink-0">L{l.lesson_number}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{l.title}</p>
                          {l.objective && (
                            <p className="text-[12px] text-gray-600 mt-1">
                              <span className="font-medium text-leap-blue">Objective:</span> {l.objective}
                            </p>
                          )}
                          {l.key_idea && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              <span className="font-medium text-gray-400">Key Idea:</span> {l.key_idea}
                            </p>
                          )}
                          {l.bloom_levels && l.bloom_levels.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {l.bloom_levels.map(bl => <BloomBadge key={bl} level={bl} />)}
                              <DIKWBadgeFromBloom bloomLevels={l.bloom_levels} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {gateLessons.length === 0 && (
                    <div className="px-5 py-3 text-[12px] text-gray-400 italic">No lessons in this gate yet</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Original Uploaded Syllabus (Collapsible) */}
          {course.syllabus_text && (
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowSyllabus(!showSyllabus)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div>
                  <h3 className="text-sm font-bold text-gray-700">Original Uploaded Syllabus</h3>
                  <p className="text-[11px] text-gray-400">{course.syllabus_text.length.toLocaleString()} characters</p>
                </div>
                <span className="text-gray-400 text-sm transition-transform" style={{ transform: showSyllabus ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
              </button>
              {showSyllabus && (
                <div className="animate-slide-down border-t border-gray-100 p-5 max-h-[60vh] overflow-y-auto">
                  <pre className="text-[12px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{course.syllabus_text}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Knowledge Graph Tab */}
      {tab === 'kg' && (
        <div className="fade-in space-y-3">
          {/* Dependency Graph */}
          {edges.length > 0 && (
            <div className="card p-5 mb-4">
              <h3 className="section-header mb-4">Gate Dependency Flow</h3>
              <GateDependencyGraph gates={gates} edges={edges} />
            </div>
          )}
          {gates.map(g => (
            <div key={g.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedGate(expandedGate === g.id ? null : g.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: g.color }}>G{g.gate_number}</div>
                  <div>
                    <h3 className="font-bold text-gray-900">{g.title}</h3>
                    <p className="text-[11px] text-gray-500">{g.period} | {g.sub_concepts?.length || 0} sub-concepts | {lessons.filter(l => l.gate_id === g.id).length} lessons | {questions.filter(q => q.gate_id === g.id).length} questions</p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm transition-transform" style={{ transform: expandedGate === g.id ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
              </button>
              {expandedGate === g.id && (
                <div className="animate-slide-down border-t border-gray-100 p-5">
                  <div className="grid grid-cols-3 gap-5">
                    <div>
                      <h4 className="section-header mb-2">Sub-Concepts</h4>
                      {g.sub_concepts?.map(sc => (
                        <div key={sc.id} className="py-1.5 text-sm text-gray-700 border-b border-gray-50 last:border-0">{sc.title}</div>
                      ))}
                    </div>
                    <div>
                      <h4 className="section-header mb-2">Lessons</h4>
                      {lessons.filter(l => l.gate_id === g.id).map(l => (
                        <div key={l.id} className="py-1.5 text-sm">
                          <p className="text-gray-700 font-medium">L{l.lesson_number}: {l.title}</p>
                          <p className="text-[11px] text-gray-500">{l.objective}</p>
                          <div className="flex gap-1 mt-1">{l.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="section-header mb-2">Diagnostic Questions</h4>
                      {questions.filter(q => q.gate_id === g.id).map(q => (
                        <div key={q.id} className="py-1.5 text-sm">
                          <p className="text-gray-700">{q.question_text}</p>
                          <div className="flex gap-1 mt-1">
                            <BloomBadge level={q.bloom_level} />
                            <span className="badge bg-gray-100 text-gray-500">{q.question_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lessons Tab */}
      {tab === 'lessons' && (
        <div className="fade-in space-y-3">
          {lessons.map(l => (
            <div key={l.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedLesson(expandedLesson === l.id ? null : l.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">Lesson {l.lesson_number}: {l.title}</h3>
                    {l.socratic_scripts && l.socratic_scripts.length > 0 && <span className="badge bg-purple-100 text-purple-700">Socratic Script</span>}
                  </div>
                  <p className="text-[12px] text-gray-500 mt-1">{l.objective}</p>
                  <div className="flex gap-1 mt-2">{l.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-gray-100 text-gray-500">{l.duration_minutes}min</span>
                  <span className="badge bg-purple-100 text-purple-700">{l.socratic_scripts?.length || 0} stages</span>
                  <span className="badge bg-leap-navy/10 text-leap-navy">{questions.filter(q => (q as any).lesson_id === l.id || q.gate_id === l.gate_id).length > 10 ? 10 : questions.filter(q => (q as any).lesson_id === l.id).length || 10} quiz Q</span>
                  <Link
                    to={`/teacher/courses/${courseId}/lessons/${l.id}`}
                    className="btn-primary text-[10px] py-1 px-2.5"
                    onClick={e => e.stopPropagation()}
                  >
                    View Full Lesson
                  </Link>
                  <span className="text-gray-400 text-sm transition-transform" style={{ transform: expandedLesson === l.id ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
                </div>
              </button>
              {expandedLesson === l.id && (
                <div className="animate-slide-down border-t border-gray-100 p-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      {l.key_idea && <div className="mb-3"><h4 className="section-header mb-1">Key Idea</h4><p className="text-sm text-gray-700">{l.key_idea}</p></div>}
                      {l.conceptual_breakthrough && <div className="mb-3"><h4 className="section-header mb-1">Conceptual Breakthrough</h4><p className="text-sm text-gray-700">{l.conceptual_breakthrough}</p></div>}
                      {l.examples && l.examples.length > 0 && <div className="mb-3"><h4 className="section-header mb-1">Examples</h4>{l.examples.map((ex: any, i: number) => <p key={i} className="text-sm text-gray-600">- {ex.text || ex}</p>)}</div>}
                      {l.exercises && l.exercises.length > 0 && <div><h4 className="section-header mb-1">Exercises</h4>{l.exercises.map((ex: any, i: number) => <p key={i} className="text-sm text-gray-600">- {ex.text || ex}</p>)}</div>}
                    </div>
                    {l.socratic_scripts && l.socratic_scripts.length > 0 && (
                      <div>
                        <h4 className="section-header mb-2">Socratic Script</h4>
                        <div className="border-l-2 border-purple-300 pl-4 space-y-3">
                          {l.socratic_scripts.map(s => (
                            <div key={s.id}>
                              <p className="text-sm font-medium text-purple-700">Stage {s.stage_number}: {s.stage_title} <span className="text-gray-400 font-normal">({s.duration_minutes}min)</span></p>
                              <p className="text-sm text-gray-700 mt-0.5"><strong>Ask:</strong> "{s.teacher_prompt}"</p>
                              {s.expected_response && <p className="text-[11px] text-gray-500 mt-0.5"><strong>Expect:</strong> {s.expected_response}</p>}
                              {s.follow_up && <p className="text-[11px] text-gray-500"><strong>Bridge:</strong> {s.follow_up}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Socratic Scripts Tab */}
      {tab === 'scripts' && (
        <div className="fade-in space-y-5">
          {lessons.filter(l => l.socratic_scripts?.length).map(l => (
            <div key={l.id} className="card p-5">
              <h3 className="font-bold text-gray-900 mb-1">Lesson {l.lesson_number}: {l.title}</h3>
              <p className="text-[12px] text-gray-500 mb-4">{l.objective}</p>
              <div className="border-l-2 border-purple-300 pl-4 space-y-4">
                {l.socratic_scripts?.map(s => (
                  <div key={s.id} className="bg-purple-50/50 rounded-xl p-3">
                    <p className="text-sm font-medium text-purple-700">Stage {s.stage_number}: {s.stage_title} <span className="text-gray-400 font-normal">({s.duration_minutes}min)</span></p>
                    <p className="text-sm text-gray-800 mt-1 italic">"{s.teacher_prompt}"</p>
                    {s.expected_response && <p className="text-[11px] text-gray-600 mt-1"><span className="font-medium">Expected:</span> {s.expected_response}</p>}
                    {s.follow_up && <p className="text-[11px] text-gray-500 mt-0.5"><span className="font-medium">Bridge:</span> {s.follow_up}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Questions Tab */}
      {tab === 'questions' && (
        <div className="fade-in space-y-3">
          {questions.map(q => (
            <div key={q.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div>
                  <p className="text-sm text-gray-900">{q.question_text}</p>
                  <div className="flex gap-2 mt-2">
                    <BloomBadge level={q.bloom_level} />
                    <span className="badge bg-gray-100 text-gray-600">{q.question_type}</span>
                    {q.is_diagnostic && <span className="badge bg-amber-100 text-amber-700">diagnostic</span>}
                  </div>
                </div>
                <span className="text-gray-400 text-sm transition-transform" style={{ transform: expandedQuestion === q.id ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
              </button>
              {expandedQuestion === q.id && (
                <div className="animate-slide-down border-t border-gray-100 p-5 text-sm">
                  {q.options && q.options.length > 0 && (
                    <div className="mb-3">
                      <h4 className="section-header mb-1">Options</h4>
                      {q.options.map((o, i) => (
                        <div key={i} className={`py-1 px-2 rounded-lg ${o.is_correct ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-600'}`}>
                          {o.is_correct ? '\u2713 ' : ''}{o.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.correct_answer && <div className="mb-3"><h4 className="section-header mb-1">Answer</h4><p className="text-gray-700">{q.correct_answer}</p></div>}
                  {q.rubric && <div className="mb-3"><h4 className="section-header mb-1">Rubric</h4><p className="text-gray-700">{q.rubric}</p></div>}
                  {q.distractors && q.distractors.length > 0 && (
                    <div><h4 className="section-header mb-1">Distractors (Common Misconceptions)</h4>
                      {q.distractors.map((d, i) => <p key={i} className="text-gray-600">- {d.answer}: <span className="text-gray-400">{d.misconception}</span></p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timetable Tab */}
      {tab === 'timetable' && hasTimetable && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[12px] text-gray-500">{course.total_sessions} sessions x {course.session_duration_minutes} min each</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-[12px]" onClick={() => {/* TODO: bulk download */}}>Download All Lesson Plans</button>
              <button className="btn-secondary text-[12px]" onClick={() => {/* TODO: bulk download */}}>Download All Quizzes</button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 mb-2">No session plan generated yet.</p>
              <p className="text-[12px] text-gray-400">The timetable will be auto-generated when the course is finalized.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => {
                const lesson = s.lesson || lessons.find(l => l.id === s.lesson_id);
                const gate = gates.find(g => g.id === lesson?.gate_id);
                const sessionQuestions = s.questions || questions.filter(q => q.gate_id === lesson?.gate_id);

                return (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-leap-navy text-white flex items-center justify-center text-sm font-black">
                          {s.session_number}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">
                            {lesson?.title || s.topic_summary}
                            {s.lesson_portion !== 'full' && (
                              <span className="badge bg-amber-100 text-amber-700 ml-2">{s.lesson_portion}</span>
                            )}
                          </h4>
                          <p className="text-[11px] text-gray-500">
                            {gate && <span style={{ color: gate.color }}>G{gate.gate_number}</span>}
                            {gate && ' | '}{s.topic_summary}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {lesson?.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}
                            {s.quiz_included && <span className="badge bg-purple-100 text-purple-700">{sessionQuestions.length} quiz Q</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="btn-secondary text-[11px] py-1.5 px-2.5" onClick={() => {/* TODO */}}>Lesson PDF</button>
                        <button className="btn-secondary text-[11px] py-1.5 px-2.5" onClick={() => {/* TODO */}}>Lesson Word</button>
                        <button className="btn-secondary text-[11px] py-1.5 px-2.5" onClick={() => {/* TODO */}}>Quiz PDF</button>
                        <button className="btn-secondary text-[11px] py-1.5 px-2.5" onClick={() => {/* TODO */}}>Quiz Word</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Students Tab */}
      {tab === 'students_tab' && (
        <div className="fade-in">
          {/* Load profiles on tab open */}
          {studentProfiles.length === 0 && (() => {
            api.get<any>(`/courses/${courseId}/diagnostic/status`).then(d => {
              setStudentProfiles(d.students || []);
            }).catch(() => {});
            return <div className="text-center py-8 text-gray-400">Loading student profiles...</div>;
          })()}

          {studentProfiles.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Left: Student roster */}
              <div className="lg:col-span-3">
                {/* Filters */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {['all', 'competent', 'deep', 'surface', 'struggling', 'not_assessed'].map(f => (
                    <button key={f} onClick={() => setProfileFilter(f)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${profileFilter === f ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {f === 'all' ? `All (${studentProfiles.length})` : f === 'not_assessed' ? `Not Assessed (${studentProfiles.filter(s => s.strategy_profile === 'not_assessed').length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${studentProfiles.filter(s => s.strategy_profile === f).length})`}
                    </button>
                  ))}
                </div>

                {/* Student table */}
                <div className="card p-4">
                  <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
                    <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr>
                          <th className="text-left py-2 pl-3 text-[10px] text-gray-400 font-medium rounded-l-lg">Student</th>
                          <th className="text-center py-2 text-[10px] text-gray-400 font-medium">Profile</th>
                          <th className="text-center py-2 text-[10px] text-gray-400 font-medium">Bloom</th>
                          <th className="text-center py-2 text-[10px] text-gray-400 font-medium">Prior Knowledge</th>
                          <th className="text-center py-2 text-[10px] text-gray-400 font-medium rounded-r-lg">Diagnostic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentProfiles
                          .filter(s => profileFilter === 'all' || s.strategy_profile === profileFilter)
                          .map(s => {
                            const strategyColors: Record<string, { bg: string; text: string }> = {
                              competent: { bg: '#D1FAE5', text: '#059669' },
                              deep: { bg: '#DBEAFE', text: '#2563EB' },
                              surface: { bg: '#FEF3C7', text: '#F59E0B' },
                              struggling: { bg: '#FEE2E2', text: '#DC2626' },
                              not_assessed: { bg: '#F3F4F6', text: '#9CA3AF' },
                            };
                            const sc = strategyColors[s.strategy_profile] || strategyColors.not_assessed;
                            const isSelected = selectedStudentProfile?.student_id === s.student_id;
                            return (
                              <tr key={s.student_id}
                                onClick={() => setSelectedStudentProfile(s)}
                                className={`cursor-pointer transition-all ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                <td className="py-2 pl-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-500'}`}>
                                      {s.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-[12px] font-medium text-gray-900">{s.name}</p>
                                      <p className="text-[9px] text-gray-400">{s.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center py-2">
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                                    {s.strategy_profile === 'not_assessed' ? 'Pending' : s.strategy_profile}
                                  </span>
                                </td>
                                <td className="text-center py-2">
                                  <span className="text-[10px] font-bold text-gray-600">{s.bloom_ceiling || '—'}</span>
                                </td>
                                <td className="text-center py-2">
                                  <span className="text-[10px] font-bold text-gray-600">{s.prior_knowledge_score > 0 ? `${s.prior_knowledge_score}%` : '—'}</span>
                                </td>
                                <td className="text-center py-2">
                                  <span className={`text-[9px] font-bold ${s.diagnostic_completed ? 'text-green-600' : 'text-gray-400'}`}>
                                    {s.diagnostic_completed ? '✓ Done' : 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right: Selected student profile */}
              <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                <div className="card p-4">
                  {!selectedStudentProfile ? (
                    <div className="text-center py-8">
                      <p className="text-3xl mb-2">👈</p>
                      <p className="text-[12px] text-gray-500">Select a student to view their full profile</p>
                    </div>
                  ) : (() => {
                    const s = selectedStudentProfile;
                    const strategyColors: Record<string, { bg: string; text: string }> = {
                      competent: { bg: '#D1FAE5', text: '#059669' },
                      deep: { bg: '#DBEAFE', text: '#2563EB' },
                      surface: { bg: '#FEF3C7', text: '#F59E0B' },
                      struggling: { bg: '#FEE2E2', text: '#DC2626' },
                      not_assessed: { bg: '#F3F4F6', text: '#9CA3AF' },
                    };
                    const sc = strategyColors[s.strategy_profile] || strategyColors.not_assessed;
                    return (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-leap-navy text-white flex items-center justify-center text-sm font-bold">{s.name.charAt(0)}</div>
                          <div className="flex-1">
                            <h3 className="text-sm font-black text-gray-900">{s.name}</h3>
                            <p className="text-[10px] text-gray-400">{s.email}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                            {s.strategy_profile === 'not_assessed' ? 'Not Assessed' : s.strategy_profile.charAt(0).toUpperCase() + s.strategy_profile.slice(1)}
                          </span>
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-leap-blue">{s.prior_knowledge_score || 0}%</p>
                            <p className="text-[8px] text-gray-400">Prior Knowledge</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-leap-purple">{s.bloom_ceiling || '—'}</p>
                            <p className="text-[8px] text-gray-400">Bloom Ceiling</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-green-600">{s.diagnostic_completed ? '✓' : '—'}</p>
                            <p className="text-[8px] text-gray-400">Diagnostic</p>
                          </div>
                        </div>

                        {/* Learning Style Radar */}
                        {s.learning_dimensions && (
                          <div className="mb-4">
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Learning Style</p>
                            <div className="space-y-1.5">
                              {Object.entries(s.learning_dimensions).map(([dim, val]) => (
                                <div key={dim} className="flex items-center gap-2">
                                  <span className="text-[10px] font-medium text-gray-500 w-20 capitalize">{dim}</span>
                                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-leap-blue transition-all" style={{ width: `${val}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-600 w-8 text-right">{val as number}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Strategy description */}
                        {s.strategy_profile !== 'not_assessed' && (
                          <div className="p-3 rounded-xl mb-4" style={{ background: sc.bg }}>
                            <p className="text-[10px] font-bold" style={{ color: sc.text }}>
                              {s.strategy_profile === 'competent' ? 'Uses flexible strategies, self-monitors, adapts approach' :
                               s.strategy_profile === 'deep' ? 'Seeks understanding and connections, developing metacognition' :
                               s.strategy_profile === 'surface' ? 'Relies on memorization, needs scaffolding for higher-order thinking' :
                               'Low across multiple dimensions, needs immediate intervention'}
                            </p>
                          </div>
                        )}

                        {!s.diagnostic_completed && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                            Diagnostic assessment not yet completed. Student will be prompted to take it on their next login.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="fade-in card p-6 max-w-xl">
          <h3 className="font-bold text-gray-900 mb-4">Course Settings</h3>
          <div className="space-y-4 text-sm">
            <div><label className="section-header block mb-1.5">Title</label><input defaultValue={course.title} className="input-field" /></div>
            <div><label className="section-header block mb-1.5">Subject</label><input defaultValue={course.subject} className="input-field" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="section-header block mb-1.5">Class Level</label><input defaultValue={course.class_level || ''} className="input-field" /></div>
              <div><label className="section-header block mb-1.5">Section</label><input defaultValue={course.section || ''} className="input-field" /></div>
            </div>
            <div><label className="section-header block mb-1.5">Mastery Threshold (%)</label><input type="number" defaultValue={course.mastery_threshold} className="input-field" /></div>
            <button className="btn-primary">Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
