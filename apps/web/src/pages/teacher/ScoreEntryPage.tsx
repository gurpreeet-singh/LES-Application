import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import { toast } from '../../components/shared/Toast';

interface Student { id: string; full_name: string; roll_number?: string; }
interface Question { id: string; question_text: string; question_type: string; bloom_level: string; }

export function ScoreEntryPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const marksPerType: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

  useEffect(() => {
    Promise.all([
      api.get<any>(`/courses/${courseId}/lessons/${lessonId}`),
      api.get<{ students: Student[] }>(`/courses/${courseId}/students`).catch(() => ({ students: [] })),
    ]).then(([detail, s]) => {
      setLesson(detail.lesson);
      setQuestions(detail.questions || []);
      setStudents(s.students || []);
      // Initialize scores grid
      const initial: Record<string, Record<string, number>> = {};
      (s.students || []).forEach((st: Student) => { initial[st.id] = {}; });
      setScores(initial);
      setLoading(false);
    });
  }, [courseId, lessonId]);

  const getMaxScore = (q: Question) => marksPerType[q.question_type] || 2;
  const getTotalMax = () => questions.reduce((a, q) => a + getMaxScore(q), 0);

  const getStudentTotal = (studentId: string) => {
    const studentScores = scores[studentId] || {};
    return Object.values(studentScores).reduce((a, v) => a + (v || 0), 0);
  };

  const updateScore = (studentId: string, questionId: string, value: number) => {
    const max = getMaxScore(questions.find(q => q.id === questionId)!);
    const clamped = Math.min(Math.max(0, value), max);
    setScores(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [questionId]: clamped },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scoreData = students.map(s => ({
        student_id: s.id,
        question_scores: questions.map(q => ({
          question_id: q.id,
          score: scores[s.id]?.[q.id] || 0,
        })),
      }));

      await api.post(`/courses/${courseId}/lessons/${lessonId}/scores`, { scores: scoreData });
      toast('Scores saved successfully! Analytics updated.', 'success');
    } catch {
      toast('Failed to save scores. Please try again.', 'error');
    }
    setSaving(false);
  };

  const downloadGradeSheet = () => {
    const headers = ['#', 'Student', 'Roll', ...questions.map((_, i) => `Q${i + 1}`), 'Total', 'Max', '%'];
    const rows = students.map((s, si) => [
      si + 1, s.full_name, s.roll_number || '',
      ...questions.map(q => scores[s.id]?.[q.id] || 0),
      getStudentTotal(s.id), getTotalMax(),
      `${Math.round((getStudentTotal(s.id) / getTotalMax()) * 100)}%`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `scores_session_${lesson?.lesson_number || ''}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SkeletonPage />;

  return (
    <div>
      <Link to={`/teacher/courses/${courseId}/lessons/${lessonId}`} className="text-[12px] text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Lesson</Link>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Enter Scores</h1>
          <p className="text-[12px] text-gray-500">Session {lesson?.lesson_number}: {lesson?.title} | {questions.length} questions | Max {getTotalMax()} marks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadGradeSheet} className="btn-secondary text-[11px] py-1.5">📥 Download CSV</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-[11px] py-1.5">
            {saving ? 'Saving...' : '💾 Save All Scores'}
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-2">No students enrolled in this course.</p>
          <Link to={`/teacher/courses/${courseId}/students`} className="btn-primary inline-block">Add Students</Link>
        </div>
      ) : questions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-2">No quiz questions generated for this lesson yet.</p>
          <Link to={`/teacher/courses/${courseId}/lessons/${lessonId}`} className="btn-primary inline-block">Generate Quiz First</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 py-2.5 px-3 text-left text-[10px] font-bold text-gray-400 uppercase z-10">Student</th>
                {questions.map((q, qi) => (
                  <th key={q.id} className="py-2.5 px-1.5 text-center min-w-[50px]" title={q.question_text}>
                    <div className="text-[10px] font-bold text-gray-600">Q{qi + 1}</div>
                    <div className="text-[9px] text-gray-400">({getMaxScore(q)})</div>
                    <BloomBadge level={q.bloom_level.charAt(0).toUpperCase() + q.bloom_level.slice(1)} className="mt-0.5" />
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center text-[10px] font-bold text-gray-600">Total</th>
                <th className="py-2.5 px-3 text-center text-[10px] font-bold text-gray-600">%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, si) => {
                const total = getStudentTotal(s.id);
                const max = getTotalMax();
                const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                return (
                  <tr key={s.id} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="sticky left-0 bg-inherit py-2 px-3 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-les-navy text-white flex items-center justify-center text-[10px] font-bold">{s.full_name.charAt(0)}</div>
                        <div>
                          <p className="text-[12px] font-medium text-gray-900">{s.full_name}</p>
                          {s.roll_number && <p className="text-[10px] text-gray-400">Roll: {s.roll_number}</p>}
                        </div>
                      </div>
                    </td>
                    {questions.map(q => (
                      <td key={q.id} className="py-2 px-1.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={getMaxScore(q)}
                          value={scores[s.id]?.[q.id] ?? ''}
                          onChange={e => updateScore(s.id, q.id, parseInt(e.target.value) || 0)}
                          className="w-10 h-8 text-center text-[12px] font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-les-blue/30 focus:border-les-blue"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center">
                      <span className="text-[13px] font-black text-gray-900">{total}</span>
                      <span className="text-[10px] text-gray-400">/{max}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-[13px] font-black ${pct >= 75 ? 'text-les-green' : pct >= 60 ? 'text-les-amber' : 'text-les-red'}`}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
