import { useState } from 'react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    icon: '🚀',
    title: 'Your AI Teaching Co-Pilot',
    color: '#1B3A6B',
    content: 'The Learning Effectiveness System transforms how you plan, deliver, and adapt your teaching — powered by AI, guided by you. It\'s not just another LMS. It\'s an intelligent platform that understands the knowledge architecture of your subject and helps you deliver every session effectively.',
    deeper: 'The AI analyzes your syllabus, creates a complete lesson plan for every session, generates Socratic teaching scripts, builds quizzes with 10+ questions per lesson, and continuously adapts based on student performance. You remain in full control — review, modify, and approve everything before it reaches students.\n\nWhat this means for you: You go from "I have a syllabus" to "I have 30 fully planned sessions with lesson plans, teaching scripts, and quizzes" — in minutes, not weeks.',
  },
  {
    icon: '📄',
    title: 'Upload Your Syllabus',
    color: '#2E75B6',
    content: 'Upload any syllabus (PDF, Word, or text) and the AI performs a 10-step deconstruction: Extract Concepts → Build Knowledge Graph → Define Gates → Map Bloom\'s Taxonomy → Reorder to Cognitive Sequence → Design Lessons → Generate Socratic Scripts → Create Questions → Build Visual Map → Define Outcomes.',
    deeper: 'You also set your timetable: how many sessions and how long each session is. The AI distributes lessons across your exact schedule — if you have 30 sessions of 40 minutes each, you get 30 complete lesson plans perfectly fitted to your calendar.\n\nWhat this means for you: No more spending weekends building lesson plans. Upload once, and get a complete semester plan tailored to your schedule.',
  },
  {
    icon: '🗺️',
    title: 'Knowledge Graph & Gates',
    color: '#1E7E34',
    content: 'Your subject is broken into Critical Gates — conceptual checkpoints that must be mastered before moving forward. Each gate contains sub-concepts, and gates have dependencies: "Gate 2 (HCF/LCM) requires Gate 1 (Numbers)" means students can\'t skip ahead.',
    deeper: 'Some gates can run in parallel (like Geometry alongside Decimals) because they don\'t depend on each other. The AI identifies these parallel tracks automatically. This prevents the "Swiss cheese" problem where students have scattered knowledge with hidden gaps that compound later.\n\nWhat this means for you: You can see at a glance which topics depend on which, and plan your teaching sequence with confidence that foundations are solid before advancing.',
  },
  {
    icon: '📚',
    title: 'Session-Ready Lesson Plans',
    color: '#7C3AED',
    content: 'Every session in your timetable gets a complete lesson plan: Learning Objective, Key Idea, Conceptual Breakthrough (the "aha moment"), real-world Examples, practice Exercises, and Bloom\'s Taxonomy levels. Lessons progress from Remember → Create across the course.',
    deeper: 'Each lesson is designed to build cognitive depth naturally. Early lessons in a gate focus on Remember and Understand, middle lessons on Apply and Analyze, and final lessons push toward Evaluate and Create. The AI ensures no cognitive jumps — students aren\'t asked to analyze before they understand.\n\nWhat this means for you: Walk into every class knowing exactly what to teach, how to explain it, and what to assign — no last-minute prep. Every lesson builds on the previous one with a clear progression.',
  },
  {
    icon: '💬',
    title: 'Socratic Teaching Scripts',
    color: '#B45309',
    content: 'Every lesson comes with a 4-stage guided discovery script: Hook (5 min) — activate prior knowledge, Discovery (15 min) — guide students to find the concept themselves, Concept Build (12 min) — students define before seeing the formal definition, Application (8 min) — apply to a new problem.',
    deeper: 'Every stage includes the exact question to ask, what students are likely to respond, and how to bridge to the next stage. The scripts follow the principle: Experience → Question → Insight → Concept → Application. Students discover ideas rather than being told them.\n\nWhat this means for you: You don\'t have to improvise in class. The script gives you a proven teaching structure for every lesson — but you can always adapt in the moment based on how your students respond.',
  },
  {
    icon: '📝',
    title: 'Quiz Questions Per Lesson',
    color: '#DC2626',
    content: 'Every lesson has 10 carefully designed questions: 3 MCQ (Remember, Understand, Apply), 2 True/False (Remember, Understand), 2 Short Answer (Apply, Analyze), 2 Open-ended (Understand, Evaluate), and 1 Create-level challenge. Each includes correct answers, rubrics, and common misconceptions.',
    deeper: 'Questions test real understanding, not just recall. The distractors (wrong options in MCQ) are designed based on actual student misconceptions — so when a student picks the wrong answer, you know exactly what they misunderstand and can address it.\n\nDownload quizzes as CSV/Excel for your records or PDF for printing and distributing in class.\n\nWhat this means for you: Ready-made assessments for every session. No more writing questions from scratch — and each quiz tests genuine understanding across all cognitive levels.',
  },
  {
    icon: '✅',
    title: 'Review & Approve Everything',
    color: '#16A34A',
    content: 'After AI processing, you review each lesson as a complete unit: Plan + Socratic Script + Quiz. Accept or reject each lesson with one click. Gates auto-accept when all their lessons are approved. Nothing goes live without your explicit approval.',
    deeper: 'The review page groups lessons by gate. Expand any lesson to see three sub-tabs: the Lesson Plan (key idea, examples, exercises), the Socratic Script (all 4 stages with teacher prompts), and the Quiz (all 10 questions with answers). One "Accept Lesson" button approves the entire package.\n\nWhat this means for you: You\'re the expert. The AI drafts, you decide. The review process takes minutes, not hours — and you see everything the AI generated in context.',
  },
  {
    icon: '📊',
    title: 'Real-Time Analytics',
    color: '#2E75B6',
    content: 'Four analytics views: Course Overview (progress, gate status, KPIs), Session View (per-session quiz scores and pass rates), Student Performance (mastery heatmap, Bloom\'s radar, learning velocity), and AI Guide (adaptive suggestions). Know exactly where your class stands at any moment.',
    deeper: 'The Course Overview shows which gates are completed, in-progress, unlocked, or locked. The Session View lets you click any session to see per-student scores. The Student tab shows a heatmap of every student\'s mastery across every gate, a Bloom\'s radar chart showing cognitive depth, and dependency risk alerts.\n\nWhat this means for you: No more guessing who needs help. Data tells you exactly which students need attention, on which topics, and at which cognitive level. You can intervene before small gaps become big problems.',
  },
  {
    icon: '🤖',
    title: 'AI Guide — Adaptive Suggestions',
    color: '#7C3AED',
    content: 'After each session, the AI analyzes student performance and suggests changes to upcoming lessons: Topic Shifts, Socratic Updates, Quiz Adjustments, Remediation, Peer Teaching pairs, Pace Changes, and Bloom Focus shifts. Only future sessions change — past sessions are locked.',
    deeper: 'Each suggestion shows the current plan vs. proposed change side-by-side, with the exact reasoning and which students will benefit. You accept, edit, or reject each suggestion. The AI learns from your decisions.\n\nExamples: "Revisit Fractions before Decimals — 5 students below 60%" or "Pair Sia (92%) with Aryan (48%) for peer teaching" or "Replace Remember-level quiz questions with Apply-level — 85% can recall but only 40% can apply."\n\nWhat this means for you: The AI watches your class performance 24/7 and tells you exactly what to adjust. It\'s like having an expert curriculum advisor guiding you through every session of the semester.',
  },
  {
    icon: '📅',
    title: 'Timetable & Downloads',
    color: '#1B3A6B',
    content: 'Your complete semester timetable — every session mapped to a lesson with gate context, Bloom levels, and quiz question count. Click any session to see the full lesson detail. Download lesson plans as PDF (includes Socratic script) or quizzes as CSV/Excel.',
    deeper: 'The timetable is generated automatically based on your session count and duration. Each session shows: session number, lesson title, which gate it belongs to, Bloom levels targeted, and how many quiz questions are available.\n\nWhen the AI Guide suggests changes, only future sessions update — your past teaching record stays intact.\n\nWhat this means for you: Your entire semester at a glance. Know exactly what every class will cover, in order, with all materials ready to download, print, and teach.',
  },
  {
    icon: '🔒',
    title: 'Privacy & Data Security',
    color: '#374151',
    content: 'Complete data segregation — every teacher sees only their own courses and students. Row-Level Security on every table. All API endpoints verify teacher ownership. Powered by Supabase with enterprise-grade PostgreSQL.',
    deeper: 'Your courses, students, analytics, and AI suggestions are completely private. No other teacher can see or modify your work. Students can only see courses they\'re enrolled in. The platform uses bank-level security with encrypted connections and access tokens.\n\nWhat this means for you: Teach with confidence knowing your data, your students, and your teaching strategy are completely secure and private.',
  },
];

export function PlatformGuidePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showDeeper, setShowDeeper] = useState(false);

  const step = STEPS[currentStep];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <img src="/ikigai-logo.jpeg" alt="Ikigai" className="h-10 w-auto" />
        <div className="w-px h-8 bg-gray-200" />
        <img src="/lmgc-logo.jpeg" alt="LMGC" className="h-12 w-auto" />
        <div className="ml-2">
          <h1 className="text-xl font-black text-les-navy">Platform Guide</h1>
          <p className="text-[11px] text-gray-400">How the Learning Effectiveness System empowers your teaching</p>
        </div>
      </div>

      {/* Step navigation pills */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => { setCurrentStep(i); setShowDeeper(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${
              i === currentStep
                ? 'text-white shadow-card'
                : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
            }`}
            style={i === currentStep ? { background: s.color } : {}}
          >
            <span>{s.icon}</span>
            <span className="hidden md:inline">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= currentStep ? s.color : '#E5E7EB' }}
          />
        ))}
      </div>

      {/* Content Card */}
      <div className="card p-0 overflow-hidden fade-in" key={currentStep}>
        <div className="p-6" style={{ background: `${step.color}10` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{step.icon}</span>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Step {currentStep + 1} of {STEPS.length}</p>
              <h2 className="text-lg font-black" style={{ color: step.color }}>{step.title}</h2>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{step.content}</p>
        </div>

        {/* Going Deeper */}
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={() => setShowDeeper(!showDeeper)}
            className="text-[12px] font-bold flex items-center gap-1.5 transition-colors"
            style={{ color: step.color }}
          >
            <span className="transition-transform" style={{ transform: showDeeper ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span>
            Going Deeper
          </button>
          {showDeeper && (
            <div className="mt-3 animate-slide-down">
              {step.deeper.split('\n\n').map((para, i) => (
                <p key={i} className={`text-sm leading-relaxed mb-3 ${para.startsWith('What this means') ? 'font-medium text-gray-800 p-3 rounded-xl' : 'text-gray-600'}`}
                  style={para.startsWith('What this means') ? { background: `${step.color}08`, border: `1px solid ${step.color}20` } : {}}>
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => { setCurrentStep(Math.max(0, currentStep - 1)); setShowDeeper(false); }}
            disabled={currentStep === 0}
            className="btn-secondary text-[12px] disabled:opacity-30"
          >
            &larr; Previous
          </button>
          <span className="text-[11px] text-gray-400">{currentStep + 1} / {STEPS.length}</span>
          {currentStep === STEPS.length - 1 ? (
            <Link to="/teacher" className="btn-primary text-[12px]">
              Go to Dashboard &rarr;
            </Link>
          ) : (
            <button
              onClick={() => { setCurrentStep(currentStep + 1); setShowDeeper(false); }}
              className="btn-primary text-[12px]"
            >
              Next &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Quick Jump Grid */}
      <div className="grid grid-cols-4 gap-3 mt-6">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => { setCurrentStep(i); setShowDeeper(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`card-interactive p-3 text-left ${i === currentStep ? 'ring-2' : ''}`}
            style={i === currentStep ? { borderColor: s.color } : {}}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[10px] font-bold text-gray-400">Step {i + 1}</span>
            </div>
            <p className="text-[11px] font-semibold text-gray-700 leading-tight">{s.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
