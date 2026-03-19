import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { FileUploadZone } from '../../components/shared/FileUploadZone';
import type { Course } from '@les/shared';

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
  const [llmProvider, setLlmProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [totalSessions, setTotalSessions] = useState<number>(30);
  const [sessionDuration, setSessionDuration] = useState<number>(40);
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

  const handleProcess = async () => {
    if (!syllabusText.trim()) return;

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

    // Start SSE processing
    const stored = localStorage.getItem('les_demo_session');
    const token = stored ? JSON.parse(stored)?.session?.access_token : '';

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${apiUrl}/courses/${courseId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to start processing');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'step') {
                  setStepStatuses(prev => ({ ...prev, [event.step]: event.status }));
                } else if (event.type === 'complete') {
                  navigate(`/teacher/courses/${courseId}/review`);
                  return;
                } else if (event.type === 'error') {
                  setError(event.error);
                  setProcessing(false);
                  return;
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setProcessing(false);
    }
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
      <p className="text-[12px] text-gray-500 mb-6">Upload or paste the syllabus for AI deconstruction</p>

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
                  // For non-text files, call the upload endpoint
                  try {
                    const result = await api.post<{ extracted_text: string }>(`/courses/${courseId}/syllabus/upload`, { filename: file.name });
                    if (result.extracted_text) setSyllabusText(result.extracted_text);
                  } catch {
                    setSyllabusText(`[File uploaded: ${file.name}]`);
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

          {/* AI Provider */}
          <div className="mb-5">
            <label className="section-header block mb-2">AI Provider</label>
            <div className="flex gap-3">
              <button
                onClick={() => setLlmProvider('anthropic')}
                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border-2 transition-all ${
                  llmProvider === 'anthropic' ? 'border-les-navy bg-blue-50 text-les-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Claude (Anthropic)
              </button>
              <button
                onClick={() => setLlmProvider('openai')}
                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border-2 transition-all ${
                  llmProvider === 'openai' ? 'border-les-navy bg-blue-50 text-les-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                GPT-4o (OpenAI)
              </button>
            </div>
          </div>

          {/* Timetable Configuration */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <label className="section-header block mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-les-navy inline-block" />
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

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

          <button
            onClick={handleProcess}
            disabled={!syllabusText.trim()}
            className="btn-primary w-full py-3 text-sm"
          >
            Deconstruct Syllabus
          </button>
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="text-lg font-black mb-1">Processing Syllabus</h2>
          <p className="text-[12px] text-gray-500 mb-4">This typically takes 1-3 minutes</p>

          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
            <div
              className="bg-gradient-to-r from-les-blue to-les-navy h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(completedSteps / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mb-4 -mt-4 text-right">{completedSteps}/{STEPS.length} steps</p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

          <div className="space-y-2">
            {STEPS.map((name, i) => {
              const step = i + 1;
              const status = stepStatuses[step] || 'pending';
              const bgClass = status === 'processing' ? 'bg-blue-50 border-blue-200' : status === 'complete' ? 'bg-green-50 border-green-200' : status === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100';
              return (
                <div key={step} className={`flex items-center gap-3 p-3 rounded-xl border ${bgClass} transition-all`}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    {status === 'complete' && <span className="text-green-600 text-sm font-bold">&#10003;</span>}
                    {status === 'processing' && <span className="pulse-dot text-les-blue text-sm">&#9679;</span>}
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
