import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import { generateQuizSheetPDF, generateAnswerKeyPDF } from '../../lib/quizPdfGenerator';
import { useAuth } from '../../context/AuthContext';

import { LessonAnalysis } from '../../components/teacher/LessonAnalysis';
type Tab = 'plan' | 'socratic' | 'quiz' | 'media' | 'analysis';
type QuizMode = 'review' | 'interactive';

function downloadCSV(questions: any[], lessonTitle: string) {
  const headers = ['#', 'Question', 'Type', 'Bloom Level', 'Correct Answer', 'Options', 'Rubric'];
  const rows = questions.map((q: any, i: number) => [
    i + 1,
    `"${(q.question_text || '').replace(/"/g, '""')}"`,
    q.question_type,
    q.bloom_level,
    `"${(q.correct_answer || '').replace(/"/g, '""')}"`,
    `"${(q.options || []).map((o: any) => `${o.text}${o.is_correct ? ' (correct)' : ''}`).join('; ').replace(/"/g, '""')}"`,
    `"${(q.rubric || '').replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiz_${lessonTitle.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadLessonPDF(lesson: any, gate: any, questions: any[]) {
  const scripts = lesson.socratic_scripts || [];
  const html = `<!DOCTYPE html><html><head><title>Lesson Plan - ${lesson.title}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1F2937}
h1{font-size:22px;border-bottom:2px solid #1B3A6B;padding-bottom:8px}h2{font-size:16px;color:#1B3A6B;margin-top:24px}
h3{font-size:14px;color:#374151;margin-top:16px}.meta{color:#6B7280;font-size:13px}
.script-stage{background:#F3F4F6;padding:12px;border-radius:8px;margin:8px 0;border-left:3px solid #7C3AED}
.question{border:1px solid #E5E7EB;padding:12px;border-radius:8px;margin:8px 0}
.correct{background:#D4EDDA;padding:4px 8px;border-radius:4px}
@media print{body{margin:20px}}</style></head><body>
<h1>Session ${lesson.lesson_number}: ${lesson.title}</h1>
<p class="meta">Topic ${gate?.gate_number || ''}: ${gate?.title || ''} | Duration: ${lesson.duration_minutes} min | Bloom's Taxonomy: ${(lesson.bloom_levels || []).join(', ')}</p>
<h2>Learning Objective</h2><p>${lesson.objective}</p>
${lesson.key_idea ? `<h2>Key Idea</h2><p>${lesson.key_idea}</p>` : ''}
${lesson.conceptual_breakthrough ? `<h2>Conceptual Breakthrough</h2><p>${lesson.conceptual_breakthrough}</p>` : ''}
<h2>Examples</h2>${(lesson.examples || []).map((e: any, i: number) => `<p>${i + 1}. ${e.text || e}</p>`).join('')}
<h2>Exercises</h2>${(lesson.exercises || []).map((e: any, i: number) => `<p>${i + 1}. ${e.text || e}</p>`).join('')}
${scripts.length > 0 ? `<h2>Socratic Teaching Script</h2>${scripts.map((s: any) => `
<div class="script-stage"><strong>Stage ${s.stage_number}: ${s.stage_title}</strong> (${s.duration_minutes} min)<br/>
<em>Ask:</em> "${s.teacher_prompt}"<br/>
<em>Expected:</em> ${s.expected_response || ''}<br/>
<em>Bridge:</em> ${s.follow_up || ''}</div>`).join('')}` : ''}
<h2>Quiz (${questions.length} Questions)</h2>${questions.map((q: any, i: number) => `
<div class="question"><strong>Q${i + 1}.</strong> ${q.question_text} <em>[${q.bloom_level} | ${q.question_type}]</em>
${q.options ? q.options.map((o: any) => `<br/>${o.is_correct ? '<span class="correct">' : ''}${o.text}${o.is_correct ? ' ✓</span>' : ''}`).join('') : ''}
${q.correct_answer ? `<br/><em>Answer:</em> ${q.correct_answer}` : ''}</div>`).join('')}
</body></html>`;
  // Create downloadable PDF via print-to-PDF
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      // Auto-trigger Save as PDF via print dialog
      setTimeout(() => w.print(), 500);
    };
  }
  // Also offer direct HTML download as fallback
  const a = document.createElement('a');
  a.href = url;
  a.download = `Lesson_${lesson.lesson_number}_${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LessonDetailPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('plan');
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [gate, setGate] = useState<any>(null);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>(`/courses/${courseId}/lessons/${lessonId}`),
      api.get<any>(`/courses/${courseId}/lessons`),
    ]).then(([detail, all]) => {
      setLesson(detail.lesson);
      setQuestions(detail.questions || []);
      setGate(detail.gate || null);
      setAllLessons(all.lessons || []);
      setLoading(false);
    });
  }, [courseId, lessonId]);

  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  // Interactive quiz state
  const [quizMode, setQuizMode] = useState<QuizMode>('review');
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizRevealed, setQuizRevealed] = useState<Record<number, boolean>>({});
  const quizScore = Object.entries(quizRevealed).filter(([i, revealed]) => {
    if (!revealed) return false;
    const q = questions[Number(i)];
    const ans = quizAnswers[Number(i)];
    if (q?.options?.length) return q.options.find((o: any) => o.is_correct)?.text === ans;
    return false;
  }).length;

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleGenerateQuiz = async (force = false) => {
    setGeneratingQuiz(true);
    try {
      // Use direct API for LLM calls to avoid Netlify proxy timeout
      const directUrl = import.meta.env.VITE_DIRECT_API_URL || import.meta.env.VITE_API_URL || '/api/v1';
      const stored = localStorage.getItem('les_demo_session');
      const token = stored ? JSON.parse(stored)?.session?.access_token : '';
      const res = await fetch(`${directUrl}/courses/${courseId}/questions/generate/${lessonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(force ? { force: true } : {}),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.questions?.length) setQuestions(result.questions);
      }
      setTab('quiz');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Quiz generation failed. Please try again.');
    }
    setGeneratingQuiz(false);
  };

  // Auto-generate quiz when lesson has 0 questions and user opens quiz tab
  useEffect(() => {
    if (tab === 'quiz' && questions.length === 0 && !generatingQuiz && lesson) {
      handleGenerateQuiz();
    }
  }, [tab]);

  if (loading || !lesson) return <SkeletonPage />;

  const currentIdx = allLessons.findIndex((l: any) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'plan', label: 'Lesson Plan' },
    { key: 'socratic', label: 'Socratic Script', count: lesson.socratic_scripts?.length || 0 },
    { key: 'quiz', label: 'Quiz', count: questions.length },
    { key: 'media', label: 'Media' },
    { key: 'analysis', label: 'Analysis' },
  ];

  const handleDownloadPDF = () => downloadLessonPDF(lesson, gate, questions);
  const handleDownloadCSV = () => downloadCSV(questions, lesson.title);

  const totalScriptDuration = lesson.socratic_scripts?.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0) || 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] mb-4">
        <Link to={`/teacher/courses/${courseId}/detail`} className="text-blue-600 hover:underline">Course</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500">Lesson {lesson.lesson_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">
            Session {lesson.lesson_number} of {allLessons.length}: {lesson.title}
          </h1>
          <p className="text-[12px] text-gray-500 mt-1">{lesson.objective}</p>
          <div className="flex items-center gap-3 mt-2">
            {gate && (
              <span className="badge text-white" style={{ background: gate.color }}>
                G{gate.gate_number}: {gate.short_title}
              </span>
            )}
            {lesson.bloom_levels?.map((bl: string) => <BloomBadge key={bl} level={bl} />)}
            <span className="badge bg-gray-100 text-gray-500">{lesson.duration_minutes} min</span>
          </div>
        </div>
        <div className="flex gap-2">
          {prevLesson && (
            <Link to={`/teacher/courses/${courseId}/lessons/${prevLesson.id}`} className="btn-secondary text-[11px] py-1.5">
              &larr; Prev Lesson
            </Link>
          )}
          {nextLesson && (
            <Link to={`/teacher/courses/${courseId}/lessons/${nextLesson.id}`} className="btn-primary text-[11px] py-1.5">
              Next Lesson &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Lesson Plan Tab */}
      {tab === 'plan' && (
        <div className="fade-in space-y-5">
          <div className="flex justify-end">
            <button onClick={handleDownloadPDF} className="btn-primary text-[11px] py-1.5">
              📄 Download Lesson Plan + Script (PDF)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {/* Left column */}
            <div className="space-y-4">
              {lesson.key_idea && (
                <div className="card p-5">
                  <h3 className="section-header mb-2">Key Idea</h3>
                  <p className="text-sm text-gray-700">{lesson.key_idea}</p>
                </div>
              )}
              {lesson.conceptual_breakthrough && (
                <div className="card p-5">
                  <h3 className="section-header mb-2">Conceptual Breakthrough</h3>
                  <p className="text-sm text-gray-700">{lesson.conceptual_breakthrough}</p>
                </div>
              )}
              {gate && (
                <div className="card p-5">
                  <h3 className="section-header mb-2">Gate Context</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: gate.color }}>G{gate.gate_number}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{gate.title}</p>
                      <p className="text-[11px] text-gray-500">{gate.period}</p>
                    </div>
                  </div>
                  {gate.sub_concepts && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {gate.sub_concepts.map((sc: any) => (
                        <span key={sc.id} className="badge bg-gray-100 text-gray-600">{sc.title}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {lesson.examples && lesson.examples.length > 0 && (
                <div className="card p-5">
                  <h3 className="section-header mb-2">Examples</h3>
                  <div className="space-y-2">
                    {lesson.examples.map((ex: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="badge bg-blue-100 text-blue-600 mt-0.5">{i + 1}</span>
                        <span>{ex.text || ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {lesson.exercises && lesson.exercises.length > 0 && (
                <div className="card p-5">
                  <h3 className="section-header mb-2">Exercises</h3>
                  <div className="space-y-2">
                    {lesson.exercises.map((ex: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="badge bg-green-100 text-green-600 mt-0.5">{i + 1}</span>
                        <span>{ex.text || ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="card p-5">
                <h3 className="section-header mb-2">Lesson Summary</h3>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-bold">{lesson.duration_minutes} minutes</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Bloom Levels</span><span className="font-bold">{lesson.bloom_levels?.join(', ')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Socratic Stages</span><span className="font-bold">{lesson.socratic_scripts?.length || 0} stages</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Quiz Questions</span><span className="font-bold">{questions.length} questions</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Socratic Script Tab */}
      {tab === 'socratic' && (
        <div className="fade-in">
          {!lesson.socratic_scripts || lesson.socratic_scripts.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              No Socratic script available for this lesson.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-header">Teaching Script Timeline</h3>
                  <span className="badge bg-purple-100 text-purple-700">{totalScriptDuration} min total</span>
                </div>
                {/* Timeline progress bar */}
                <div className="flex gap-1 mt-3">
                  {lesson.socratic_scripts.map((s: any) => (
                    <div
                      key={s.id}
                      className="h-2 rounded-full"
                      style={{
                        flex: s.duration_minutes,
                        background: `hsl(${270 - (s.stage_number * 30)}, 60%, 65%)`,
                      }}
                      title={`${s.stage_title}: ${s.duration_minutes} min`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                  <span>0 min</span>
                  <span>{totalScriptDuration} min</span>
                </div>
              </div>

              {lesson.socratic_scripts.map((s: any) => (
                <div key={s.id} className="card p-5 border-l-4 border-l-purple-400">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-black">
                        {s.stage_number}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{s.stage_title}</h4>
                        <span className="text-[11px] text-gray-500">{s.duration_minutes} minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 ml-10">
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Teacher Asks</p>
                      <p className="text-sm text-gray-800 italic">"{s.teacher_prompt}"</p>
                    </div>
                    {s.expected_response && (
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Expected Response</p>
                        <p className="text-sm text-gray-700">{s.expected_response}</p>
                      </div>
                    )}
                    {s.follow_up && (
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Bridge to Next</p>
                        <p className="text-sm text-gray-700">{s.follow_up}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quiz Tab */}
      {tab === 'quiz' && (
        <div className="fade-in">
          {questions.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">📝</div>
              <p className="text-sm font-bold text-gray-700 mb-1">No quiz generated yet for this session</p>
              <p className="text-[12px] text-gray-500 mb-4">AI will generate 10 questions tailored to this lesson, adapted based on past student performance.</p>
              <button onClick={handleGenerateQuiz} disabled={generatingQuiz} className="btn-primary">
                {generatingQuiz ? '🤖 Generating Quiz...' : '🤖 Generate Quiz for This Session'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="section-header">Quiz — {gate?.short_title || 'Assessment'}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">{questions.length} questions across Bloom levels</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Mode toggle */}
                  <button
                    onClick={() => { setQuizMode(quizMode === 'review' ? 'interactive' : 'review'); setQuizIdx(0); setQuizAnswers({}); setQuizRevealed({}); }}
                    className={quizMode === 'interactive' ? 'btn-primary text-[11px] py-1.5' : 'btn-secondary text-[11px] py-1.5 border-purple-300 text-purple-700 hover:bg-purple-50'}
                  >
                    {quizMode === 'interactive' ? '← Back to Review' : '▶ Take Interactive Quiz'}
                  </button>
                  {quizMode === 'review' && (
                    <>
                      <Link to={`/teacher/courses/${courseId}/lessons/${lessonId}/scores`} className="btn-primary text-[11px] py-1.5">📊 Enter Scores</Link>
                      <button onClick={() => handleGenerateQuiz(true)} disabled={generatingQuiz} className="btn-secondary text-[11px] py-1.5">
                        {generatingQuiz ? '🤖 Generating...' : '🔄 Regenerate Quiz'}
                      </button>
                      <button onClick={() => generateQuizSheetPDF(questions, {
                        lessonNumber: lesson.lesson_number, lessonTitle: lesson.title,
                        gateName: gate ? `G${gate.gate_number}: ${gate.short_title}` : '', gateColor: gate?.color || '#1B3A6B',
                        subject: 'Mathematics', classLevel: '5', section: 'B',
                        teacherName: profile?.full_name || 'Teacher', schoolName: 'La Martiniere Girls\' College',
                        duration: lesson.duration_minutes || 40,
                      })} className="btn-primary text-[11px] py-1.5">🖨️ Print Quiz Sheet</button>
                      <button onClick={() => generateAnswerKeyPDF(questions, {
                        lessonNumber: lesson.lesson_number, lessonTitle: lesson.title,
                        gateName: gate ? `G${gate.gate_number}: ${gate.short_title}` : '', gateColor: gate?.color || '#1B3A6B',
                        subject: 'Mathematics', classLevel: '5', section: 'B',
                        teacherName: profile?.full_name || 'Teacher', schoolName: 'La Martiniere Girls\' College',
                        duration: lesson.duration_minutes || 40,
                      })} className="btn-secondary text-[11px] py-1.5">🔑 Answer Key</button>
                      <button onClick={handleDownloadCSV} className="btn-secondary text-[11px] py-1.5">📊 CSV/Excel</button>
                      <Link to={`/teacher/courses/${courseId}/lessons/${lessonId}/grade`} className="btn-secondary text-[11px] py-1.5">📷 Upload Answer Sheets</Link>
                    </>
                  )}
                </div>
              </div>

              {/* ═══ INTERACTIVE QUIZ MODE ═══ */}
              {quizMode === 'interactive' && (() => {
                const totalQ = questions.length;
                const allDone = Object.keys(quizRevealed).length === totalQ;
                const q = questions[quizIdx];
                if (!q) return null;
                const answered = quizAnswers[quizIdx] !== undefined;
                const revealed = quizRevealed[quizIdx] || false;
                const correctOption = q.options?.find((o: any) => o.is_correct);
                const isCorrect = answered && correctOption && quizAnswers[quizIdx] === correctOption.text;

                return (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-500">Question {quizIdx + 1} of {totalQ}</span>
                        <span className="text-[11px] font-bold text-leap-blue">Score: {quizScore} / {Object.keys(quizRevealed).length}</span>
                      </div>
                      <div className="flex gap-1">
                        {questions.map((_: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => setQuizIdx(i)}
                            className={`h-2 flex-1 rounded-full transition-all ${
                              i === quizIdx ? 'bg-leap-navy scale-y-150' :
                              quizRevealed[i] ? (quizAnswers[i] === questions[i]?.options?.find((o: any) => o.is_correct)?.text ? 'bg-green-400' : 'bg-red-400') :
                              quizAnswers[i] !== undefined ? 'bg-amber-300' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Question card */}
                    <div className="card p-6">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-leap-navy text-white flex items-center justify-center text-sm font-black shrink-0">
                          {quizIdx + 1}
                        </div>
                        <div>
                          <p className="text-base text-gray-900 font-medium">{q.question_text}</p>
                          <div className="flex gap-2 mt-2">
                            <BloomBadge level={q.bloom_level?.charAt(0).toUpperCase() + q.bloom_level?.slice(1)} />
                            <span className="badge bg-gray-100 text-gray-600">{q.question_type}</span>
                          </div>
                        </div>
                      </div>

                      {/* MCQ Options - clickable */}
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {q.options.map((o: any, oi: number) => {
                            const selected = quizAnswers[quizIdx] === o.text;
                            const showCorrect = revealed && o.is_correct;
                            const showWrong = revealed && selected && !o.is_correct;
                            return (
                              <button
                                key={oi}
                                onClick={() => { if (!revealed) setQuizAnswers({ ...quizAnswers, [quizIdx]: o.text }); }}
                                disabled={revealed}
                                className={`w-full text-left flex items-center gap-3 text-sm py-3 px-4 rounded-xl border-2 transition-all ${
                                  showCorrect ? 'border-green-400 bg-green-50' :
                                  showWrong ? 'border-red-400 bg-red-50' :
                                  selected ? 'border-leap-navy bg-blue-50' :
                                  'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                  showCorrect ? 'bg-green-500 text-white' :
                                  showWrong ? 'bg-red-500 text-white' :
                                  selected ? 'bg-leap-navy text-white' :
                                  'bg-gray-100 text-gray-500'
                                }`}>{String.fromCharCode(65 + oi)}</span>
                                <span className={showCorrect ? 'text-green-800 font-medium' : showWrong ? 'text-red-800' : selected ? 'text-gray-900 font-medium' : 'text-gray-700'}>{o.text}</span>
                                {showCorrect && <span className="ml-auto text-green-600 font-bold">✓</span>}
                                {showWrong && <span className="ml-auto text-red-600 font-bold">✗</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Short answer - text input */}
                      {(!q.options || q.options.length === 0) && (
                        <div className="mt-4">
                          <input
                            type="text"
                            placeholder="Type your answer..."
                            value={quizAnswers[quizIdx] || ''}
                            onChange={e => { if (!revealed) setQuizAnswers({ ...quizAnswers, [quizIdx]: e.target.value }); }}
                            disabled={revealed}
                            className="input-field text-sm"
                          />
                          {revealed && q.correct_answer && (
                            <div className="mt-2 bg-green-50 rounded-lg p-3">
                              <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Correct Answer</p>
                              <p className="text-sm text-gray-700">{q.correct_answer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback after reveal */}
                      {revealed && q.options?.length > 0 && (
                        <div className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <p className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                            {isCorrect ? 'Correct!' : 'Incorrect'}
                          </p>
                          {q.explanation && <p className="text-[12px] text-gray-600 mt-1">{q.explanation}</p>}
                          {!isCorrect && q.distractors?.length > 0 && (
                            <p className="text-[11px] text-amber-700 mt-1">Common misconception: {q.distractors[0]?.misconception}</p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between mt-5">
                        <button onClick={() => setQuizIdx(Math.max(0, quizIdx - 1))} disabled={quizIdx === 0} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">← Previous</button>
                        <div className="flex gap-2">
                          {!revealed && answered && (
                            <button onClick={() => setQuizRevealed({ ...quizRevealed, [quizIdx]: true })} className="btn-primary text-[11px] py-1.5">Check Answer</button>
                          )}
                          {revealed && quizIdx < totalQ - 1 && (
                            <button onClick={() => setQuizIdx(quizIdx + 1)} className="btn-primary text-[11px] py-1.5">Next →</button>
                          )}
                        </div>
                        {!revealed && !answered && quizIdx < totalQ - 1 && (
                          <button onClick={() => setQuizIdx(quizIdx + 1)} className="btn-secondary text-[11px] py-1.5">Skip →</button>
                        )}
                        {(revealed || !answered) && quizIdx >= totalQ - 1 && <div />}
                      </div>
                    </div>

                    {/* Final score card */}
                    {allDone && (
                      <div className="card p-6 text-center bg-gradient-to-br from-leap-navy to-blue-800">
                        <p className="text-3xl font-black text-white">{quizScore} / {totalQ}</p>
                        <p className="text-sm text-white/70 mt-1">
                          {quizScore === totalQ ? 'Perfect score!' : quizScore >= totalQ * 0.7 ? 'Great job!' : quizScore >= totalQ * 0.4 ? 'Keep practicing!' : 'Review the lesson and try again'}
                        </p>
                        <button onClick={() => { setQuizIdx(0); setQuizAnswers({}); setQuizRevealed({}); }} className="mt-3 bg-white text-leap-navy px-4 py-1.5 rounded-lg text-[12px] font-bold hover:bg-gray-100 transition">
                          Retake Quiz
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ═══ REVIEW MODE (existing) ═══ */}
              {quizMode === 'review' && questions.map((q: any, qi: number) => (
                <div key={q.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-leap-navy text-white flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5">
                      {qi + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">{q.question_text}</p>
                      <div className="flex gap-2 mt-2">
                        <BloomBadge level={q.bloom_level.charAt(0).toUpperCase() + q.bloom_level.slice(1)} />
                        <span className="badge bg-gray-100 text-gray-600">{q.question_type}</span>
                        {q.is_diagnostic && <span className="badge bg-amber-100 text-amber-700">diagnostic</span>}
                      </div>

                      {/* MCQ Options */}
                      {q.options && q.options.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {q.options.map((o: any, oi: number) => (
                            <div key={oi} className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg ${o.is_correct ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                              <span className="text-[11px] text-gray-400 font-bold w-4">{String.fromCharCode(97 + oi)})</span>
                              <span className={o.is_correct ? 'text-green-800 font-medium' : 'text-gray-600'}>{o.text}</span>
                              {o.is_correct && <span className="text-green-600 text-[11px] ml-auto">✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Answer */}
                      {q.correct_answer && !q.options?.length && (
                        <div className="mt-3 bg-green-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Answer</p>
                          <p className="text-sm text-gray-700">{q.correct_answer}</p>
                        </div>
                      )}

                      {/* Rubric */}
                      {q.rubric && (
                        <div className="mt-2 bg-blue-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Rubric</p>
                          <p className="text-sm text-gray-700">{q.rubric}</p>
                        </div>
                      )}

                      {/* Distractors */}
                      {q.distractors && q.distractors.length > 0 && (
                        <div className="mt-2 bg-amber-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Common Misconceptions</p>
                          {q.distractors.map((d: any, di: number) => (
                            <p key={di} className="text-sm text-gray-600">
                              <span className="font-medium text-amber-700">{d.answer}:</span> {d.misconception}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media Tab */}
      {tab === 'media' && (
        <MediaPanel courseId={courseId!} lessonId={lessonId!} lessonTitle={lesson.title} lessonNumber={lesson.lesson_number} lesson={lesson} gate={gate} questions={questions} />
      )}

      {/* Analysis Tab */}
      {tab === 'analysis' && (
        <LessonAnalysis courseId={courseId!} lessonId={lessonId!} />
      )}

      {/* ═══ LESSON CHATBOT (Floating Widget) ═══ */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-slide-down">
            {/* Chat header */}
            <div className="bg-leap-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold">Lesson Assistant</p>
                <p className="text-[10px] text-white/60">Ask anything about this lesson</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/60 hover:text-white text-lg">✕</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-2xl mb-2">💬</p>
                  <p className="text-[12px] text-gray-500">Ask me anything about</p>
                  <p className="text-[12px] font-bold text-gray-700">"{lesson.title}"</p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {['Explain the key idea', 'Give me an example', 'What are the Bloom levels?', 'Summarize this lesson'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q); }}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                      >{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-leap-navy text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const msg = chatInput.trim();
                if (!msg || chatLoading) return;
                const newMessages = [...chatMessages, { role: 'user' as const, content: msg }];
                setChatMessages(newMessages);
                setChatInput('');
                setChatLoading(true);
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                try {
                  const directUrl = (import.meta as any).env?.VITE_DIRECT_API_URL || (import.meta as any).env?.VITE_API_URL || '/api/v1';
                  const stored = localStorage.getItem('les_demo_session');
                  const token = stored ? JSON.parse(stored)?.session?.access_token : '';
                  const res = await fetch(`${directUrl}/courses/${courseId}/lessons/${lessonId}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ message: msg, history: newMessages.slice(-10) }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setChatMessages([...newMessages, { role: 'assistant', content: data.response }]);
                  } else {
                    setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I could not process your request. Please try again.' }]);
                  }
                } catch {
                  setChatMessages([...newMessages, { role: 'assistant', content: 'Connection error. Please try again.' }]);
                }
                setChatLoading(false);
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="shrink-0 border-t border-gray-200 p-3 flex gap-2"
            >
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about this lesson..."
                className="flex-1 text-[12px] px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-leap-navy"
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading || !chatInput.trim()} className="bg-leap-navy text-white px-3 py-2 rounded-xl text-[12px] font-bold disabled:opacity-30 hover:bg-blue-800 transition">
                Send
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="w-14 h-14 bg-leap-navy text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
            title="Lesson Assistant"
          >
            <span className="text-xl">💬</span>
          </button>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
        {prevLesson ? (
          <Link to={`/teacher/courses/${courseId}/lessons/${prevLesson.id}`} className="btn-secondary text-[12px]">
            &larr; Lesson {prevLesson.lesson_number}: {prevLesson.title}
          </Link>
        ) : <div />}
        {nextLesson ? (
          <Link to={`/teacher/courses/${courseId}/lessons/${nextLesson.id}`} className="btn-primary text-[12px]">
            Lesson {nextLesson.lesson_number}: {nextLesson.title} &rarr;
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}

// ─── Media Panel Component ──────────────────────────────────

interface SlidePreview { type: string; title: string; subtitle?: string; icon: string; sectionLabel: string; bullets?: string[]; numberedItems?: string[]; speakerNotes: string; accentColor: string }

function MediaPanel({ courseId, lessonId, lessonTitle, lessonNumber, lesson, gate, questions }: { courseId: string; lessonId: string; lessonTitle: string; lessonNumber: number; lesson: any; gate: any; questions: any[] }) {
  const [slides, setSlides] = useState<SlidePreview[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [downloadingSlides, setDownloadingSlides] = useState(false);
  const [narrationScript, setNarrationScript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoSlideIdx, setVideoSlideIdx] = useState(0);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    api.get<{ slides: SlidePreview[] }>(`/courses/${courseId}/lessons/${lessonId}/media/slides/preview`)
      .then(d => { setSlides(d.slides); setSlidesLoading(false); })
      .catch(() => setSlidesLoading(false));
    api.get<{ script: string }>(`/courses/${courseId}/lessons/${lessonId}/media/narration/script`)
      .then(d => setNarrationScript(d.script))
      .catch(() => {});
    return () => { if (videoTimerRef.current) clearInterval(videoTimerRef.current); };
  }, [courseId, lessonId]);

  const getToken = () => JSON.parse(localStorage.getItem('les_demo_session') || '{}')?.session?.access_token;

  const handleDownloadSlides = async () => {
    setDownloadingSlides(true);
    try {
      const res = await fetch(`/api/v1/courses/${courseId}/lessons/${lessonId}/media/slides`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `Lesson_${lessonNumber}_${lessonTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Failed to download slides'); }
    setDownloadingSlides(false);
  };

  const getPreferredVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.name.includes('Samantha')) || voices.find(v => v.name.includes('Google UK English Female')) || voices.find(v => v.name.includes('Karen')) || voices.find(v => v.lang.startsWith('en-') && v.name.includes('Female')) || voices.find(v => v.lang.startsWith('en'));
  };

  // Segmented TTS with natural pauses
  const handlePlayNarration = () => {
    if (!narrationScript) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const segments = narrationScript.split('\n\n').filter(Boolean);
    let idx = 0;
    const speakNext = () => {
      if (idx >= segments.length) { setIsSpeaking(false); return; }
      const seg = segments[idx];
      const isQuestion = seg.includes('?');
      const isKey = seg.toLowerCase().includes('key idea') || seg.toLowerCase().includes('breakthrough');
      const utter = new SpeechSynthesisUtterance(seg);
      utter.rate = isKey ? 0.82 : isQuestion ? 0.88 : 0.92;
      utter.pitch = isQuestion ? 1.1 : 1.0;
      const voice = getPreferredVoice();
      if (voice) utter.voice = voice;
      utter.onend = () => { idx++; setTimeout(speakNext, 1500); };
      window.speechSynthesis.speak(utter);
    };
    speakNext();
  };

  const handleStopNarration = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };

  // Video — synced slides + per-slide narration with pauses
  const handlePlayVideo = () => {
    if (slides.length === 0) return;
    window.speechSynthesis.cancel();
    setVideoPlaying(true); setVideoSlideIdx(0);

    // Ensure voices are loaded (Chrome loads them async)
    const ensureVoices = (): Promise<void> => new Promise(resolve => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) { resolve(); return; }
      window.speechSynthesis.onvoiceschanged = () => resolve();
      setTimeout(resolve, 1000); // fallback after 1s
    });

    ensureVoices().then(() => {
      const speakSlide = (idx: number) => {
        if (idx >= slides.length) { setVideoPlaying(false); return; }
        setVideoSlideIdx(idx);
        const s = slides[idx];
        const items = s.numberedItems || s.bullets || [];
        let text = '';
        if (s.type === 'title') text = `${s.title}. ${s.subtitle || ''}`;
        else if (s.type === 'question') text = `${s.sectionLabel}. ${s.title}. ${items.join('. ')}. Take a moment to think about this.`;
        else if (s.type === 'breakthrough') text = `Here's the breakthrough moment. ${items.join('. ')}`;
        else if (s.type === 'example') text = `Let's look at some examples. ${items.map((it, i) => `Example ${i + 1}: ${it}`).join('. ')}`;
        else if (s.type === 'summary') text = `Let's recap. ${items.map(it => `${it}`).join('. ')}`;
        else text = `${s.title}. ${items.join('. ')}`;

        if (!text.trim()) { setTimeout(() => speakSlide(idx + 1), 500); return; }

        const isKey = s.type === 'concept' || s.type === 'breakthrough';
        const isQ = s.type === 'question';
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = isKey ? 0.82 : isQ ? 0.85 : 0.9;
        utter.pitch = isQ ? 1.08 : 1.0;
        const voice = getPreferredVoice();
        if (voice) utter.voice = voice;
        utter.onend = () => setTimeout(() => speakSlide(idx + 1), 2000);
        // Fallback: if onend doesn't fire within 30s, force advance
        const fallbackTimer = setTimeout(() => { speakSlide(idx + 1); }, 30000);
        utter.onend = () => { clearTimeout(fallbackTimer); setTimeout(() => speakSlide(idx + 1), 2000); };
        window.speechSynthesis.speak(utter);
      };
      speakSlide(0);
    });
  };

  const handleStopVideo = () => { window.speechSynthesis.cancel(); setVideoPlaying(false); };

  const slide = videoPlaying ? slides[videoSlideIdx] : slides[currentSlide];
  const activeIdx = videoPlaying ? videoSlideIdx : currentSlide;

  const renderSlide = (s: SlidePreview, idx: number, total: number) => {
    const color = `#${s.accentColor}`;
    const darkBg = s.type === 'title' || s.type === 'summary' || s.type === 'breakthrough';
    const bgMap: Record<string, string> = { title: color, summary: color, breakthrough: color, question: '#F5F3FF', activity: '#FFFBEB', example: '#FFFFFF' };
    const bg = bgMap[s.type] || '#FFFFFF';
    const items = s.numberedItems || s.bullets || [];
    const sideColor = s.type === 'example' ? '#16A34A' : s.type === 'activity' ? '#F59E0B' : color;

    return (
      <div key={idx} className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 rounded-lg shadow-card-lg overflow-hidden" style={{ background: bg }}>
          {/* Left accent sidebar */}
          {!darkBg && <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: sideColor }} />}

          {/* Decorative circle for dark slides */}
          {darkBg && <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: '#FFF' }} />}
          {darkBg && <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-10" style={{ background: '#FFF' }} />}

          {/* Section label + icon */}
          <div className="absolute top-3 left-5 flex items-center gap-1.5">
            <span className="text-base">{s.icon}</span>
            <span className={`text-[8px] font-bold tracking-widest ${darkBg ? 'text-white/60' : ''}`} style={!darkBg ? { color: sideColor } : {}}>{s.sectionLabel}</span>
          </div>

          {/* Slide number */}
          <div className="absolute top-3 right-4">
            <span className={`text-[9px] font-bold ${darkBg ? 'text-white/40' : 'text-gray-300'}`}>{idx + 1} / {total}</span>
          </div>

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-center px-8 pt-10 pb-8">
            {s.type === 'title' ? (
              <>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-3 leading-tight">{s.title}</h2>
                {s.subtitle && <pre className="text-[11px] text-white/60 whitespace-pre-wrap font-sans">{s.subtitle}</pre>}
              </>
            ) : darkBg ? (
              <>
                <h2 className="text-lg font-black text-white/80 mb-3">{s.title}</h2>
                <div className="space-y-2">
                  {items.map((b, i) => (
                    <div key={i} className="bg-white/15 backdrop-blur rounded-lg px-4 py-2.5">
                      <p className="text-sm text-white font-medium leading-relaxed">{s.type === 'summary' ? `✓  ${b}` : `"${b}"`}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : s.type === 'question' ? (
              <>
                <h2 className="text-base font-black text-gray-800 mb-3">{s.title}</h2>
                <div className="bg-white rounded-xl border border-purple-200 px-5 py-4 shadow-sm">
                  <p className="text-base text-purple-900 italic leading-relaxed">"{items[0] || ''}"</p>
                </div>
                {s.subtitle && <p className="text-[10px] text-gray-400 mt-3">{s.subtitle}</p>}
              </>
            ) : s.type === 'example' ? (
              <>
                <h2 className="text-base font-black text-gray-800 mb-3">{s.title}</h2>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex-1">
                        <p className="text-[12px] text-gray-700 leading-relaxed">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : s.type === 'activity' ? (
              <>
                <h2 className="text-base font-black text-amber-900 mb-1">{s.title}</h2>
                {s.subtitle && <p className="text-[10px] text-amber-600 mb-3">{s.subtitle}</p>}
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="bg-white rounded-lg border border-amber-200 px-4 py-2.5">
                      <p className="text-[12px] text-gray-700">{s.numberedItems ? `${i + 1}.  ${item}` : `•  ${item}`}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-black text-gray-800 mb-3">{s.title}</h2>
                <div className="space-y-2">
                  {items.map((b, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-2.5">
                      <p className="text-[12px] text-gray-700 leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!darkBg && (
            <div className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-between px-5" style={{ background: `${sideColor}08` }}>
              <span className="text-[8px] font-bold" style={{ color: sideColor }}>LEAP  ·  Session {lessonNumber}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in space-y-6">
      {/* ═══ SLIDES SECTION ═══ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-gray-900">Teaching Slides</h3>
            <p className="text-[11px] text-gray-400">{slides.length} slides — ready to present or download</p>
          </div>
          <button onClick={handleDownloadSlides} disabled={downloadingSlides || slides.length === 0} className="btn-primary text-[11px] py-1.5">
            {downloadingSlides ? 'Downloading...' : 'Download .pptx'}
          </button>
        </div>

        {slidesLoading ? (
          <div className="animate-pulse rounded-lg" style={{ aspectRatio: '16/9', background: '#F3F4F6' }} />
        ) : slides.length > 0 && slide ? (
          <div>
            <div key={activeIdx} className="slide-enter">
              {renderSlide(slide, activeIdx, slides.length)}
            </div>

            {/* Speaker Notes */}
            {slide.speakerNotes && !videoPlaying && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Speaker Notes</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{slide.speakerNotes}</p>
              </div>
            )}

            {/* Navigation (only when not in video mode) */}
            {!videoPlaying && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">&larr; Prev</button>
                <div className="flex gap-1">
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-leap-navy scale-125' : 'bg-gray-300 hover:bg-gray-400'}`} />
                  ))}
                </div>
                <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">Next &rarr;</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No slide data available</p>
        )}
      </div>

      {/* ═══ AUDIO NARRATION SECTION ═══ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-gray-900">Audio Narration</h3>
            <p className="text-[11px] text-gray-400">{isSpeaking ? 'Speaking...' : 'AI reads the lesson narration aloud'}</p>
          </div>
          <div className="flex gap-2">
            {isSpeaking ? (
              <button onClick={handleStopNarration} className="btn-secondary text-[11px] py-1.5 text-red-600 border-red-200 hover:bg-red-50">Stop</button>
            ) : (
              <button onClick={handlePlayNarration} disabled={!narrationScript} className="btn-primary text-[11px] py-1.5">
                ▶ Play Narration
              </button>
            )}
          </div>
        </div>
        {narrationScript && (
          <details className="mt-1">
            <summary className="text-[11px] font-bold text-gray-500 cursor-pointer hover:text-gray-700">View Narration Script ({narrationScript.length} chars)</summary>
            <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{narrationScript}</pre>
          </details>
        )}
      </div>

      {/* ═══ VIDEO SECTION (Synced Slides + Voice) ═══ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-gray-900">Lesson Video</h3>
            <p className="text-[11px] text-gray-400">
              {videoPlaying ? `Playing slide ${videoSlideIdx + 1} of ${slides.length}...` : 'Narrated slideshow — AI reads each slide aloud'}
            </p>
          </div>
          <div className="flex gap-2">
            {videoPlaying ? (
              <button onClick={handleStopVideo} className="btn-secondary text-[11px] py-1.5 text-red-600 border-red-200 hover:bg-red-50">Stop Video</button>
            ) : (
              <button onClick={handlePlayVideo} disabled={slides.length === 0} className="btn-primary text-[11px] py-1.5">
                ▶ Play Lesson Video
              </button>
            )}
          </div>
        </div>

        {videoPlaying && slides.length > 0 && (
          <div>
            <div key={videoSlideIdx} className="slide-enter">
              {renderSlide(slides[videoSlideIdx], videoSlideIdx, slides.length)}
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-leap-navy rounded-full transition-all duration-1000" style={{ width: `${((videoSlideIdx + 1) / slides.length) * 100}%` }} />
            </div>
          </div>
        )}

        {!videoPlaying && (
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-dashed border-gray-200 mt-2">
            <p className="text-[12px] text-gray-500">Click "Play Lesson Video" — AI voice will narrate each slide as it advances automatically</p>
          </div>
        )}
      </div>

      {/* ═══ MIND MAP SECTION ═══ */}
      <MindMapSection lesson={lesson} gate={gate} />

      {/* ═══ FLASHCARDS SECTION ═══ */}
      <FlashcardsSection lesson={lesson} questions={questions} />
    </div>
  );
}

// ─── Mind Map Component ────────────────────────────────────

interface MindNode { label: string; color?: string; children?: MindNode[] }

function MindMapSection({ lesson, gate }: { lesson: any; gate: any }) {
  const tree: MindNode = {
    label: lesson.title,
    color: gate?.color || '#1B3A6B',
    children: [
      ...(lesson.objective ? [{
        label: 'Learning Objective',
        color: '#2563EB',
        children: [{ label: lesson.objective }],
      }] : []),
      ...(lesson.key_idea ? [{
        label: 'Key Idea',
        color: '#16A34A',
        children: [{ label: lesson.key_idea }],
      }] : []),
      ...(lesson.conceptual_breakthrough ? [{
        label: 'Breakthrough',
        color: '#9333EA',
        children: [{ label: lesson.conceptual_breakthrough }],
      }] : []),
      ...(lesson.examples?.length > 0 ? [{
        label: 'Examples',
        color: '#0891B2',
        children: lesson.examples.map((ex: any, i: number) => ({ label: `${i + 1}. ${ex.text || ex}` })),
      }] : []),
      ...(lesson.exercises?.length > 0 ? [{
        label: 'Exercises',
        color: '#D97706',
        children: lesson.exercises.map((ex: any, i: number) => ({ label: `${i + 1}. ${ex.text || ex}` })),
      }] : []),
      ...(lesson.bloom_levels?.length > 0 ? [{
        label: 'Bloom Levels',
        color: '#DC2626',
        children: lesson.bloom_levels.map((bl: string) => ({ label: bl })),
      }] : []),
      ...(gate?.sub_concepts?.length > 0 ? [{
        label: `Gate: ${gate.short_title || gate.title}`,
        color: gate.color || '#6366F1',
        children: gate.sub_concepts.map((sc: any) => ({ label: sc.title })),
      }] : []),
    ],
  };

  const renderNode = (node: MindNode, depth: number, isLast: boolean) => {
    const color = node.color || '#6B7280';
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={node.label} className={depth === 0 ? '' : 'ml-6 relative'}>
        {depth > 0 && (
          <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-gray-200" style={isLast ? { bottom: '50%' } : {}} />
        )}
        {depth > 0 && (
          <div className="absolute left-[-16px] top-[14px] w-4 h-px bg-gray-200" />
        )}
        <div className="flex items-start gap-2 py-1.5">
          <div
            className={`shrink-0 rounded-full ${depth === 0 ? 'w-3.5 h-3.5 mt-0.5' : 'w-2.5 h-2.5 mt-1'}`}
            style={{ background: color }}
          />
          <p className={`${depth === 0 ? 'text-sm font-black text-gray-900' : depth === 1 ? 'text-[12px] font-bold text-gray-800' : 'text-[11px] text-gray-600'} leading-snug`}>
            {node.label}
          </p>
        </div>
        {hasChildren && (
          <div className="relative">
            {node.children!.map((child, i) => renderNode(child, depth + 1, i === node.children!.length - 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-gray-900">Mind Map</h3>
          <p className="text-[11px] text-gray-400">Visual overview of lesson concepts and structure</p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 max-h-[60vh] overflow-y-auto">
        {renderNode(tree, 0, true)}
      </div>
    </div>
  );
}

// ─── Flashcards Component ──────────────────────────────────

function FlashcardsSection({ lesson, questions }: { lesson: any; questions: any[] }) {
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  // Build flashcards from lesson content + questions
  const cards: { front: string; back: string; tag: string }[] = [];

  // From lesson content
  if (lesson.objective) cards.push({ front: `What is the learning objective of "${lesson.title}"?`, back: lesson.objective, tag: 'Objective' });
  if (lesson.key_idea) cards.push({ front: `What is the key idea?`, back: lesson.key_idea, tag: 'Key Idea' });
  if (lesson.conceptual_breakthrough) cards.push({ front: `What is the conceptual breakthrough?`, back: lesson.conceptual_breakthrough, tag: 'Breakthrough' });

  // From questions (MCQ → flashcard)
  questions.forEach(q => {
    if (q.options?.length > 0) {
      const correct = q.options.find((o: any) => o.is_correct);
      if (correct) {
        cards.push({
          front: q.question_text,
          back: `${correct.text}${q.explanation ? `\n\n${q.explanation}` : ''}`,
          tag: q.bloom_level?.charAt(0).toUpperCase() + q.bloom_level?.slice(1) || 'Quiz',
        });
      }
    } else if (q.correct_answer) {
      cards.push({
        front: q.question_text,
        back: q.correct_answer + (q.explanation ? `\n\n${q.explanation}` : ''),
        tag: q.bloom_level?.charAt(0).toUpperCase() + q.bloom_level?.slice(1) || 'Quiz',
      });
    }
  });

  if (cards.length === 0) return null;

  const card = cards[cardIdx];
  const remaining = cards.length - known.size;

  const tagColors: Record<string, string> = {
    Objective: 'bg-blue-100 text-blue-700',
    'Key Idea': 'bg-green-100 text-green-700',
    Breakthrough: 'bg-purple-100 text-purple-700',
    Remember: 'bg-slate-100 text-slate-700',
    Understand: 'bg-blue-100 text-blue-700',
    Apply: 'bg-green-100 text-green-700',
    Analyze: 'bg-amber-100 text-amber-700',
    Evaluate: 'bg-orange-100 text-orange-700',
    Create: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-gray-900">Flashcards</h3>
          <p className="text-[11px] text-gray-400">{cards.length} cards — {remaining} remaining to review</p>
        </div>
        {known.size > 0 && (
          <button onClick={() => { setKnown(new Set()); setCardIdx(0); setFlipped(false); }} className="btn-secondary text-[11px] py-1.5">
            Reset Progress
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="flex gap-0.5 mb-4">
        {cards.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${known.has(i) ? 'bg-green-400' : i === cardIdx ? 'bg-leap-navy' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer select-none"
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : '',
            minHeight: '220px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-gray-200 bg-white p-6 flex flex-col justify-center items-center text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className={`badge mb-3 ${tagColors[card?.tag] || 'bg-gray-100 text-gray-600'}`}>{card?.tag}</span>
            <p className="text-base text-gray-900 font-medium leading-relaxed">{card?.front}</p>
            <p className="text-[10px] text-gray-400 mt-4">Tap to reveal answer</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-green-300 bg-green-50 p-6 flex flex-col justify-center items-center text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className={`badge mb-3 ${tagColors[card?.tag] || 'bg-gray-100 text-gray-600'}`}>{card?.tag}</span>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{card?.back}</p>
            <p className="text-[10px] text-gray-400 mt-4">Tap to flip back</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => { setCardIdx(Math.max(0, cardIdx - 1)); setFlipped(false); }}
          disabled={cardIdx === 0}
          className="btn-secondary text-[11px] py-1.5 disabled:opacity-30"
        >← Prev</button>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setKnown(new Set([...known, cardIdx]));
              if (cardIdx < cards.length - 1) { setCardIdx(cardIdx + 1); setFlipped(false); }
            }}
            className="text-[11px] py-1.5 px-3 rounded-lg bg-green-100 text-green-700 font-bold hover:bg-green-200 transition"
          >Got it ✓</button>
          <button
            onClick={() => { if (cardIdx < cards.length - 1) { setCardIdx(cardIdx + 1); setFlipped(false); } }}
            className="text-[11px] py-1.5 px-3 rounded-lg bg-amber-100 text-amber-700 font-bold hover:bg-amber-200 transition"
          >Review again</button>
        </div>
        <button
          onClick={() => { setCardIdx(Math.min(cards.length - 1, cardIdx + 1)); setFlipped(false); }}
          disabled={cardIdx === cards.length - 1}
          className="btn-secondary text-[11px] py-1.5 disabled:opacity-30"
        >Next →</button>
      </div>

      {/* All done */}
      {known.size === cards.length && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-center">
          <p className="text-lg font-black text-white">All cards reviewed!</p>
          <p className="text-sm text-white/70">You've gone through all {cards.length} flashcards</p>
        </div>
      )}
    </div>
  );
}
