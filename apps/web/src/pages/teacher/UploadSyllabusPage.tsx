import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { FileUploadZone } from '../../components/shared/FileUploadZone';
import type { Course } from '@leap/shared';

const STEPS = [
  'Extract Core Concepts',
  'Build Knowledge Graph',
  'Define Critical Gates',
  "Bloom's Taxonomy Mapping",
  'Reorder to Cognitive Sequence',
  'Lesson Architecture',
  'Socratic Teaching Scripts',
  'Diagnostic Questions',
  'Visual Master Map',
  'Learning Outcomes',
];

export function UploadSyllabusPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const llmProvider = 'openrouter'; // Uses best available AI model
  const [totalSessions, setTotalSessions] = useState<number>(30);
  const [sessionDuration, setSessionDuration] = useState<number>(40);
  const [generationMode, setGenerationMode] = useState<'progressive' | 'batch'>('progressive');
  const [processing, setProcessing] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ course: Course }>(`/courses/${courseId}`).then(d => {
      setCourse(d.course);
      if (d.course.syllabus_text) setSyllabusText(d.course.syllabus_text);
      if (d.course.total_sessions) setTotalSessions(d.course.total_sessions);
      if (d.course.session_duration_minutes) setSessionDuration(d.course.session_duration_minutes);
    });
  }, [courseId]);

  const completedSteps = Object.values(stepStatuses).filter(s => s === 'complete').length;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleProcess = async () => {
    if (!syllabusText.trim() || syllabusText.trim().length < 50) return;

    setError('');
    setProcessing(true);
    setStepStatuses({});

    // Save syllabus + timetable config
    await api.post(`/courses/${courseId}/syllabus`, {
      syllabus_text: syllabusText,
      llm_provider: llmProvider,
      total_sessions: totalSessions,
      session_duration_minutes: sessionDuration,
    });

    // Trigger background processing
    try {
      await api.post(`/courses/${courseId}/process`, { generation_mode: generationMode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
      setProcessing(false);
      return;
    }

    // Step 1 starts immediately as "processing"
    setStepStatuses({ 1: 'processing' });

    // Advance steps every 20s (10 steps over ~3-4 min of processing)
    let currentStep = 1;
    const stepTimer = setInterval(() => {
      if (currentStep < STEPS.length) {
        setStepStatuses(prev => ({
          ...prev,
          [currentStep]: 'complete',
          [currentStep + 1]: 'processing',
        }));
        currentStep++;
      }
    }, 20000);

    // Poll course status every 5 seconds, 8 minute timeout
    const startTime = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.get<{ course: { status: string; processing_error?: string | null } }>(`/courses/${courseId}`);
        const status = data.course.status;

        if (status === 'review' || status === 'active' || status === 'structure_ready') {
          clearInterval(stepTimer);
          if (pollRef.current) clearInterval(pollRef.current);
          setStepStatuses(Object.fromEntries(STEPS.map((_, i) => [i + 1, 'complete'])));
          // Progressive mode goes to course detail (to start generating sessions), batch goes to review
          const targetPath = status === 'structure_ready'
            ? `/teacher/courses/${courseId}/detail`
            : `/teacher/courses/${courseId}/review`;
          setTimeout(() => navigate(targetPath), 800);
        } else if (status === 'draft') {
          clearInterval(stepTimer);
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.course.processing_error || 'Processing failed. Please try again with a shorter syllabus or paste the text directly.');
          setProcessing(false);
        } else if (Date.now() - startTime > 8 * 60 * 1000) {
          clearInterval(stepTimer);
          if (pollRef.current) clearInterval(pollRef.current);
          setError('Processing is taking longer than expected. The AI may still be working — please check your course in a few minutes.');
          setProcessing(false);
        }
      } catch {
        // Network error during poll — keep trying
      }
    }, 5000);
  };

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-64 mb-6" />
        <div className="card p-6"><div className="h-64 bg-gray-200 rounded" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-black text-gray-900 mb-1">{course.title}</h1>
      <p className="text-[12px] text-gray-500 mb-4">Upload or paste the syllabus for AI deconstruction</p>

      {/* Syllabus Best Practices Tip */}
      <div className="card p-4 mb-6 border-l-4 border-l-leap-blue bg-blue-50/20">
        <h3 className="text-[11px] font-black text-leap-navy mb-2">Tips for Best Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex items-start gap-2"><span className="text-green-500 text-[10px] mt-0.5">&#10003;</span><span className="text-[11px] text-gray-600">List topics with clear hierarchy (chapters, units, sub-topics)</span></div>
          <div className="flex items-start gap-2"><span className="text-green-500 text-[10px] mt-0.5">&#10003;</span><span className="text-[11px] text-gray-600">Include prerequisite info ("requires knowledge of X")</span></div>
          <div className="flex items-start gap-2"><span className="text-green-500 text-[10px] mt-0.5">&#10003;</span><span className="text-[11px] text-gray-600">Mention learning objectives or outcomes if available</span></div>
          <div className="flex items-start gap-2"><span className="text-green-500 text-[10px] mt-0.5">&#10003;</span><span className="text-[11px] text-gray-600">Include textbook chapter names for better context</span></div>
          <div className="flex items-start gap-2"><span className="text-red-400 text-[10px] mt-0.5">&#10007;</span><span className="text-[11px] text-gray-600">Avoid uploading just a list of page numbers</span></div>
          <div className="flex items-start gap-2"><span className="text-red-400 text-[10px] mt-0.5">&#10007;</span><span className="text-[11px] text-gray-600">Avoid vague topic names like "Chapter 3" without context</span></div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">The more descriptive your syllabus, the better the AI generates knowledge graphs, lesson plans, and quizzes.</p>
      </div>

      {!processing ? (
        <div className="card p-6">
          {/* File Upload */}
          <div className="mb-5">
            <label className="section-header block mb-2">Upload Syllabus</label>
            <FileUploadZone
              onFileSelected={async (file, text) => {
                if (text) {
                  setSyllabusText(text);
                } else {
                  // Upload file for server-side text extraction (PDF, DOCX, images)
                  setError('');
                  try {
                    const formData = new FormData();
                    formData.append('syllabus_file', file);
                    const result = await api.postForm<{ extracted_text: string; characters: number }>(`/courses/${courseId}/syllabus/upload`, formData);
                    if (result.extracted_text) {
                      setSyllabusText(result.extracted_text);
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to extract text from file. Try pasting the text directly.');
                  }
                }
              }}
            />
          </div>

          {/* Or paste text */}
          <div className="mb-5">
            <label className="section-header block mb-2">Or Paste Syllabus Text</label>
            <textarea
              value={syllabusText}
              onChange={e => setSyllabusText(e.target.value)}
              rows={10}
              className="input-field font-mono resize-y"
              placeholder="Paste your syllabus, course outline, or textbook table of contents here..."
            />
            <p className="text-[11px] text-gray-400 mt-1">{syllabusText.length} characters</p>
          </div>

          {/* Timetable Configuration */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <label className="section-header block mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leap-navy inline-block" />
              Timetable Configuration
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">Number of Sessions</label>
                <input
                  type="number"
                  min="1"
                  value={totalSessions}
                  onChange={e => setTotalSessions(parseInt(e.target.value) || 1)}
                  className="input-field"
                  placeholder="e.g., 30"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">Duration per Session (minutes)</label>
                <input
                  type="number"
                  min="10"
                  value={sessionDuration}
                  onChange={e => setSessionDuration(parseInt(e.target.value) || 40)}
                  className="input-field"
                  placeholder="e.g., 40"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Total teaching time: {totalSessions * sessionDuration} minutes ({Math.round(totalSessions * sessionDuration / 60)} hours)</p>
          </div>

          {/* Generation Mode */}
          <div className="card p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Session Generation Mode</h3>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${generationMode === 'progressive' ? 'border-leap-navy bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="gen_mode" checked={generationMode === 'progressive'} onChange={() => setGenerationMode('progressive')} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-gray-900">Progressive <span className="badge bg-green-100 text-green-700 ml-2">Recommended</span></p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Generate one session at a time, adapting to student performance. Each session builds on the previous session's outcomes — scores, misconceptions, and your feedback.</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${generationMode === 'batch' ? 'border-leap-navy bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="gen_mode" checked={generationMode === 'batch'} onChange={() => setGenerationMode('batch')} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-gray-900">Batch <span className="badge bg-gray-100 text-gray-600 ml-2">Traditional</span></p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Generate all sessions upfront in one go. Faster but doesn't adapt to student performance.</p>
                </div>
              </label>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

          <button
            onClick={handleProcess}
            disabled={!syllabusText.trim() || syllabusText.trim().length < 50}
            className="btn-primary w-full py-3 text-sm"
          >
            {syllabusText.trim().length > 0 && syllabusText.trim().length < 50
              ? `Need at least 50 characters (${syllabusText.trim().length}/50)`
              : 'Deconstruct Syllabus with AI'}
          </button>
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="text-lg font-black mb-1">Processing Syllabus</h2>
          <p className="text-[12px] text-gray-500 mb-4">This typically takes 1-3 minutes</p>

          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
            <div
              className="bg-gradient-to-r from-leap-blue to-leap-navy h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(completedSteps / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mb-4 -mt-4 text-right">{completedSteps}/{STEPS.length} steps</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">
              <p>{error}</p>
              <button onClick={() => { setProcessing(false); setError(''); setStepStatuses({}); }} className="btn-secondary text-[11px] mt-2">Try Again</button>
            </div>
          )}

          <div className="space-y-2">
            {STEPS.map((name, i) => {
              const step = i + 1;
              const status = stepStatuses[step] || 'pending';
              const bgClass = status === 'processing' ? 'bg-blue-50 border-blue-200' : status === 'complete' ? 'bg-green-50 border-green-200' : status === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100';
              return (
                <div key={step} className={`flex items-center gap-3 p-3 rounded-xl border ${bgClass} transition-all`}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    {status === 'complete' && <span className="text-green-600 text-sm font-bold">&#10003;</span>}
                    {status === 'processing' && <span className="pulse-dot text-leap-blue text-sm">&#9679;</span>}
                    {status === 'error' && <span className="text-red-600 text-sm font-bold">&#10007;</span>}
                    {status === 'pending' && <span className="text-gray-300 text-sm">&#9675;</span>}
                  </div>
                  <span className="text-[13px] font-medium text-gray-700">Step {step}: {name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
