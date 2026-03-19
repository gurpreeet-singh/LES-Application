import { useState } from 'react';
import { Link } from 'react-router-dom';

const CAPABILITIES = [
  {
    icon: '🚀',
    title: 'Welcome to LES — Your AI Teaching Co-Pilot',
    color: '#1B3A6B',
    summary: 'The Learning Execution System transforms how you plan, deliver, and adapt your teaching — powered by AI, guided by you.',
    details: [
      'LES is not just another LMS. It\'s an intelligent platform that understands the knowledge architecture of your subject and helps you deliver every session effectively.',
      'The AI analyzes your syllabus, creates a complete lesson plan for every session, generates Socratic teaching scripts, builds quizzes with 10+ questions per lesson, and continuously adapts based on student performance.',
      'You remain in full control — review, modify, and approve everything before it reaches students.',
    ],
    forTeacher: 'You go from "I have a syllabus" to "I have 30 fully planned sessions with lesson plans, teaching scripts, and quizzes" — in minutes, not weeks.',
  },
  {
    icon: '📄',
    title: 'Upload Your Syllabus',
    color: '#2E75B6',
    summary: 'Upload any syllabus (PDF, Word, or text) and the AI deconstructs it into a complete teaching plan.',
    details: [
      'Simply upload your syllabus document or paste the text. The AI performs a 10-step analysis:',
      '1. Extract Core Concepts → 2. Build Knowledge Graph → 3. Define Critical Gates → 4. Map Bloom\'s Taxonomy → 5. Reorder to Cognitive Sequence → 6. Design Lesson Architecture → 7. Generate Socratic Scripts → 8. Create Diagnostic Questions → 9. Build Visual Map → 10. Define Learning Outcomes',
      'You also set your timetable: how many sessions and how long each session is. The AI distributes lessons across your exact schedule.',
    ],
    forTeacher: 'No more spending weekends building lesson plans. Upload once, and get a complete semester plan tailored to your schedule.',
  },
  {
    icon: '🗺️',
    title: 'Knowledge Graph & Gates',
    color: '#1E7E34',
    summary: 'See how concepts connect — the AI maps prerequisite dependencies so students build knowledge in the right order.',
    details: [
      'Your subject is broken into Critical Gates — conceptual checkpoints that must be mastered before moving forward.',
      'Each gate contains sub-concepts, and gates have dependencies: "Gate 2 (HCF/LCM) requires Gate 1 (Numbers)" means students can\'t skip ahead.',
      'Some gates can run in parallel (like Geometry alongside Decimals) because they don\'t depend on each other. The AI identifies these parallel tracks automatically.',
    ],
    forTeacher: 'You can see at a glance which topics depend on which, preventing the "Swiss cheese" problem where students have gaps that compound later.',
  },
  {
    icon: '📚',
    title: '30 Session-Ready Lesson Plans',
    color: '#7C3AED',
    summary: 'Every session in your timetable gets a complete lesson plan with objectives, key ideas, examples, and exercises.',
    details: [
      'If you have 30 sessions, you get 30 complete lesson plans. Each includes:',
      '• Learning Objective — what students will achieve',
      '• Key Idea — the core concept to convey',
      '• Conceptual Breakthrough — the "aha moment" to aim for',
      '• Examples — real-world illustrations (3 per lesson)',
      '• Exercises — practice problems (2 per lesson)',
      '• Bloom\'s Taxonomy levels — cognitive depth targeting',
      'Lessons progress from Remember → Create across the course, building cognitive depth naturally.',
    ],
    forTeacher: 'Walk into every class knowing exactly what to teach, how to explain it, and what to assign — no last-minute prep.',
  },
  {
    icon: '💬',
    title: 'Socratic Teaching Scripts',
    color: '#B45309',
    summary: 'Every lesson comes with a 4-stage guided discovery script — questions to ask, responses to expect, and bridges to the next concept.',
    details: [
      'Each Socratic script has 4 stages:',
      '1. Hook (5 min) — Open with a question that activates prior knowledge',
      '2. Discovery (15 min) — Guide students to discover the concept through questions, not lectures',
      '3. Concept Build (12 min) — Students articulate the concept in their own words before seeing the formal definition',
      '4. Application (8 min) — Students apply the concept to a new problem',
      'Every stage includes: the exact question to ask, what students are likely to respond, and how to bridge to the next stage.',
    ],
    forTeacher: 'You don\'t have to improvise. The script gives you a proven teaching structure for every lesson — but you can always adapt in the moment.',
  },
  {
    icon: '📝',
    title: '10 Quiz Questions Per Lesson',
    color: '#DC2626',
    summary: 'Every lesson has 10 carefully designed questions spanning all Bloom\'s levels — MCQ, True/False, Short Answer, and Open-ended.',
    details: [
      'Question distribution per lesson:',
      '• 3 MCQ (Remember, Understand, Apply)',
      '• 2 True/False (Remember, Understand)',
      '• 2 Short Answer (Apply, Analyze)',
      '• 2 Open-ended (Understand, Evaluate)',
      '• 1 Create-level challenge question',
      'Each question includes: correct answer, rubric for grading, and common misconceptions (distractors) so you know what mistakes to expect.',
      'Download quizzes as CSV/Excel or PDF for printing.',
    ],
    forTeacher: 'Ready-made assessments for every session. No more writing questions from scratch — and each quiz tests real understanding, not just recall.',
  },
  {
    icon: '✅',
    title: 'Review & Approve Everything',
    color: '#16A34A',
    summary: 'The AI generates the content, but you have final say. Review each lesson\'s plan, script, and quiz before publishing.',
    details: [
      'After AI processing, you enter the Review stage:',
      '• See the Knowledge Graph — how gates connect and depend on each other',
      '• Review each lesson as a complete unit: Plan + Socratic Script + Quiz',
      '• Accept or Reject each lesson with one click (scripts and quiz auto-accept with the lesson)',
      '• Gates auto-accept when all their lessons are approved',
      '• Finalize to publish the course and generate the timetable',
      'Nothing goes live without your explicit approval.',
    ],
    forTeacher: 'You\'re the expert. The AI drafts, you decide. Accept what works, reject what doesn\'t — the AI respects your judgment.',
  },
  {
    icon: '📊',
    title: 'Real-Time Analytics Dashboard',
    color: '#2E75B6',
    summary: 'Track student progress session-by-session, see gate completion status, identify at-risk students, and understand Bloom\'s level gaps.',
    details: [
      'Four analytics views:',
      '• Course Overview — progress bar (Session 18/30), gate status (completed/in-progress/locked), summary KPIs',
      '• Session View — every session with quiz scores, pass rates, click to see per-student scores',
      '• Student Performance — mastery heatmap, Bloom\'s radar chart, learning velocity, dependency risk alerts',
      '• AI Guide — adaptive suggestions based on student performance (next section)',
      'See exactly where your class stands at any moment — which gates are mastered, which students are struggling, and where the biggest gaps are.',
    ],
    forTeacher: 'No more guessing who needs help. Data tells you exactly which students need attention and on which topics.',
  },
  {
    icon: '🤖',
    title: 'AI Guide — Continuous Adaptive Suggestions',
    color: '#7C3AED',
    summary: 'After each session, the AI analyzes student performance and suggests changes to upcoming lesson plans — your AI teaching co-pilot.',
    details: [
      'The AI Guide provides 7 types of suggestions:',
      '• Topic Shift — "Revisit Fractions before moving to Decimals — 5 students haven\'t mastered prerequisites"',
      '• Socratic Update — "Add a misconception-busting stage — students think 2/4 > 1/2"',
      '• Quiz Adjustment — "Replace Remember-level questions with Apply-level — students can recall but can\'t apply"',
      '• Remediation — "Add 15-min targeted review for 3 at-risk students"',
      '• Peer Teaching — "Pair Sia (92%) with Aryan (48%) for mentoring"',
      '• Pace Change — "Extend Gate 3 by 1 session — class average dropped"',
      '• Bloom Focus — "Shift from Remember to Apply targeting"',
      'You accept, edit, or reject each suggestion. Only future sessions change — past sessions are locked.',
    ],
    forTeacher: 'The AI watches your class performance 24/7 and tells you exactly what to adjust. It\'s like having an expert curriculum advisor guiding you through every session.',
  },
  {
    icon: '📅',
    title: 'Timetable & Session Management',
    color: '#1B3A6B',
    summary: 'Your complete semester timetable — 30 sessions, each mapped to a lesson with all materials ready.',
    details: [
      'The timetable shows every session in your semester:',
      '• Session number, lesson title, gate it belongs to',
      '• Bloom levels targeted in each session',
      '• Quiz question count per session',
      '• Download lesson plan as PDF (includes Socratic script)',
      '• Download quiz as CSV/Excel',
      'Click any session to see the full lesson detail with Plan, Script, and Quiz tabs.',
    ],
    forTeacher: 'Your entire semester at a glance. Know exactly what every class will cover, in order, with all materials ready to download and print.',
  },
  {
    icon: '🔒',
    title: 'Your Data, Your Students, Your Control',
    color: '#374151',
    summary: 'Complete data segregation — every teacher sees only their own courses and students. No cross-contamination.',
    details: [
      'Security & privacy:',
      '• Row-Level Security (RLS) on every database table — your data is invisible to other teachers',
      '• Only you can see, edit, and manage your courses',
      '• Students can only see courses they\'re enrolled in',
      '• AI suggestions are private to your course',
      '• All API endpoints verify teacher ownership before returning data',
      'Powered by Supabase (enterprise-grade PostgreSQL) with bank-level security.',
    ],
    forTeacher: 'Your courses, your students, your teaching strategy — completely private and secure. No other teacher can see or modify your work.',
  },
];

export function PlatformGuidePage() {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="card p-6 mb-6 bg-gradient-to-r from-les-navy/5 to-les-purple/5 border-les-navy/20">
        <div className="flex items-center gap-4 mb-4">
          <img src="/ikigai-logo.jpeg" alt="Ikigai" className="h-12 w-auto" />
          <div className="w-px h-10 bg-gray-200" />
          <img src="/lmgc-logo.jpeg" alt="LMGC" className="h-14 w-auto" />
        </div>
        <h1 className="text-2xl font-black text-les-navy mb-2">Learning Execution System — Platform Guide</h1>
        <p className="text-sm text-gray-600 mb-3">Everything you need to know about how this platform empowers you to deliver every session effectively.</p>
        <div className="flex gap-2">
          <Link to="/teacher" className="btn-primary text-[12px]">Go to Dashboard</Link>
          <Link to="/teacher/courses" className="btn-secondary text-[12px]">View Courses</Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-lg font-black text-les-navy">30</p>
          <p className="text-[10px] text-gray-500">Lesson Plans Per Course</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-black text-les-purple">300</p>
          <p className="text-[10px] text-gray-500">Quiz Questions Generated</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-black text-les-green">120</p>
          <p className="text-[10px] text-gray-500">Socratic Script Stages</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-black text-les-red">7</p>
          <p className="text-[10px] text-gray-500">AI Suggestion Types</p>
        </div>
      </div>

      {/* Capability Cards */}
      <div className="space-y-3">
        {CAPABILITIES.map((cap, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full text-left p-5 flex items-start gap-4 hover:bg-gray-50/50 transition"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${cap.color}15` }}>
                  {cap.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="badge text-white text-[9px]" style={{ background: cap.color }}>{i + 1}/{CAPABILITIES.length}</span>
                    <h3 className="text-sm font-black text-gray-900">{cap.title}</h3>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-1">{cap.summary}</p>
                </div>
                <span className="text-gray-400 text-sm transition-transform mt-1" style={{ transform: isOpen ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
              </button>

              {isOpen && (
                <div className="animate-slide-down border-t border-gray-100 px-5 pb-5">
                  {/* Details */}
                  <div className="mt-4 space-y-2">
                    {cap.details.map((d, di) => (
                      <p key={di} className="text-[12px] text-gray-700 leading-relaxed">{d}</p>
                    ))}
                  </div>

                  {/* What's in it for you */}
                  <div className="mt-4 p-4 rounded-xl" style={{ background: `${cap.color}08`, border: `1px solid ${cap.color}20` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cap.color }}>What this means for you</p>
                    <p className="text-[13px] font-medium text-gray-800">{cap.forTeacher}</p>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpanded(Math.max(0, i - 1)); }}
                      disabled={i === 0}
                      className="btn-secondary text-[11px] py-1.5 disabled:opacity-30"
                    >
                      &larr; Previous
                    </button>
                    <span className="text-[11px] text-gray-400 py-1.5">{i + 1} of {CAPABILITIES.length}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpanded(Math.min(CAPABILITIES.length - 1, i + 1)); }}
                      disabled={i === CAPABILITIES.length - 1}
                      className="btn-primary text-[11px] py-1.5 disabled:opacity-30"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="card p-6 mt-6 text-center bg-gradient-to-r from-les-navy/5 to-les-blue/5">
        <h2 className="text-lg font-black text-les-navy mb-2">Ready to Transform Your Teaching?</h2>
        <p className="text-[12px] text-gray-600 mb-4">Create your first course and experience the AI-powered difference.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/teacher/courses" className="btn-primary">Create a Course</Link>
          <Link to="/teacher" className="btn-secondary">Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
