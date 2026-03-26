import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import { generateQuizSheetPDF, generateAnswerKeyPDF } from '../../lib/quizPdfGenerator';
import { useAuth } from '../../context/AuthContext';

import { LessonAnalysis } from '../../components/teacher/LessonAnalysis';
type Tab = 'plan' | 'socratic' | 'quiz' | 'analysis';

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
  // Generate a printable HTML and trigger print
  const scripts = lesson.socratic_scripts || [];
  const html = `<!DOCTYPE html><html><head><title>Lesson Plan - ${lesson.title}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1F2937}
h1{font-size:22px;border-bottom:2px solid #1B3A6B;padding-bottom:8px}h2{font-size:16px;color:#1B3A6B;margin-top:24px}
h3{font-size:14px;color:#374151;margin-top:16px}.meta{color:#6B7280;font-size:13px}
.script-stage{background:#F3F4F6;padding:12px;border-radius:8px;margin:8px 0;border-left:3px solid #7C3AED}
.question{border:1px solid #E5E7EB;padding:12px;border-radius:8px;margin:8px 0}
.correct{background:#D4EDDA;padding:4px 8px;border-radius:4px}</style></head><body>
<h1>Session ${lesson.lesson_number}: ${lesson.title}</h1>
<p class="meta">Gate: G${gate?.gate_number || ''} ${gate?.title || ''} | Duration: ${lesson.duration_minutes} min | Bloom: ${(lesson.bloom_levels || []).join(', ')}</p>
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
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
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
                </div>
              </div>

              {questions.map((q: any, qi: number) => (
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

      {/* Analysis Tab */}
      {tab === 'analysis' && (
        <LessonAnalysis courseId={courseId!} lessonId={lessonId!} />
      )}

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
