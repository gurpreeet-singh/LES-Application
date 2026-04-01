import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';

interface DiagnosticQ {
  id: number;
  section: string;
  question_text: string;
  options: { text: string; value: string }[];
}

export function StudentDiagnosticPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<DiagnosticQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.get<any>(`/courses/${courseId}/diagnostic`).then(d => {
      if (d.completed) {
        setCompleted(true);
      } else {
        setQuestions(d.questions || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId]);

  if (loading) return <SkeletonPage />;

  // Already completed
  if (completed && !result) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-4xl mb-3">✅</p>
        <h2 className="text-lg font-black text-gray-900">Assessment Already Completed</h2>
        <p className="text-sm text-gray-500 mt-2">Your learning profile has been created.</p>
        <Link to="/student" className="btn-primary mt-4 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  // Results screen
  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-xl font-black text-gray-900 mb-4">Getting to Know You — Complete!</h2>
          <div className="space-y-3 text-left max-w-md mx-auto">
            <div className="p-3 bg-blue-50 rounded-xl">
              <p className="text-[11px] font-bold text-blue-600 uppercase">Prior Knowledge</p>
              <p className="text-sm text-blue-900">{result.summary.prior_knowledge}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <p className="text-[11px] font-bold text-green-600 uppercase">Your Strength</p>
              <p className="text-sm text-green-900">{result.summary.learning_strength}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <p className="text-[11px] font-bold text-purple-600 uppercase">Readiness</p>
              <p className="text-sm text-purple-900">{result.summary.readiness}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">Your teacher will use this to personalize your learning experience.</p>
          <Link to="/student" className="btn-primary mt-4 inline-block">Start Learning →</Link>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;

  const sectionLabels: Record<string, { label: string; icon: string; color: string }> = {
    prior_knowledge: { label: 'What You Already Know', icon: '📚', color: '#2563EB' },
    cognitive_readiness: { label: 'How You Think', icon: '🧠', color: '#7C3AED' },
    learning_strategy: { label: 'How You Learn', icon: '💡', color: '#F59E0B' },
    processing_preference: { label: 'What Works for You', icon: '🎯', color: '#059669' },
  };
  const section = sectionLabels[q.section] || { label: q.section, icon: '📝', color: '#6B7280' };
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post<any>(`/courses/${courseId}/diagnostic/submit`, { answers });
      setResult(res);
    } catch {
      alert('Failed to submit. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-xl font-black text-gray-900">Getting to Know Your Learning Style</h1>
        <p className="text-[12px] text-gray-500 mt-1">This is not a test — there are no wrong answers. We want to understand how you learn best.</p>
      </div>

      {/* Progress */}
      <div className="flex gap-0.5 mb-2">
        {questions.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
            i === currentQ ? 'bg-leap-navy scale-y-150' :
            answers[questions[i]?.id] !== undefined ? 'bg-green-400' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-right mb-4">{answeredCount}/{questions.length} answered</p>

      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{section.icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: section.color }}>{section.label}</span>
      </div>

      {/* Question */}
      <div className="card p-6 mb-4">
        <p className="text-[10px] text-gray-400 mb-2">Question {currentQ + 1} of {questions.length}</p>
        <p className="text-base font-medium text-gray-900 mb-5">{q.question_text}</p>

        <div className="space-y-2">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              onClick={() => setAnswers({ ...answers, [q.id]: opt.value })}
              className={`w-full text-left p-3.5 rounded-xl border-2 text-sm transition-all ${
                answers[q.id] === opt.value
                  ? 'border-leap-navy bg-blue-50 font-medium text-gray-900'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-3 text-[11px] font-bold ${
                answers[q.id] === opt.value ? 'bg-leap-navy text-white' : 'bg-gray-100 text-gray-500'
              }`}>{String.fromCharCode(65 + oi)}</span>
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="btn-secondary text-[12px] disabled:opacity-30"
        >← Previous</button>

        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="btn-primary text-[12px]"
          >Next →</button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={answeredCount < questions.length || submitting}
            className="btn-primary text-[12px] disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : `Complete Assessment (${answeredCount}/${questions.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
