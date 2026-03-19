import { useState } from 'react';

const STEPS = [
  {
    icon: '🏫',
    title: 'What is the Learning Execution System?',
    color: '#1B3A6B',
    content: 'LES is a cognitive operating system for education. Unlike traditional LMS platforms that track marks and attendance, LES maps the actual knowledge architecture of a subject and ensures students build genuine conceptual understanding.',
    deeper: 'Traditional education treats topics as a flat list to be "covered." LES treats knowledge as a dependency graph where concepts build on each other. Every student progresses through the same conceptual gates, but at their own pace and cognitive depth.',
  },
  {
    icon: '🗺',
    title: 'The Knowledge Graph',
    color: '#2E75B6',
    content: 'When you upload a syllabus, LES AI deconstructs it into its true conceptual structure — identifying atomic concepts, dependency chains, and critical learning gates. This creates a Knowledge Graph that represents how ideas actually connect.',
    deeper: 'The AI identifies 6 Critical Gates — conceptual checkpoints that must be mastered before moving forward. Some gates can run in parallel (like Geometry alongside Fractions) because they don\'t depend on each other. Others are strictly sequential.',
  },
  {
    icon: '🧠',
    title: "Bloom's Taxonomy Integration",
    color: '#7C3AED',
    content: 'LES doesn\'t just measure if an answer is correct — it measures cognitive depth using Bloom\'s Taxonomy. Each concept is assessed at six levels: Remember, Understand, Apply, Analyze, Evaluate, and Create.',
    deeper: 'A student might correctly answer "What is 3/4?" (Remember) but fail at "Why can\'t you add 3/4 + 2/5 directly?" (Analyze). LES tracks which cognitive levels each student has reached, not just their percentage score.',
  },
  {
    icon: '🎓',
    title: 'How Students Benefit',
    color: '#16A34A',
    content: 'Students see a journey map of their learning — which gates they\'ve mastered, which they\'re working on, and which are locked behind prerequisites. Each gate shows both mastery percentage and Bloom\'s ceiling.',
    deeper: 'The gate locking mechanism prevents students from attempting advanced topics before their foundations are solid. This eliminates the "Swiss cheese" effect where students have scattered knowledge with hidden gaps.',
  },
  {
    icon: '👩‍🏫',
    title: 'How Teachers Benefit',
    color: '#B45309',
    content: 'Teachers get a class-wide heatmap showing every student\'s mastery across every gate. The Bloom\'s distribution chart reveals cognitive depth gaps. The AI Lesson Refiner provides targeted teaching suggestions.',
    deeper: 'When you see that 95% of students can Remember but only 30% can Apply, you know exactly where to focus your next lesson. The dependency risk detector warns you when weak prerequisites are about to cascade into downstream failures.',
  },
  {
    icon: '🤖',
    title: 'The AI Layer',
    color: '#DC2626',
    content: 'LES uses AI (Claude or GPT-4o) to: 1) Deconstruct syllabuses into knowledge graphs, 2) Generate Socratic teaching scripts, 3) Create diagnostic questions with misconception analysis, 4) Suggest lesson refinements based on student data.',
    deeper: 'The AI doesn\'t replace the teacher — it amplifies expertise. Generated content goes through a review process where teachers accept, reject, or edit every item. The system learns from these decisions to improve future suggestions.',
  },
  {
    icon: '🔗',
    title: 'Gate Dependencies',
    color: '#1B3A6B',
    content: 'Why can Gate 5 (Geometry) be open while Gate 4 (Decimals) is still locked? Because Geometry doesn\'t depend on Decimals — they\'re parallel tracks in the knowledge graph.',
    deeper: 'Traditional courses force linear progression: Chapter 1, 2, 3... But real learning isn\'t linear. LES uses the dependency graph to allow maximum parallel progress while enforcing genuine prerequisites.',
  },
  {
    icon: '⚡',
    title: 'What Makes This Different',
    color: '#7C3AED',
    content: 'LES is dependency-aware (concepts build on each other), depth-aware (measuring Bloom\'s levels, not just correctness), and style-aware (adapting to visual, auditory, and kinesthetic learners).',
    deeper: 'Compare this to a traditional LMS: it tracks attendance, stores files, and records grades. LES tracks conceptual mastery, maps cognitive depth, detects knowledge gaps, and provides AI-driven teaching recommendations. It\'s the difference between a filing cabinet and a GPS.',
  },
];

export function PlatformGuidePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showDeeper, setShowDeeper] = useState(false);

  const step = STEPS[currentStep];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-black text-gray-900 mb-1">Platform Guide</h1>
      <p className="text-[12px] text-gray-400 mb-6">Learn how the Learning Execution System works</p>

      {/* Step navigation */}
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

      {/* Progress */}
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
            <p className="text-sm text-gray-600 mt-3 animate-slide-down leading-relaxed">
              {step.deeper}
            </p>
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
          <button
            onClick={() => { setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1)); setShowDeeper(false); }}
            disabled={currentStep === STEPS.length - 1}
            className="btn-primary text-[12px] disabled:opacity-30"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Quick Jump Grid */}
      <div className="grid grid-cols-4 gap-3 mt-6">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => { setCurrentStep(i); setShowDeeper(false); }}
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
