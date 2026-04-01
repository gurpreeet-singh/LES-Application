import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';

export function StudentPrepPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { profile } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [prepStatus, setPrepStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    api.get<any>(`/courses/${courseId}/lessons/${lessonId}/prep`).then(d => {
      setLesson(d.lesson);
      setQuestions(d.readiness_questions || []);
      setPrepStatus(d.prep_status);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId, lessonId]);

  if (loading) return <SkeletonPage />;
  if (!lesson) return <div className="text-center py-16 text-gray-500">Lesson not found</div>;

  const handleSubmit = async () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.options?.length > 0) {
        const correctOpt = q.options.find((o: any) => o.is_correct);
        if (correctOpt && answers[i] === correctOpt.text) correct++;
      }
    });
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    setScore(pct);
    setSubmitted(true);

    // Save to backend
    try {
      await api.post(`/courses/${courseId}/lessons/${lessonId}/prep/submit`, { score: pct });
    } catch {}
  };

  // Already completed
  if (prepStatus?.prep_completed_at && !submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link to={`/student/courses/${courseId}/lessons/${lessonId}`} className="text-[12px] text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Lesson</Link>
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">✅</p>
          <h2 className="text-lg font-black text-gray-900">Prep Already Completed</h2>
          <p className="text-sm text-gray-500 mt-1">You scored {prepStatus.prep_score}% on the readiness check.</p>
          <Link to={`/student/courses/${courseId}/lessons/${lessonId}`} className="btn-primary mt-4 inline-block">Go to Lesson</Link>
        </div>
      </div>
    );
  }

  // Results screen
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <div className={`text-5xl font-black ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score}%</div>
          <p className="text-lg font-bold text-gray-900 mt-2">
            {score >= 80 ? 'Great! You\'re ready for class.' : score >= 60 ? 'Good foundation. Review the key idea once more.' : 'Review the material below before class.'}
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Link to={`/student/courses/${courseId}/lessons/${lessonId}`} className="btn-primary">Go to Lesson</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/student/courses/${courseId}/lessons/${lessonId}`} className="text-[12px] text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Lesson</Link>

      <div className="card p-6 mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📖</span>
          <div>
            <h1 className="text-lg font-black text-gray-900">Prepare for Session {lesson.lesson_number}</h1>
            <p className="text-[12px] text-gray-500">{lesson.title}</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-2"><strong>Objective:</strong> {lesson.objective}</p>
        {lesson.key_idea && <p className="text-sm text-gray-700 mb-2"><strong>Key Idea:</strong> {lesson.key_idea}</p>}
        {lesson.examples?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Examples to study:</p>
            {lesson.examples.map((ex: any, i: number) => (
              <p key={i} className="text-sm text-gray-600 ml-4">• {ex.text || ex}</p>
            ))}
          </div>
        )}
      </div>

      {/* Readiness Check */}
      {questions.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-black text-gray-900 mb-1">Readiness Check</h2>
          <p className="text-[11px] text-gray-500 mb-4">Answer these {questions.length} questions to check your understanding before class.</p>

          {/* Progress */}
          <div className="flex gap-1 mb-4">
            {questions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i === currentQ ? 'bg-leap-navy' : answers[i] !== undefined ? 'bg-green-400' : 'bg-gray-200'}`} />
            ))}
          </div>

          {/* Question */}
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 mb-1">Question {currentQ + 1} of {questions.length}</p>
            <p className="text-sm font-medium text-gray-900 mb-3">{questions[currentQ]?.question_text}</p>

            {questions[currentQ]?.options?.map((o: any, oi: number) => (
              <button
                key={oi}
                onClick={() => setAnswers({ ...answers, [currentQ]: o.text })}
                className={`w-full text-left p-3 rounded-xl border-2 mb-2 text-sm transition-all ${
                  answers[currentQ] === o.text ? 'border-leap-navy bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {String.fromCharCode(65 + oi)}. {o.text}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="btn-secondary text-[11px] disabled:opacity-30">← Previous</button>
            {currentQ < questions.length - 1 ? (
              <button onClick={() => setCurrentQ(currentQ + 1)} className="btn-primary text-[11px]" disabled={answers[currentQ] === undefined}>Next →</button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary text-[11px]" disabled={Object.keys(answers).length < questions.length}>Submit Readiness Check</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
