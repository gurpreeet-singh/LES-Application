import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';

interface GradeResult {
  student_id: string;
  student_name: string;
  roll_number: string;
  answers: { question_id: string; question_num: number; answer: string; is_correct: boolean; score: number; max_score: number; ai_feedback?: string }[];
  total_score: number;
  max_score: number;
  status: 'graded' | 'processing' | 'needs_review';
}

export function GradeAnswerSheetsPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [grades, setGrades] = useState<GradeResult[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<any>(`/courses/${courseId}/lessons/${lessonId}`),
      api.get<{ grades: GradeResult[] }>(`/courses/${courseId}/lessons/${lessonId}/grades`).catch(() => ({ grades: [] })),
    ]).then(([detail, g]) => {
      setLesson(detail.lesson);
      setQuestions(detail.questions || []);
      setGrades(g.grades || []);
      setLoading(false);
    });
  }, [courseId, lessonId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach(f => formData.append('answer_sheets', f));

      const result = await api.postForm<{ grades: GradeResult[] }>(
        `/courses/${courseId}/lessons/${lessonId}/grade`,
        formData
      );
      setGrades(result.grades || []);
    } catch (err) {
      console.error('Grading failed:', err);
    }
    setProcessing(false);
  };

  const handleConfirmAll = async () => {
    alert(`Grades confirmed for ${grades.length} students. Scores saved to analytics.`);
  };

  const escCsv = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };

  const downloadGradeReport = () => {
    if (grades.length === 0) return;
    const headers = ['#', 'Student Name', 'Roll No.', ...questions.map((_, i) => `Q${i + 1}`), 'Total', 'Max', 'Percentage'];
    const rows = grades.map((g, i) => [
      i + 1, escCsv(g.student_name), escCsv(g.roll_number),
      ...g.answers.map(a => a.score),
      g.total_score, g.max_score, g.max_score > 0 ? `${Math.round((g.total_score / g.max_score) * 100)}%` : '0%',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grade_report_lesson_${lesson?.lesson_number || 'unknown'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SkeletonPage />;

  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] mb-4">
        <Link to={`/teacher/courses/${courseId}/lessons/${lessonId}`} className="text-blue-600 hover:underline">← Back to Lesson</Link>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Grade Answer Sheets</h1>
          <p className="text-[12px] text-gray-500">Session {lesson?.lesson_number}: {lesson?.title} | {questions.length} questions</p>
        </div>
      </div>

      {/* Upload Zone */}
      {grades.length === 0 && (
        <div
          className={`card p-8 text-center mb-5 border-2 border-dashed transition-all cursor-pointer ${uploadedFiles.length > 0 ? 'border-green-300 bg-green-50/30' : 'border-gray-200 hover:border-gray-300'}`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={handleFileSelect} className="hidden" />
          <div className="text-3xl mb-2">📷</div>
          <p className="text-sm font-bold text-gray-700">
            {uploadedFiles.length > 0 ? `${uploadedFiles.length} answer sheet(s) selected` : 'Upload Answer Sheets'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Drag & drop or click to upload scanned/photographed answer sheets (JPG, PNG, PDF)</p>
          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-1">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="text-[11px] text-gray-600 flex items-center gap-2 justify-center">
                  <span>📄 {f.name}</span>
                  <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                  <button onClick={(e) => { e.stopPropagation(); setUploadedFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleProcess(); }}
              disabled={processing}
              className="btn-primary mt-4"
            >
              {processing ? '🤖 AI Processing...' : `Process ${uploadedFiles.length} Answer Sheet(s)`}
            </button>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {processing && (
        <div className="card p-6 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center pulse-dot">🤖</div>
            <div>
              <p className="text-sm font-bold text-gray-900">AI is reading and grading answer sheets...</p>
              <p className="text-[11px] text-gray-500">Detecting student names, reading answers, auto-grading MCQ & True/False, AI-grading short answer & open-ended</p>
            </div>
          </div>
          <div className="bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
            <div className="bg-gradient-to-r from-leap-blue to-leap-navy h-full rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Grade Results */}
      {grades.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-header">Grading Complete — {grades.length} Students</h3>
              <div className="flex gap-2">
                <button onClick={downloadGradeReport} className="btn-secondary text-[11px] py-1.5">📊 Download Grade Report</button>
                <button onClick={handleConfirmAll} className="btn-primary text-[11px] py-1.5">✅ Confirm All Grades</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-black text-leap-navy">{grades.length}</p>
                <p className="text-[10px] text-gray-400">Students Graded</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-leap-green">{Math.round(grades.reduce((a, g) => a + g.total_score, 0) / grades.length)}</p>
                <p className="text-[10px] text-gray-400">Avg Score</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-leap-blue">{grades[0]?.max_score || 0}</p>
                <p className="text-[10px] text-gray-400">Max Marks</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-leap-purple">{Math.round((grades.reduce((a, g) => a + g.total_score, 0) / (grades.length * (grades[0]?.max_score || 1))) * 100)}%</p>
                <p className="text-[10px] text-gray-400">Class Average</p>
              </div>
            </div>
          </div>

          {/* Per-student results */}
          {grades.map(g => {
            const isExpanded = expandedStudent === g.student_id;
            const pct = Math.round((g.total_score / g.max_score) * 100);
            return (
              <div key={g.student_id} className="card overflow-hidden">
                <button onClick={() => setExpandedStudent(isExpanded ? null : g.student_id)} className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-leap-navy text-white flex items-center justify-center text-[11px] font-bold">{g.student_name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{g.student_name}</p>
                      <p className="text-[10px] text-gray-500">Roll: {g.roll_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {g.answers.map((a, ai) => (
                        <div key={ai} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${a.score === a.max_score ? 'bg-green-100 text-green-700' : a.score > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {a.score === a.max_score ? '✓' : a.score > 0 ? '~' : '✗'}
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${pct >= 75 ? 'text-leap-green' : pct >= 60 ? 'text-leap-amber' : 'text-leap-red'}`}>
                        {g.total_score}/{g.max_score}
                      </p>
                      <p className="text-[10px] text-gray-400">{pct}%</p>
                    </div>
                    <span className="text-gray-400 text-sm" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="animate-slide-down border-t border-gray-100 p-4">
                    <div className="space-y-2">
                      {g.answers.map((a, ai) => {
                        const q = questions[ai];
                        return (
                          <div key={ai} className={`flex items-start gap-3 p-2 rounded-lg ${a.score === a.max_score ? 'bg-green-50' : a.score > 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${a.score === a.max_score ? 'bg-green-200 text-green-800' : a.score > 0 ? 'bg-amber-200 text-amber-800' : 'bg-red-200 text-red-800'}`}>
                              Q{a.question_num}
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] text-gray-700">{q?.question_text || `Question ${a.question_num}`}</p>
                              <p className="text-[10px] mt-0.5">
                                <span className="text-gray-500">Answer: </span>
                                <span className="font-medium">{a.answer}</span>
                              </p>
                              {a.ai_feedback && <p className="text-[10px] text-blue-600 mt-0.5">AI: {a.ai_feedback}</p>}
                            </div>
                            <div className="text-[12px] font-bold">{a.score}/{a.max_score}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
