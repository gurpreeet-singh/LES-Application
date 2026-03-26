import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { GateDependencyGraph } from '../../components/shared/GateDependencyGraph';
import { KGCircleNodes } from '../../components/shared/KGCircleNodes';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import type { Gate, Lesson, Question, Course } from '@leap/shared';

type Tab = 'overview' | 'lessons';

export function ReviewContentPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [course, setCourse] = useState<Course | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [lessonSubTab, setLessonSubTab] = useState<Record<string, 'plan' | 'socratic' | 'quiz'>>({});
  const [loading, setLoading] = useState(true);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showAcceptAllModal, setShowAcceptAllModal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ course: Course }>(`/courses/${courseId}`),
      api.get<{ gates: Gate[]; edges: any[] }>(`/courses/${courseId}/kg/gates`),
      api.get<{ lessons: Lesson[] }>(`/courses/${courseId}/lessons`),
      api.get<{ questions: Question[] }>(`/courses/${courseId}/questions`),
    ]).then(([c, g, l, q]) => {
      setCourse(c.course);
      setGates(g.gates);
      setEdges(g.edges || []);
      setLessons(l.lessons);
      setQuestions(q.questions);
      setLoading(false);
    });
  }, [courseId]);

  // Accept entire lesson: lesson + its scripts + its questions
  const acceptLesson = async (lesson: Lesson) => {
    // Accept the lesson itself
    await api.put(`/courses/${courseId}/lessons/${lesson.id}/status`, { status: 'accepted' });
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'accepted' as any } : l));

    // Accept all questions for this lesson
    const lessonQuestions = questions.filter(q => (q as any).lesson_id === lesson.id || q.gate_id === lesson.gate_id);
    await Promise.all(
      lessonQuestions.filter(q => q.status === 'draft').map(q =>
        api.put(`/courses/${courseId}/questions/${q.id}/status`, { status: 'accepted' })
      )
    );
    setQuestions(prev => prev.map(q =>
      ((q as any).lesson_id === lesson.id || q.gate_id === lesson.gate_id) ? { ...q, status: 'accepted' as any } : q
    ));

    // Accept the parent gate if all its lessons are now accepted
    const gateLessons = lessons.filter(l => l.gate_id === lesson.gate_id);
    const allGateLessonsAccepted = gateLessons.every(l => l.id === lesson.id || l.status === 'accepted' || l.status === 'edited');
    if (allGateLessonsAccepted) {
      const gate = gates.find(g => g.id === lesson.gate_id);
      if (gate && gate.status === 'draft') {
        await api.put(`/courses/${courseId}/kg/gates/${gate.id}/status`, { status: 'accepted' });
        setGates(prev => prev.map(g => g.id === gate.id ? { ...g, status: 'accepted' as any } : g));
      }
    }
  };

  const rejectLesson = async (lesson: Lesson) => {
    await api.put(`/courses/${courseId}/lessons/${lesson.id}/status`, { status: 'rejected' });
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'rejected' as any } : l));
  };

  const acceptAll = async () => {
    // Accept all gates
    const draftGates = gates.filter(g => g.status === 'draft');
    await Promise.all(draftGates.map(g => api.put(`/courses/${courseId}/kg/gates/${g.id}/status`, { status: 'accepted' })));
    setGates(prev => prev.map(g => g.status === 'draft' ? { ...g, status: 'accepted' as any } : g));

    // Accept all lessons
    const draftLessons = lessons.filter(l => l.status === 'draft');
    await Promise.all(draftLessons.map(l => api.put(`/courses/${courseId}/lessons/${l.id}/status`, { status: 'accepted' })));
    setLessons(prev => prev.map(l => l.status === 'draft' ? { ...l, status: 'accepted' as any } : l));

    // Accept all questions
    const draftQuestions = questions.filter(q => q.status === 'draft');
    await Promise.all(draftQuestions.map(q => api.put(`/courses/${courseId}/questions/${q.id}/status`, { status: 'accepted' })));
    setQuestions(prev => prev.map(q => q.status === 'draft' ? { ...q, status: 'accepted' as any } : q));

    setShowAcceptAllModal(false);
  };

  const handleFinalize = async () => {
    try {
      await api.post(`/courses/${courseId}/finalize`);
      navigate(`/teacher/courses/${courseId}/detail`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to finalize. Please try again.');
    }
  };

  // Progress: count at lesson level (each lesson = 1 unit including its scripts + quiz)
  const acceptedLessons = lessons.filter(l => l.status === 'accepted' || l.status === 'edited').length;
  const rejectedLessons = lessons.filter(l => l.status === 'rejected').length;
  const reviewedLessons = acceptedLessons + rejectedLessons;
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((reviewedLessons / totalLessons) * 100) : 0;
  const allGatesAccepted = gates.every(g => g.status === 'accepted');

  if (loading) return <SkeletonPage />;

  const getLessonSubTab = (id: string) => lessonSubTab[id] || 'plan';
  const setLessonTab = (id: string, tab: 'plan' | 'socratic' | 'quiz') => setLessonSubTab(prev => ({ ...prev, [id]: tab }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">{course?.title} - Review</h1>
          <p className="text-[12px] text-gray-500">
            {reviewedLessons}/{totalLessons} lessons reviewed ({acceptedLessons} accepted, {rejectedLessons} rejected)
          </p>
          <div className="flex gap-3 mt-1">
            <span className="text-[11px] text-gray-400">{gates.length} gates</span>
            <span className="text-[11px] text-gray-400">{edges.length} dependencies</span>
            <span className="text-[11px] text-gray-400">{totalLessons} lessons</span>
            <span className="text-[11px] text-gray-400">{questions.length} questions</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAcceptAllModal(true)} className="btn-secondary border-green-200 text-green-700 hover:bg-green-50">
            Accept All Remaining
          </button>
          <button
            onClick={() => setShowFinalizeModal(true)}
            disabled={!allGatesAccepted || reviewedLessons < totalLessons}
            className="btn-primary"
          >
            Finalize Course
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div className="bg-gradient-to-r from-leap-blue to-leap-navy h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-[12px] font-bold text-leap-blue">{progressPct}%</span>
      </div>

      {/* Tabs: Overview (KG + Dependencies) | Lessons (main review) */}
      <div className="flex gap-1 mb-6">
        <button onClick={() => setTab('overview')} className={tab === 'overview' ? 'pill-tab-active' : 'pill-tab-inactive'}>
          Knowledge Graph ({gates.length} gates)
        </button>
        <button onClick={() => setTab('lessons')} className={tab === 'lessons' ? 'pill-tab-active' : 'pill-tab-inactive'}>
          Review Lessons ({totalLessons})
        </button>
      </div>

      {/* ===== OVERVIEW TAB: KG + Dependencies ===== */}
      {tab === 'overview' && (
        <div className="fade-in space-y-5">
          {/* Gates overview with accept/reject */}
          <div className="card p-5">
            <h3 className="section-header mb-4">Knowledge Graph — Gates</h3>
            <KGCircleNodes gates={gates} />
          </div>

          {/* Gate cards with accept/reject */}
          <div className="space-y-2">
            {gates.map(g => {
              const gateLessons = lessons.filter(l => l.gate_id === g.id);
              const gateQuestions = questions.filter(q => q.gate_id === g.id);
              return (
                <div key={g.id} className={`card p-4 transition-all ${g.status === 'accepted' ? 'border-l-4 border-l-green-400' : g.status === 'rejected' ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: g.color }}>G{g.gate_number}</div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{g.title}</h3>
                        <p className="text-[11px] text-gray-500">{g.period} | {g.sub_concepts?.length || 0} sub-concepts | {gateLessons.length} lessons | {gateQuestions.length} questions</p>
                      </div>
                    </div>
                    <span className={`badge ${g.status === 'accepted' ? 'bg-green-100 text-green-700' : g.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.status === 'draft' ? 'auto-accepts when lessons approved' : g.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dependencies */}
          {edges.length > 0 && (
            <div className="card p-5">
              <h3 className="section-header mb-4">Gate Dependencies</h3>
              <GateDependencyGraph gates={gates} edges={edges} />
            </div>
          )}

          <div className="text-center pt-2">
            <button onClick={() => setTab('lessons')} className="btn-primary">
              Start Reviewing Lessons →
            </button>
          </div>
        </div>
      )}

      {/* ===== LESSONS TAB: Lesson-centric review ===== */}
      {tab === 'lessons' && (
        <div className="fade-in space-y-3">
          {/* Group by gate */}
          {gates.map(g => {
            const gateLessons = lessons.filter(l => l.gate_id === g.id).sort((a, b) => a.lesson_number - b.lesson_number);
            if (gateLessons.length === 0) return null;

            return (
              <div key={g.id}>
                {/* Gate header */}
                <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: g.color }}>G{g.gate_number}</div>
                  <span className="section-header" style={{ color: g.color }}>{g.title}</span>
                  <span className="text-[10px] text-gray-400">{gateLessons.filter(l => l.status === 'accepted' || l.status === 'edited').length}/{gateLessons.length} accepted</span>
                </div>

                {/* Lesson cards */}
                {gateLessons.map(l => {
                  const isExpanded = expandedLesson === l.id;
                  const lessonQuestions = questions.filter(q => (q as any).lesson_id === l.id || q.gate_id === l.gate_id);
                  const subTab = getLessonSubTab(l.id);
                  const isAccepted = l.status === 'accepted' || l.status === 'edited';
                  const isRejected = l.status === 'rejected';

                  return (
                    <div key={l.id} className={`card overflow-hidden transition-all mb-2 ${isAccepted ? 'border-l-4 border-l-green-400' : isRejected ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}>
                      {/* Lesson header */}
                      <div className="p-4 flex items-center justify-between">
                        <button onClick={() => setExpandedLesson(isExpanded ? null : l.id)} className="flex items-center gap-3 text-left flex-1">
                          <div className="w-9 h-9 rounded-full bg-leap-navy text-white flex items-center justify-center text-[12px] font-black flex-shrink-0">
                            {l.lesson_number}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{l.title}</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">{l.objective}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {l.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}
                              <span className="badge bg-gray-100 text-gray-500">{l.duration_minutes || 40} min</span>
                              <span className="badge bg-purple-100 text-purple-700">{l.socratic_scripts?.length || 0} Socratic stages</span>
                              <span className="badge bg-leap-navy/10 text-leap-navy">{lessonQuestions.length} quiz Q</span>
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 ml-4">
                          {l.status === 'draft' ? (
                            <>
                              <button onClick={() => acceptLesson(l)} className="btn-accept text-[11px] py-1.5">Accept Lesson</button>
                              <button onClick={() => rejectLesson(l)} className="btn-reject text-[11px] py-1.5">Reject</button>
                            </>
                          ) : (
                            <span className={`badge ${isRejected ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{l.status}</span>
                          )}
                          <span className="text-gray-400 text-sm transition-transform cursor-pointer" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }} onClick={() => setExpandedLesson(isExpanded ? null : l.id)}>{'\u25BC'}</span>
                        </div>
                      </div>

                      {/* Expanded: Plan + Socratic + Quiz sub-tabs */}
                      {isExpanded && (
                        <div className="animate-slide-down border-t border-gray-100">
                          {/* Sub-tabs */}
                          <div className="flex gap-1 px-4 pt-3">
                            {(['plan', 'socratic', 'quiz'] as const).map(t => (
                              <button key={t} onClick={() => setLessonTab(l.id, t)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${subTab === t ? 'bg-leap-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                                {t === 'plan' ? 'Lesson Plan' : t === 'socratic' ? `Socratic Script (${l.socratic_scripts?.length || 0})` : `Quiz (${lessonQuestions.length})`}
                              </button>
                            ))}
                          </div>

                          <div className="p-4">
                            {/* Plan sub-tab */}
                            {subTab === 'plan' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  {l.key_idea && (
                                    <div><h5 className="section-header mb-1">Key Idea</h5><p className="text-[12px] text-gray-700">{l.key_idea}</p></div>
                                  )}
                                  {l.conceptual_breakthrough && (
                                    <div><h5 className="section-header mb-1">Conceptual Breakthrough</h5><p className="text-[12px] text-gray-700">{l.conceptual_breakthrough}</p></div>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  {l.examples && l.examples.length > 0 && (
                                    <div>
                                      <h5 className="section-header mb-1">Examples</h5>
                                      {l.examples.map((ex: any, i: number) => <p key={i} className="text-[12px] text-gray-600">• {ex.text || ex}</p>)}
                                    </div>
                                  )}
                                  {l.exercises && l.exercises.length > 0 && (
                                    <div>
                                      <h5 className="section-header mb-1">Exercises</h5>
                                      {l.exercises.map((ex: any, i: number) => <p key={i} className="text-[12px] text-gray-600">• {ex.text || ex}</p>)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Socratic sub-tab */}
                            {subTab === 'socratic' && (
                              <div>
                                {!l.socratic_scripts || l.socratic_scripts.length === 0 ? (
                                  <p className="text-[12px] text-gray-400">No Socratic script for this lesson.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {l.socratic_scripts.map(s => (
                                      <div key={s.id} className="border-l-3 border-purple-300 pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black">{s.stage_number}</div>
                                          <span className="text-[12px] font-bold text-purple-700">{s.stage_title}</span>
                                          <span className="text-[10px] text-gray-400">{s.duration_minutes} min</span>
                                        </div>
                                        <div className="ml-8 space-y-1.5">
                                          <div className="bg-blue-50 rounded-lg p-2">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase">Ask</p>
                                            <p className="text-[12px] text-gray-800 italic">"{s.teacher_prompt}"</p>
                                          </div>
                                          {s.expected_response && (
                                            <div className="bg-green-50 rounded-lg p-2">
                                              <p className="text-[10px] font-bold text-green-600 uppercase">Expect</p>
                                              <p className="text-[12px] text-gray-700">{s.expected_response}</p>
                                            </div>
                                          )}
                                          {s.follow_up && (
                                            <div className="bg-amber-50 rounded-lg p-2">
                                              <p className="text-[10px] font-bold text-amber-600 uppercase">Bridge</p>
                                              <p className="text-[12px] text-gray-700">{s.follow_up}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Quiz sub-tab */}
                            {subTab === 'quiz' && (
                              <div>
                                {lessonQuestions.length === 0 ? (
                                  <p className="text-[12px] text-gray-400">No quiz questions for this lesson.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {lessonQuestions.map((q, qi) => (
                                      <div key={q.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-6 h-6 rounded-full bg-leap-navy text-white flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5">
                                          {qi + 1}
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-[12px] text-gray-900">{q.question_text}</p>
                                          <div className="flex gap-1.5 mt-1">
                                            <BloomBadge level={q.bloom_level.charAt(0).toUpperCase() + q.bloom_level.slice(1)} />
                                            <span className="badge bg-gray-100 text-gray-500">{q.question_type}</span>
                                          </div>
                                          {q.options && q.options.length > 0 && (
                                            <div className="mt-1.5 space-y-0.5">
                                              {q.options.map((o: any, oi: number) => (
                                                <p key={oi} className={`text-[11px] pl-2 ${o.is_correct ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                                                  {String.fromCharCode(97 + oi)}) {o.text} {o.is_correct && '✓'}
                                                </p>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        open={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        onConfirm={handleFinalize}
        title="Finalize Course"
        description="This will activate the course, generate the timetable, and make it available to students. This action cannot be easily undone."
        confirmLabel="Finalize & Publish"
        confirmColor="blue"
      />
      <ConfirmModal
        open={showAcceptAllModal}
        onClose={() => setShowAcceptAllModal(false)}
        onConfirm={acceptAll}
        title="Accept All Remaining"
        description={`This will accept all ${totalLessons - reviewedLessons} remaining lessons along with their Socratic scripts, quizzes, and parent gates.`}
        confirmLabel="Accept All"
        confirmColor="green"
      />
    </div>
  );
}
