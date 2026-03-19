import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { GateDependencyGraph } from '../../components/shared/GateDependencyGraph';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import type { Gate, Lesson, Question, Course } from '@les/shared';

type Tab = 'kg' | 'dependencies' | 'lessons' | 'scripts' | 'questions';

export function ReviewContentPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('kg');
  const [course, setCourse] = useState<Course | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showAcceptAllModal, setShowAcceptAllModal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ course: Course }>(`/courses/${courseId}`),
      api.get<{ gates: Gate[] }>(`/courses/${courseId}/kg/gates`),
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

  const updateGateStatus = async (gateId: string, status: string) => {
    await api.put(`/courses/${courseId}/kg/gates/${gateId}/status`, { status });
    setGates(prev => prev.map(g => g.id === gateId ? { ...g, status: status as Gate['status'] } : g));
  };

  const updateLessonStatus = async (lessonId: string, status: string) => {
    await api.put(`/courses/${courseId}/lessons/${lessonId}/status`, { status });
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: status as Lesson['status'] } : l));
  };

  const updateQuestionStatus = async (qId: string, status: string) => {
    await api.put(`/courses/${courseId}/questions/${qId}/status`, { status });
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, status: status as Question['status'] } : q));
  };

  const acceptAll = async () => {
    const draftGates = gates.filter(g => g.status === 'draft');
    const draftLessons = lessons.filter(l => l.status === 'draft');
    const draftQuestions = questions.filter(q => q.status === 'draft');

    await Promise.all([
      ...draftGates.map(g => updateGateStatus(g.id, 'accepted')),
      ...draftLessons.map(l => updateLessonStatus(l.id, 'accepted')),
      ...draftQuestions.map(q => updateQuestionStatus(q.id, 'accepted')),
    ]);
    setShowAcceptAllModal(false);
  };

  const handleFinalize = async () => {
    await api.post(`/courses/${courseId}/finalize`);
    navigate(`/teacher/courses/${courseId}/analytics`);
  };

  const totalItems = gates.length + lessons.length + questions.length;
  const reviewedItems = [...gates, ...lessons, ...questions].filter(i => i.status !== 'draft').length;
  const progressPct = totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 0;

  if (loading) return <SkeletonPage />;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'kg', label: 'Knowledge Graph', count: gates.length },
    { key: 'dependencies', label: 'Dependencies', count: edges.length },
    { key: 'lessons', label: 'Lessons', count: lessons.length },
    { key: 'scripts', label: 'Socratic Scripts', count: lessons.filter(l => l.socratic_scripts?.length).length },
    { key: 'questions', label: 'Questions', count: questions.length },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">{course?.title} - Review</h1>
          <p className="text-[12px] text-gray-500">{reviewedItems}/{totalItems} items reviewed</p>
          <div className="flex gap-3 mt-1">
            <span className="text-[11px] text-gray-400">{gates.length} gates</span>
            <span className="text-[11px] text-gray-400">{edges.length} dependencies</span>
            <span className="text-[11px] text-gray-400">{lessons.length} lessons</span>
            <span className="text-[11px] text-gray-400">{questions.length} questions</span>
            <span className="text-[11px] text-gray-400">{lessons.filter(l => l.socratic_scripts?.length).length} scripts</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAcceptAllModal(true)} className="btn-secondary border-green-200 text-green-700 hover:bg-green-50">Accept All Remaining</button>
          <button
            onClick={() => setShowFinalizeModal(true)}
            disabled={gates.some(g => g.status === 'draft')}
            className="btn-primary"
          >
            Finalize Course
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div className="bg-gradient-to-r from-les-blue to-les-navy h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-[12px] font-bold text-les-blue">{progressPct}%</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* KG Tab */}
      {tab === 'kg' && (
        <div className="fade-in space-y-3">
          {gates.map(g => (
            <div key={g.id} className={`card p-4 transition-all ${g.status === 'accepted' ? 'border-l-4 border-l-green-400' : g.status === 'rejected' ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: g.color }}>G{g.gate_number}</div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{g.title}</h3>
                    <p className="text-[11px] text-gray-500">{g.period} | {g.sub_concepts?.length || 0} sub-concepts</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {g.status === 'draft' ? (
                    <>
                      <button onClick={() => updateGateStatus(g.id, 'accepted')} className="btn-accept text-[12px] py-1.5">Accept</button>
                      <button onClick={() => updateGateStatus(g.id, 'rejected')} className="btn-reject text-[12px] py-1.5">Reject</button>
                    </>
                  ) : (
                    <span className={`badge ${g.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{g.status}</span>
                  )}
                </div>
              </div>
              {g.sub_concepts && g.sub_concepts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.sub_concepts.map(sc => (
                    <span key={sc.id} className="badge bg-gray-100 text-gray-600">{sc.title}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dependencies Tab */}
      {tab === 'dependencies' && (
        <div className="fade-in">
          <div className="card p-6">
            <h3 className="section-header mb-4">Gate Prerequisite Dependencies</h3>
            <GateDependencyGraph gates={gates} edges={edges} />
          </div>
        </div>
      )}

      {/* Lessons Tab */}
      {tab === 'lessons' && (
        <div className="fade-in space-y-3">
          {lessons.map(l => (
            <div key={l.id} className={`card p-4 transition-all ${l.status === 'accepted' || l.status === 'edited' ? 'border-l-4 border-l-green-400' : l.status === 'rejected' ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Lesson {l.lesson_number}: {l.title}</h3>
                  <p className="text-[12px] text-gray-600 mt-1">{l.objective}</p>
                  <div className="flex gap-1 mt-2">
                    {l.bloom_levels?.map(bl => <BloomBadge key={bl} level={bl} />)}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {l.status === 'draft' ? (
                    <>
                      <button onClick={() => updateLessonStatus(l.id, 'accepted')} className="btn-accept text-[12px] py-1.5">Accept</button>
                      <button onClick={() => updateLessonStatus(l.id, 'rejected')} className="btn-reject text-[12px] py-1.5">Reject</button>
                    </>
                  ) : (
                    <span className={`badge ${l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{l.status}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scripts Tab */}
      {tab === 'scripts' && (
        <div className="fade-in space-y-4">
          {lessons.filter(l => l.socratic_scripts?.length).map(l => (
            <div key={l.id} className="card p-4">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Lesson {l.lesson_number}: {l.title}</h3>
              <div className="space-y-2 ml-4 border-l-2 border-purple-300 pl-4">
                {l.socratic_scripts?.map(s => (
                  <div key={s.id} className="text-sm">
                    <p className="font-medium text-purple-700">Stage {s.stage_number}: {s.stage_title} ({s.duration_minutes}min)</p>
                    <p className="text-gray-600 mt-1"><strong>Ask:</strong> {s.teacher_prompt}</p>
                    {s.expected_response && <p className="text-[11px] text-gray-500"><strong>Expect:</strong> {s.expected_response}</p>}
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
            <div key={q.id} className={`card p-4 transition-all ${q.status === 'accepted' ? 'border-l-4 border-l-green-400' : q.status === 'rejected' ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900">{q.question_text}</p>
                  <div className="flex gap-2 mt-2">
                    <BloomBadge level={q.bloom_level} />
                    <span className="badge bg-gray-100 text-gray-600">{q.question_type}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {q.status === 'draft' ? (
                    <>
                      <button onClick={() => updateQuestionStatus(q.id, 'accepted')} className="btn-accept text-[12px] py-1.5">Accept</button>
                      <button onClick={() => updateQuestionStatus(q.id, 'rejected')} className="btn-reject text-[12px] py-1.5">Reject</button>
                    </>
                  ) : (
                    <span className={`badge ${q.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{q.status}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        open={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        onConfirm={handleFinalize}
        title="Finalize Course"
        description="This will activate the course, enroll students, and generate the timetable. This action cannot be easily undone."
        confirmLabel="Finalize"
        confirmColor="blue"
      />
      <ConfirmModal
        open={showAcceptAllModal}
        onClose={() => setShowAcceptAllModal(false)}
        onConfirm={acceptAll}
        title="Accept All Remaining"
        description={`This will accept all ${totalItems - reviewedItems} remaining draft items (gates, lessons, and questions).`}
        confirmLabel="Accept All"
        confirmColor="green"
      />
    </div>
  );
}
