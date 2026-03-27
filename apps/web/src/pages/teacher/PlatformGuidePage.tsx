import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface Step { icon: string; title: string; color: string; content: string; deeper: string }

const SCHOOL_STEPS: Step[] = [
  { icon: '🚀', title: 'Your AI Teaching Co-Pilot', color: '#1B3A6B', content: 'LEAP (Learning Execution and Acceleration Platform) transforms how you plan, deliver, and adapt your teaching — powered by AI, guided by you. It\'s not just another LMS. It\'s an intelligent platform that understands the knowledge architecture of your subject and helps you deliver every session effectively.', deeper: 'The AI analyzes your syllabus, creates a complete lesson plan for every session, generates Socratic teaching scripts, builds quizzes with 10+ questions per lesson, and continuously adapts based on student performance. You remain in full control — review, modify, and approve everything before it reaches students.\n\nWhat this means for you: You go from "I have a syllabus" to "I have 30 fully planned sessions with lesson plans, teaching scripts, and quizzes" — in minutes, not weeks.' },
  { icon: '📄', title: 'Upload Your Syllabus', color: '#2E75B6', content: 'Upload any syllabus (PDF, Word, or text) and the AI performs a 10-step deconstruction: Extract Concepts → Build Knowledge Graph → Define Gates → Map Bloom\'s Taxonomy → Reorder to Cognitive Sequence → Design Lessons → Generate Socratic Scripts → Create Questions → Build Visual Map → Define Outcomes.', deeper: 'You also set your timetable: how many sessions and how long each session is. The AI distributes lessons across your exact schedule.\n\nWhat this means for you: No more spending weekends building lesson plans. Upload once, and get a complete semester plan tailored to your schedule.' },
  { icon: '💡', title: 'Syllabus Best Practices', color: '#B45309', content: 'The quality of AI-generated content depends directly on the quality of your syllabus input. A well-structured syllabus with clear topic hierarchies, prerequisites, and learning objectives will produce dramatically better knowledge graphs, lesson plans, and quizzes.', deeper: 'DO: List topics with clear hierarchy (chapters → units → sub-topics). Include prerequisite info ("requires knowledge of fractions"). Mention learning objectives or outcomes. Include textbook chapter names for context. Specify which topics are foundational vs advanced.\n\nDON\'T: Upload just a list of page numbers. Use vague names like "Chapter 3" without describing the content. Skip prerequisite relationships between topics. Leave out the scope or depth expected for each topic.\n\nWhat this means for you: Spend 5 extra minutes structuring your syllabus input clearly, and the AI will generate content that requires almost no editing — saving you hours of review time.' },
  { icon: '🗺️', title: 'Knowledge Graph & Gates', color: '#1E7E34', content: 'Your subject is broken into Critical Gates — conceptual checkpoints that must be mastered before moving forward. Each gate contains sub-concepts, and gates have dependencies: "Gate 2 (HCF/LCM) requires Gate 1 (Numbers)" means students can\'t skip ahead.', deeper: 'Some gates can run in parallel because they don\'t depend on each other. The AI identifies these parallel tracks automatically. This prevents the "Swiss cheese" problem where students have scattered knowledge with hidden gaps.\n\nWhat this means for you: You can see at a glance which topics depend on which, and plan your teaching sequence with confidence.' },
  { icon: '📚', title: 'Session-Ready Lesson Plans', color: '#7C3AED', content: 'Every session gets a complete lesson plan: Learning Objective, Key Idea, Conceptual Breakthrough, real-world Examples, practice Exercises, and Bloom\'s Taxonomy levels. Lessons progress from Remember → Create across the course.', deeper: 'Each lesson is designed to build cognitive depth naturally. Early lessons focus on Remember and Understand, middle on Apply and Analyze, final on Evaluate and Create.\n\nWhat this means for you: Walk into every class knowing exactly what to teach, how to explain it, and what to assign.' },
  { icon: '💬', title: 'Socratic Teaching Scripts', color: '#B45309', content: 'Every lesson comes with a 4-stage guided discovery script: Hook (5 min) → Discovery (15 min) → Concept Build (12 min) → Application (8 min). Students discover ideas rather than being told them.', deeper: 'Every stage includes the exact question to ask, what students are likely to respond, and how to bridge to the next stage.\n\nWhat this means for you: You don\'t have to improvise in class. The script gives you a proven teaching structure for every lesson.' },
  { icon: '📝', title: 'Quiz Questions Per Lesson', color: '#DC2626', content: 'Every lesson has 10 carefully designed questions: 3 MCQ, 2 True/False, 2 Short Answer, 2 Open-ended, and 1 Create-level challenge. Each includes correct answers, rubrics, and common misconceptions.', deeper: 'Questions test real understanding, not just recall. The distractors are designed based on actual student misconceptions.\n\nWhat this means for you: Ready-made assessments for every session — no more writing questions from scratch.' },
  { icon: '✅', title: 'Review & Approve Everything', color: '#16A34A', content: 'After AI processing, you review each lesson as a complete unit: Plan + Socratic Script + Quiz. Accept or reject with one click. Nothing goes live without your explicit approval.', deeper: 'The review page groups lessons by gate. You see everything the AI generated in context.\n\nWhat this means for you: You\'re the expert. The AI drafts, you decide.' },
  { icon: '📊', title: 'Real-Time Analytics', color: '#2E75B6', content: 'Four analytics views: Course Overview, Session View, Student Performance (mastery heatmap, Bloom\'s radar), and AI Guide (adaptive suggestions).', deeper: 'The Course Overview shows gate status. Student tab shows a heatmap of every student\'s mastery across every gate, and dependency risk alerts.\n\nWhat this means for you: Data tells you exactly which students need attention, on which topics, and at which cognitive level.' },
  { icon: '🤖', title: 'AI Guide — Adaptive Suggestions', color: '#7C3AED', content: 'After each session, the AI analyzes performance and suggests changes: Topic Shifts, Socratic Updates, Quiz Adjustments, Remediation, Peer Teaching, Pace Changes, and Bloom Focus shifts.', deeper: 'Each suggestion shows the current plan vs. proposed change side-by-side. You accept, edit, or reject each suggestion.\n\nWhat this means for you: The AI watches performance 24/7 and tells you exactly what to adjust.' },
  { icon: '🔒', title: 'Privacy & Data Security', color: '#374151', content: 'Complete data segregation. Row-Level Security on every table. All API endpoints verify teacher ownership. Powered by Supabase with enterprise-grade PostgreSQL.', deeper: 'Your courses, students, analytics, and suggestions are completely private.\n\nWhat this means for you: Teach with confidence knowing your data is secure.' },
];

const COLLEGE_STEPS: Step[] = [
  { icon: '🎓', title: 'Multi-Course AI Platform', color: '#7C3AED', content: 'LEAP for higher education manages entire course programs — not just individual subjects. Upload syllabi for multiple courses, and the AI discovers how they connect: which topics in Linear Algebra are prerequisites for Machine Learning, which CS concepts feed into AI courses.', deeper: 'Unlike single-course platforms, LEAP understands that a student failing Matrix Operations in Math 201 will predictably struggle with Neural Networks in CS 301. The platform tracks these cross-course dependencies automatically.\n\nWhat this means for you: You see the complete picture of how your courses interconnect, and can intervene before bottlenecks cascade.' },
  { icon: '🗺️', title: 'Cross-Course Knowledge Graph', color: '#2E75B6', content: 'Each course has its own Knowledge Graph with Gates (conceptual checkpoints). But LEAP goes further — it connects gates ACROSS courses. "CS 301 Gate 2 (Regression) requires MATH 201 Gate 2 (Linear Transformations)" is a cross-course dependency that no single-course tool can see.', deeper: 'The Program View shows all your courses as swim lanes with gates as nodes. Within-course arrows show internal progression. Purple cross-course arrows show inter-disciplinary dependencies. You can hover over any gate to see what depends on it.\n\nWhat this means for you: You can instantly see which foundational topics in one course are blocking progress in another — and coordinate with other professors to address gaps.' },
  { icon: '📄', title: 'Upload Syllabi Per Course', color: '#1E7E34', content: 'Upload a syllabus for each course in your program (PDF, Word, or text). The AI deconstructs each into Gates, Lessons, Socratic Scripts, and Quizzes — then automatically identifies cross-course dependencies based on topic overlap and prerequisite chains.', deeper: 'For a 3-course CS program, you get: ~12 gates total, ~72 lessons with scripts, ~720 quiz questions, and 6+ cross-course dependency edges — all from 3 syllabus uploads.\n\nWhat this means for you: An entire semester\'s teaching material, across multiple courses, generated and interconnected in minutes.' },
  { icon: '💡', title: 'Syllabus Best Practices', color: '#B45309', content: 'The AI automatically detects cross-course dependencies by analyzing gate topics across your courses. For this to work well, your syllabi must be descriptive and use specific topic names — not vague chapter numbers.', deeper: 'DO: Use specific topic names ("Linear Regression", "Matrix Operations") not just "Topic 3". Include prerequisite knowledge clearly ("requires Calculus I concepts"). List learning outcomes that reference specific skills. Mention which concepts from other courses are needed.\n\nDON\'T: Upload just page numbers or chapter numbers without context. Use abbreviations the AI can\'t understand. Skip mentioning which topics depend on other courses.\n\nCROSS-COURSE TIP: When uploading a syllabus for an advanced course (like Machine Learning), explicitly mention prerequisites: "Requires Linear Algebra (vectors, matrices, eigenvalues) and Probability (distributions, Bayes theorem)." This helps the AI create accurate cross-course dependency edges.\n\nWhat this means for you: Well-structured syllabi produce accurate cross-course knowledge graphs, meaning the bottleneck detection and student analytics will correctly identify which students are stuck because of gaps in prerequisite courses.' },
  { icon: '📊', title: 'Bottleneck Detection', color: '#DC2626', content: 'LEAP\'s Bottleneck tab shows exactly where students are stuck across courses. "3 students blocked in CS 301 G2 because they lack MATH 201 G2 mastery" — this is the insight that\'s invisible when each course is managed separately.', deeper: 'The bottleneck analysis shows: which prerequisite gate is the blocker, which downstream gate is affected, how many students are impacted, and the severity. You can see cascade risk — if 5 students fail Probability in Math, they\'ll fail ML Foundations, then Regression, then Neural Networks.\n\nWhat this means for you: You can prioritize remediation in the prerequisite course to unblock progress across the entire program.' },
  { icon: '📚', title: 'Lesson Plans & Socratic Scripts', color: '#B45309', content: 'Every lesson across every course gets a complete plan: Learning Objective, Key Idea, Conceptual Breakthrough, Examples, Exercises. Socratic Scripts guide 4-stage discovery: Context Setting → Guided Exploration → Formalization → Application & Synthesis.', deeper: 'College-level scripts are different from K-12: they emphasize student-led exploration, peer discussion, and synthesis of ideas across topics. The Bloom\'s Taxonomy distribution shifts upward — more Analyze, Evaluate, and Create.\n\nWhat this means for you: Research-backed teaching scripts for every session, designed for higher education cognitive levels.' },
  { icon: '📈', title: 'Program-Level Analytics', color: '#7C3AED', content: 'See each student\'s performance across ALL your courses in a single view. The cross-course heatmap shows mastery per gate across CS 101, MATH 201, and CS 301 — revealing patterns like "strong coder but weak math" or "solid theory but can\'t apply."', deeper: 'The Students tab in the Program View shows overall mastery per student, broken down by course. Students flagged as at-risk in one course automatically get highlighted in dependent courses.\n\nWhat this means for you: One dashboard to understand each student holistically, not through the narrow lens of a single course.' },
  { icon: '🤖', title: 'AI Suggestions Across Courses', color: '#1B3A6B', content: 'AI generates suggestions that span courses: "Coordinate with Math department — 3 ML students need Linear Algebra remediation" or "Peer teaching: Priyanka (88% in CS) can help Vikram (40%) with Data Structures, which would unblock his ML progress."', deeper: 'Unlike single-course suggestions, cross-course recommendations identify root causes in prerequisite courses and suggest coordinated interventions. The AI considers the full dependency graph when making recommendations.\n\nWhat this means for you: Actionable, cross-departmental suggestions that actually address the root cause of student struggles.' },
  { icon: '🔒', title: 'Privacy & Security', color: '#374151', content: 'Complete data segregation. Each professor sees only their own courses and students. Row-Level Security on every table. Enterprise-grade PostgreSQL via Supabase.', deeper: 'Student data is isolated per course and per professor. Cross-course analytics only work for courses you teach or have explicit access to.\n\nWhat this means for you: Full privacy and security, even in a multi-course environment.' },
];

export function PlatformGuidePage() {
  const { profile } = useAuth();
  const isCollege = profile?.school === 'Horizon University College' || profile?.email?.includes('college') || profile?.email?.includes('university') || profile?.email?.includes('hu.ac.ae');
  const STEPS = isCollege ? COLLEGE_STEPS : SCHOOL_STEPS;

  const [currentStep, setCurrentStep] = useState(0);
  const [showDeeper, setShowDeeper] = useState(false);
  const step = STEPS[currentStep];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <img src="/ikigai-logo.jpeg" alt="LEAP" className="h-10 w-auto" />
        {!isCollege && <><div className="w-px h-8 bg-gray-200" /><img src="/lmgc-logo.jpeg" alt="LMGC" className="h-12 w-auto" /></>}
        <div className="ml-2">
          <h1 className="text-xl font-black" style={{ color: isCollege ? '#7C3AED' : '#1B3A6B' }}>Platform Guide</h1>
          <p className="text-[11px] text-gray-400">{isCollege ? 'How LEAP empowers your multi-course teaching' : 'How LEAP empowers your teaching'}</p>
        </div>
      </div>

      {/* Step navigation pills */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => { setCurrentStep(i); setShowDeeper(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${i === currentStep ? 'text-white shadow-card' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
            style={i === currentStep ? { background: s.color } : {}}>
            <span>{s.icon}</span><span className="hidden md:inline">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ background: i <= currentStep ? s.color : '#E5E7EB' }} />)}
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

        <div className="p-6 border-t border-gray-100">
          <button onClick={() => setShowDeeper(!showDeeper)} className="text-[12px] font-bold flex items-center gap-1.5 transition-colors" style={{ color: step.color }}>
            <span className="transition-transform" style={{ transform: showDeeper ? 'rotate(180deg)' : '' }}>{'\u25BC'}</span> Going Deeper
          </button>
          {showDeeper && (
            <div className="mt-3 animate-slide-down">
              {step.deeper.split('\n\n').map((para, i) => (
                <p key={i} className={`text-sm leading-relaxed mb-3 ${para.startsWith('What this means') ? 'font-medium text-gray-800 p-3 rounded-xl' : 'text-gray-600'}`}
                  style={para.startsWith('What this means') ? { background: `${step.color}08`, border: `1px solid ${step.color}20` } : {}}>{para}</p>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
          <button onClick={() => { setCurrentStep(Math.max(0, currentStep - 1)); setShowDeeper(false); }} disabled={currentStep === 0} className="btn-secondary text-[12px] disabled:opacity-30">&larr; Previous</button>
          <span className="text-[11px] text-gray-400">{currentStep + 1} / {STEPS.length}</span>
          {currentStep === STEPS.length - 1 ? (
            <Link to="/teacher" className="btn-primary text-[12px]">Go to Dashboard &rarr;</Link>
          ) : (
            <button onClick={() => { setCurrentStep(currentStep + 1); setShowDeeper(false); }} className="btn-primary text-[12px]">Next &rarr;</button>
          )}
        </div>
      </div>

      {/* Quick Jump Grid */}
      <div className={`grid gap-3 mt-6 ${STEPS.length <= 8 ? 'grid-cols-4' : 'grid-cols-5'}`}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => { setCurrentStep(i); setShowDeeper(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`card-interactive p-3 text-left ${i === currentStep ? 'ring-2' : ''}`} style={i === currentStep ? { borderColor: s.color } : {}}>
            <div className="flex items-center gap-2 mb-1"><span className="text-lg">{s.icon}</span><span className="text-[10px] font-bold text-gray-400">Step {i + 1}</span></div>
            <p className="text-[11px] font-semibold text-gray-700 leading-tight">{s.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
