interface Props {
  status: string;
  compact?: boolean;
}

const STEPS = [
  { key: 'created', label: 'Created', icon: '📝' },
  { key: 'syllabus', label: 'Syllabus', icon: '📄' },
  { key: 'processed', label: 'AI Processed', icon: '🤖' },
  { key: 'reviewed', label: 'Reviewed', icon: '✅' },
  { key: 'published', label: 'Published', icon: '🚀' },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'draft': return 0;       // Just created, no syllabus yet
    case 'processing': return 2;  // Syllabus uploaded, AI processing
    case 'review': return 3;      // AI done, teacher reviewing
    case 'active': return 4;      // Published and live
    case 'archived': return 4;
    default: return 0;
  }
}

export function JourneySteps({ status, compact }: Props) {
  const currentStep = getStepIndex(status);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div
            key={step.key}
            className={`w-2 h-2 rounded-full transition-all ${
              i <= currentStep ? 'bg-les-navy' : 'bg-gray-200'
            }`}
            title={step.label}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
            i < currentStep
              ? 'bg-green-100 text-green-700'
              : i === currentStep
                ? 'bg-les-navy text-white'
                : 'bg-gray-100 text-gray-400'
          }`}>
            <span>{i < currentStep ? '✓' : step.icon}</span>
            <span>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-4 h-0.5 mx-0.5 ${i < currentStep ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
