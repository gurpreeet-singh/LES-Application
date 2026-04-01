import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface Question {
  id: string; gate_id: string; question_text: string; question_type: string;
  bloom_level: string; options: { text: string; is_correct: boolean }[] | null;
  correct_answer: string;
}

interface Gate { id: string; gate_number: number; title: string; short_title: string; color: string }

export function StudentQuizPage() {
  const { courseId, gateId } = useParams();
  const { profile } = useAuth();
  const [gate, setGate] = useState<Gate | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<string, { correct: boolean; score: number }>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [showPrediction, setShowPrediction] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ gate: Gate }>(`/courses/${courseId}/kg/gates/${gateId}`),
      api.get<{ questions: Question[] }>(`/courses/${courseId}/questions`),
    ]).then(([g, q]) => {
      setGate(g.gate);
      // Bloom-gated adaptive ordering: start with Remember/Understand, then Apply/Analyze, then Evaluate/Create
      const bloomOrder: Record<string, number> = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
      const gateQuestions = q.questions
        .filter(qu => qu.gate_id === gateId)
        .sort((a, b) => (bloomOrder[a.bloom_level] || 0) - (bloomOrder[b.bloom_level] || 0))
        .slice(0, 10);
      setQuestions(gateQuestions);
      setLoading(false);
    });
  }, [courseId, gateId]);

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) return;
    setSubmitting(true);

    const resultMap: Record<string, { correct: boolean; score: number }> = {};
    for (const q of questions) {
      const answer = answers[q.id] || '';
      if (!answer) continue;

      let isCorrect = false;
      let score = 0;

      if (q.question_type === 'mcq' || q.question_type === 'true_false') {
        const correctOption = q.options?.find(o => o.is_correct);
        isCorrect = correctOption?.text === answer;
        score = isCorrect ? (q.question_type === 'mcq' ? 2 : 1) : 0;
      } else {
        // Short answer / open-ended — give partial credit for any answer
        score = answer.length > 20 ? 3 : answer.length > 5 ? 2 : 1;
        isCorrect = score >= 2;
      }

      resultMap[q.id] = { correct: isCorrect, score };

      // Submit to API
      try {
        await api.post(`/students/${profile!.id}/progress/attempt`, {
          question_id: q.id,
          gate_id: gateId,
          answer_text: answer,
          is_correct: isCorrect,
          score: score * 20, // normalize to 0-100
          bloom_level_demonstrated: q.bloom_level,
        });
      } catch { /* continue */ }
    }

    setResults(resultMap);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="max-w-3xl mx-auto animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64" /><div className="card p-6 h-64" /></div>;

  const answeredCount = Object.keys(answers).length;
  const totalCorrect = Object.values(results).filter(r => r.correct).length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
        <Link to="/student" className="hover:text-leap-blue">Dashboard</Link>
        <span>›</span>
        <span className="text-gray-700 font-bold">Quiz — {gate?.short_title || 'Gate'}</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">
            {gate ? `G${gate.gate_number}: ${gate.title}` : 'Quiz'}
          </h1>
          <p className="text-[12px] text-gray-400">{questions.length} questions | {answeredCount} answered</p>
        </div>
        {gate && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: gate.color }}>
            G{gate.gate_number}
          </div>
        )}
      </div>

      {/* Metacognitive Prediction (before quiz) */}
      {!submitted && showPrediction && predictedScore === null && (
        <div className="card p-5 mb-5 bg-purple-50 border-purple-200">
          <h2 className="text-sm font-black text-purple-900 mb-2">Before you start: How do you think you'll score?</h2>
          <p className="text-[11px] text-purple-600 mb-3">Research shows that predicting your score helps you learn better. Be honest!</p>
          <div className="flex items-center gap-4">
            <input
              type="range" min="0" max="100" step="10" defaultValue="50"
              className="flex-1"
              onChange={e => {}}
              id="prediction-slider"
            />
            <button
              onClick={() => {
                const slider = document.getElementById('prediction-slider') as HTMLInputElement;
                setPredictedScore(parseInt(slider?.value || '50'));
                setShowPrediction(false);
              }}
              className="btn-primary text-[11px] py-1.5 px-4"
            >
              I predict {(document.getElementById('prediction-slider') as HTMLInputElement)?.value || 50}%
            </button>
          </div>
          <button onClick={() => { setPredictedScore(null); setShowPrediction(false); }} className="text-[10px] text-gray-400 hover:underline mt-2">Skip prediction</button>
        </div>
      )}

      {/* Results Summary (after submit) */}
      {submitted && (
        <div className={`card p-5 mb-5 border-l-4 ${totalCorrect >= questions.length * 0.6 ? 'border-l-green-400 bg-green-50/30' : 'border-l-amber-400 bg-amber-50/30'}`}>
          <h2 className="text-sm font-black text-gray-900 mb-1">
            {totalCorrect >= questions.length * 0.6 ? 'Good job!' : 'Keep practicing!'}
          </h2>
          <p className="text-[12px] text-gray-600">
            You got <strong>{totalCorrect}</strong> out of <strong>{Object.keys(results).length}</strong> correct
            ({Math.round((totalCorrect / Math.max(Object.keys(results).length, 1)) * 100)}%)
          </p>
          {/* Metacognitive comparison */}
          {predictedScore !== null && (
            <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-[11px] text-purple-800">
                <strong>Your prediction:</strong> {predictedScore}% | <strong>Actual:</strong> {Math.round((totalCorrect / Math.max(Object.keys(results).length, 1)) * 100)}%
                {Math.abs(predictedScore - Math.round((totalCorrect / Math.max(Object.keys(results).length, 1)) * 100)) <= 10
                  ? ' — Great calibration! You know yourself well.'
                  : predictedScore > Math.round((totalCorrect / Math.max(Object.keys(results).length, 1)) * 100)
                  ? ' — You were overconfident. Study the topics you got wrong.'
                  : ' — You underestimated yourself! You know more than you think.'}
              </p>
            </div>
          )}
          <Link to="/student" className="btn-primary text-[11px] mt-3 inline-block">Back to Dashboard</Link>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qi) => {
          const result = results[q.id];
          const isAnswered = !!answers[q.id];

          return (
            <div key={q.id} className={`card p-5 ${submitted && result ? (result.correct ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400') : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Q{qi + 1}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: gate ? gate.color + '15' : '#F3F4F6', color: gate?.color || '#6B7280' }}>
                  {q.bloom_level}
                </span>
                <span className="text-[9px] text-gray-400 capitalize">{q.question_type.replace('_', '/')}</span>
                {submitted && result && (
                  <span className={`text-[10px] font-bold ml-auto ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                    {result.correct ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-800 mb-3 leading-relaxed">{q.question_text}</p>

              {/* MCQ / True-False Options */}
              {(q.question_type === 'mcq' || q.question_type === 'true_false') && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = answers[q.id] === opt.text;
                    const showCorrect = submitted && opt.is_correct;
                    const showWrong = submitted && isSelected && !opt.is_correct;
                    return (
                      <button
                        key={oi}
                        onClick={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: opt.text }))}
                        disabled={submitted}
                        className={`w-full text-left p-3 rounded-xl text-[12px] border transition-all ${
                          showCorrect ? 'bg-green-50 border-green-300 text-green-800 font-bold' :
                          showWrong ? 'bg-red-50 border-red-300 text-red-800' :
                          isSelected ? 'bg-leap-navy/5 border-leap-navy text-leap-navy font-medium' :
                          'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span>
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Short Answer / Open Ended */}
              {(q.question_type === 'short_answer' || q.question_type === 'open_ended') && (
                <div>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={e => !submitted && setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    disabled={submitted}
                    rows={q.question_type === 'open_ended' ? 4 : 2}
                    className="input-field resize-y text-[12px]"
                    placeholder={q.question_type === 'open_ended' ? 'Write your detailed answer...' : 'Type your answer...'}
                  />
                  {submitted && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      <strong>Model answer:</strong> {q.correct_answer}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!submitted && questions.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-[12px] text-gray-400">{answeredCount} of {questions.length} answered</p>
          <button
            onClick={handleSubmit}
            disabled={answeredCount === 0 || submitting}
            className="btn-primary py-3 px-8"
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      )}
    </div>
  );
}
