import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { DIKWBadgeFromBloom } from '../../components/shared/DIKWBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

type Tab = 'overview' | 'slides' | 'flashcards' | 'mindmap';

interface SlidePreview { type: string; title: string; subtitle?: string; icon: string; sectionLabel: string; bullets?: string[]; numberedItems?: string[]; speakerNotes: string; accentColor: string }

export function StudentLessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [lesson, setLesson] = useState<any>(null);
  const [gate, setGate] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [slides, setSlides] = useState<SlidePreview[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    }).catch(() => setLoading(false));

    // Load slides
    api.get<{ slides: SlidePreview[] }>(`/courses/${courseId}/lessons/${lessonId}/media/slides/preview`)
      .then(d => setSlides(d.slides))
      .catch(() => {});
  }, [courseId, lessonId]);

  if (loading || !lesson) return <SkeletonPage />;

  const currentIdx = allLessons.findIndex((l: any) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'slides', label: `Slides (${slides.length})` },
    { key: 'flashcards', label: 'Flashcards' },
    { key: 'mindmap', label: 'Mind Map' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] mb-4">
        <Link to="/student" className="text-blue-600 hover:underline">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link to={`/student/courses/${courseId}/lessons`} className="text-blue-600 hover:underline">Lessons</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500">Session {lesson.lesson_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">
            Session {lesson.lesson_number}: {lesson.title}
          </h1>
          <p className="text-[12px] text-gray-500 mt-1">{lesson.objective}</p>
          <div className="flex items-center gap-3 mt-2">
            {gate && <span className="badge text-white" style={{ background: gate.color }}>G{gate.gate_number}: {gate.short_title}</span>}
            {lesson.bloom_levels?.map((bl: string) => <BloomBadge key={bl} level={bl} />)}
            <DIKWBadgeFromBloom bloomLevels={lesson.bloom_levels || []} size="md" />
            <span className="badge bg-gray-100 text-gray-500">{lesson.duration_minutes} min</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/student/courses/${courseId}/lessons/${lessonId}/prep`} className="btn-secondary text-[11px] py-1.5">
            📖 Prepare for Class
          </Link>
          <Link to={`/student/courses/${courseId}/quiz/${lesson.gate_id}`} className="btn-primary text-[11px] py-1.5">
            Take Quiz
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'pill-tab-active' : 'pill-tab-inactive'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="fade-in grid grid-cols-2 gap-5">
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
          </div>
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
                <h3 className="section-header mb-2">Practice Exercises</h3>
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
          </div>
        </div>
      )}

      {/* Slides Tab */}
      {tab === 'slides' && (
        <div className="fade-in">
          {slides.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No slides available for this lesson.</div>
          ) : (
            <div className="card p-5">
              <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ aspectRatio: '16/9' }}>
                <div className="h-full flex flex-col justify-center items-center text-center px-8">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{slides[currentSlide]?.sectionLabel}</p>
                  <h2 className="text-xl font-black text-white mb-3">{slides[currentSlide]?.title}</h2>
                  {(slides[currentSlide]?.bullets || slides[currentSlide]?.numberedItems || []).map((b: string, i: number) => (
                    <p key={i} className="text-sm text-gray-300 mb-1">{b}</p>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">&larr; Prev</button>
                <div className="flex gap-1">
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-leap-navy scale-125' : 'bg-gray-300'}`} />
                  ))}
                </div>
                <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">Next &rarr;</button>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">Slide {currentSlide + 1} of {slides.length}</p>
            </div>
          )}
        </div>
      )}

      {/* Flashcards Tab */}
      {tab === 'flashcards' && (
        <div className="fade-in">
          <StudentFlashcards lesson={lesson} questions={questions} />
        </div>
      )}

      {/* Mind Map Tab */}
      {tab === 'mindmap' && (
        <div className="fade-in">
          <StudentMindMap lesson={lesson} gate={gate} />
        </div>
      )}

      {/* Chatbot */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="w-96 h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="bg-leap-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold">Lesson Assistant</p>
                <p className="text-[10px] text-white/60">Ask anything about this lesson</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/60 hover:text-white text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-[12px] text-gray-500">Ask me about "{lesson.title}"</p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {['Explain the key idea', 'Give me an example', 'Summarize this lesson'].map(q => (
                      <button key={q} onClick={() => setChatInput(q)} className="text-[10px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-leap-navy text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
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
            <form onSubmit={async (e) => {
              e.preventDefault();
              const msg = chatInput.trim();
              if (!msg || chatLoading) return;
              const newMessages = [...chatMessages, { role: 'user' as const, content: msg }];
              setChatMessages(newMessages);
              setChatInput('');
              setChatLoading(true);
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
              try {
                const directUrl = (import.meta as any).env?.VITE_DIRECT_API_URL || '/api/v1';
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
                  setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I could not process your request.' }]);
                }
              } catch {
                setChatMessages([...newMessages, { role: 'assistant', content: 'Connection error. Please try again.' }]);
              }
              setChatLoading(false);
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }} className="shrink-0 border-t border-gray-200 p-3 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about this lesson..." className="flex-1 text-[12px] px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-leap-navy" disabled={chatLoading} />
              <button type="submit" disabled={chatLoading || !chatInput.trim()} className="bg-leap-navy text-white px-3 py-2 rounded-xl text-[12px] font-bold disabled:opacity-30">Send</button>
            </form>
          </div>
        ) : (
          <button onClick={() => setChatOpen(true)} className="w-14 h-14 bg-leap-navy text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform" title="Lesson Assistant">
            <span className="text-xl">💬</span>
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
        {prevLesson ? (
          <Link to={`/student/courses/${courseId}/lessons/${prevLesson.id}`} className="btn-secondary text-[12px]">
            &larr; Session {prevLesson.lesson_number}
          </Link>
        ) : <div />}
        {nextLesson ? (
          <Link to={`/student/courses/${courseId}/lessons/${nextLesson.id}`} className="btn-primary text-[12px]">
            Session {nextLesson.lesson_number} &rarr;
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}

// ─── Student Flashcards (inline, reuses logic) ─────────────
function StudentFlashcards({ lesson, questions }: { lesson: any; questions: any[] }) {
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  const cards: { front: string; back: string; tag: string }[] = [];
  if (lesson.objective) cards.push({ front: `What is the learning objective of this lesson?`, back: lesson.objective, tag: 'Objective' });
  if (lesson.key_idea) cards.push({ front: `What is the key idea?`, back: lesson.key_idea, tag: 'Key Idea' });
  if (lesson.conceptual_breakthrough) cards.push({ front: `What is the conceptual breakthrough?`, back: lesson.conceptual_breakthrough, tag: 'Breakthrough' });
  questions.forEach(q => {
    if (q.options?.length > 0) {
      const correct = q.options.find((o: any) => o.is_correct);
      if (correct) cards.push({ front: q.question_text, back: correct.text + (q.explanation ? `\n\n${q.explanation}` : ''), tag: q.bloom_level || 'Quiz' });
    } else if (q.correct_answer) {
      cards.push({ front: q.question_text, back: q.correct_answer, tag: q.bloom_level || 'Quiz' });
    }
  });

  if (cards.length === 0) return <div className="card p-8 text-center text-gray-500">No flashcards available.</div>;
  const card = cards[cardIdx];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-black text-gray-900 mb-2">Flashcards</h3>
      <p className="text-[11px] text-gray-400 mb-4">{cards.length} cards — {cards.length - known.size} remaining</p>
      <div className="flex gap-0.5 mb-4">
        {cards.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${known.has(i) ? 'bg-green-400' : i === cardIdx ? 'bg-leap-navy' : 'bg-gray-200'}`} />)}
      </div>
      <div onClick={() => setFlipped(!flipped)} className="cursor-pointer select-none" style={{ perspective: '1000px' }}>
        <div className="relative transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : '', minHeight: '200px' }}>
          <div className="absolute inset-0 rounded-xl border-2 border-gray-200 bg-white p-6 flex flex-col justify-center items-center text-center" style={{ backfaceVisibility: 'hidden' }}>
            <span className="badge bg-blue-100 text-blue-700 mb-3">{card?.tag}</span>
            <p className="text-base text-gray-900 font-medium">{card?.front}</p>
            <p className="text-[10px] text-gray-400 mt-4">Tap to reveal</p>
          </div>
          <div className="absolute inset-0 rounded-xl border-2 border-green-300 bg-green-50 p-6 flex flex-col justify-center items-center text-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <span className="badge bg-green-100 text-green-700 mb-3">{card?.tag}</span>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{card?.back}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => { setCardIdx(Math.max(0, cardIdx - 1)); setFlipped(false); }} disabled={cardIdx === 0} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">← Prev</button>
        <div className="flex gap-2">
          <button onClick={() => { setKnown(new Set([...known, cardIdx])); if (cardIdx < cards.length - 1) { setCardIdx(cardIdx + 1); setFlipped(false); } }} className="text-[11px] py-1.5 px-3 rounded-lg bg-green-100 text-green-700 font-bold hover:bg-green-200">Got it ✓</button>
          <button onClick={() => { if (cardIdx < cards.length - 1) { setCardIdx(cardIdx + 1); setFlipped(false); } }} className="text-[11px] py-1.5 px-3 rounded-lg bg-amber-100 text-amber-700 font-bold hover:bg-amber-200">Review again</button>
        </div>
        <button onClick={() => { setCardIdx(Math.min(cards.length - 1, cardIdx + 1)); setFlipped(false); }} disabled={cardIdx === cards.length - 1} className="btn-secondary text-[11px] py-1.5 disabled:opacity-30">Next →</button>
      </div>
    </div>
  );
}

// ─── Student Mind Map (inline, reuses logic) ───────────────
function StudentMindMap({ lesson, gate }: { lesson: any; gate: any }) {
  interface MindNode { label: string; color?: string; children?: MindNode[] }
  const tree: MindNode = {
    label: lesson.title,
    color: gate?.color || '#1B3A6B',
    children: [
      ...(lesson.objective ? [{ label: 'Learning Objective', color: '#2563EB', children: [{ label: lesson.objective }] }] : []),
      ...(lesson.key_idea ? [{ label: 'Key Idea', color: '#16A34A', children: [{ label: lesson.key_idea }] }] : []),
      ...(lesson.conceptual_breakthrough ? [{ label: 'Breakthrough', color: '#9333EA', children: [{ label: lesson.conceptual_breakthrough }] }] : []),
      ...(lesson.examples?.length > 0 ? [{ label: 'Examples', color: '#0891B2', children: lesson.examples.map((ex: any, i: number) => ({ label: `${i + 1}. ${ex.text || ex}` })) }] : []),
      ...(lesson.bloom_levels?.length > 0 ? [{ label: 'Thinking Levels', color: '#DC2626', children: lesson.bloom_levels.map((bl: string) => ({ label: bl })) }] : []),
    ],
  };

  const renderNode = (node: MindNode, depth: number, isLast: boolean) => (
    <div key={node.label} className={depth === 0 ? '' : 'ml-6 relative'}>
      {depth > 0 && <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-gray-200" style={isLast ? { bottom: '50%' } : {}} />}
      {depth > 0 && <div className="absolute left-[-16px] top-[14px] w-4 h-px bg-gray-200" />}
      <div className="flex items-start gap-2 py-1.5">
        <div className={`shrink-0 rounded-full ${depth === 0 ? 'w-3.5 h-3.5 mt-0.5' : 'w-2.5 h-2.5 mt-1'}`} style={{ background: node.color || '#6B7280' }} />
        <p className={`${depth === 0 ? 'text-sm font-black text-gray-900' : depth === 1 ? 'text-[12px] font-bold text-gray-800' : 'text-[11px] text-gray-600'} leading-snug`}>{node.label}</p>
      </div>
      {node.children && <div className="relative">{node.children.map((child, i) => renderNode(child, depth + 1, i === node.children!.length - 1))}</div>}
    </div>
  );

  return (
    <div className="card p-5">
      <h3 className="text-sm font-black text-gray-900 mb-2">Mind Map</h3>
      <p className="text-[11px] text-gray-400 mb-4">Visual overview of lesson concepts</p>
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-5">{renderNode(tree, 0, true)}</div>
    </div>
  );
}
