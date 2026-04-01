import type { DiagnosticQuestion, DiagnosticResult, StrategyProfile } from '../types/progress';

// ─── 20 Diagnostic Questions ──────────────────────────────────
// Section 1 (Q1-5): Prior Knowledge — subject-agnostic baseline
// Section 2 (Q6-10): Cognitive Readiness — Bloom ladder
// Section 3 (Q11-15): Learning Strategy — meta-learning preferences
// Section 4 (Q16-20): Processing Preference — modality & environment

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // ── Section 1: Prior Knowledge (5 Qs) ──
  { id: 1, section: 'prior_knowledge', bloom_level: 'remember',
    question_text: 'Can you recall the main topics you studied in this subject last year?',
    options: [
      { text: 'Yes, I can list most topics clearly', value: 'strong' },
      { text: 'I remember some topics but not all', value: 'moderate' },
      { text: 'I barely remember what was covered', value: 'weak' },
      { text: 'This is a completely new subject for me', value: 'none' },
    ]},
  { id: 2, section: 'prior_knowledge', bloom_level: 'remember',
    question_text: 'If I asked you to explain the most basic concept in this subject to a younger student, could you?',
    options: [
      { text: 'Yes, easily and with examples', value: 'strong' },
      { text: 'I could explain the basics but might struggle with details', value: 'moderate' },
      { text: 'I would need to look it up first', value: 'weak' },
      { text: 'I wouldn\'t know where to start', value: 'none' },
    ]},
  { id: 3, section: 'prior_knowledge', bloom_level: 'understand',
    question_text: 'How confident are you about connecting ideas across different topics in this subject?',
    options: [
      { text: 'Very confident — I can see how topics relate to each other', value: 'strong' },
      { text: 'Somewhat — I see some connections but miss others', value: 'moderate' },
      { text: 'Not very — each topic feels separate to me', value: 'weak' },
      { text: 'Not at all — I don\'t know enough to connect anything', value: 'none' },
    ]},
  { id: 4, section: 'prior_knowledge', bloom_level: 'understand',
    question_text: 'Have you ever used concepts from this subject in real life or another subject?',
    options: [
      { text: 'Yes, frequently — I apply what I learn', value: 'strong' },
      { text: 'Sometimes, when the connection is obvious', value: 'moderate' },
      { text: 'Rarely — I don\'t usually think about it outside class', value: 'weak' },
      { text: 'Never', value: 'none' },
    ]},
  { id: 5, section: 'prior_knowledge', bloom_level: 'apply',
    question_text: 'If given a new problem in this subject, how would you approach it?',
    options: [
      { text: 'I\'d identify which rules/methods apply and try them', value: 'strong' },
      { text: 'I\'d look for a similar example I\'ve seen before', value: 'moderate' },
      { text: 'I\'d wait for the teacher to show me how', value: 'weak' },
      { text: 'I wouldn\'t know where to begin', value: 'none' },
    ]},

  // ── Section 2: Cognitive Readiness — Bloom Ladder (5 Qs) ──
  { id: 6, section: 'cognitive_readiness', bloom_level: 'remember',
    question_text: 'When you read a textbook chapter, can you identify and list the key facts?',
    options: [
      { text: 'Yes, I can pick out the important points quickly', value: 'yes' },
      { text: 'Sometimes, but I often miss key details', value: 'partial' },
      { text: 'I struggle to separate important from unimportant', value: 'no' },
    ]},
  { id: 7, section: 'cognitive_readiness', bloom_level: 'understand',
    question_text: 'Can you explain a concept you\'ve learned in your own words (not just repeat the textbook)?',
    options: [
      { text: 'Yes, I can rephrase ideas and give my own examples', value: 'yes' },
      { text: 'I can sometimes, but I often fall back on the textbook wording', value: 'partial' },
      { text: 'I usually just memorize the exact words', value: 'no' },
    ]},
  { id: 8, section: 'cognitive_readiness', bloom_level: 'apply',
    question_text: 'When given a new problem you haven\'t seen before, can you figure out which method to use?',
    options: [
      { text: 'Yes, I can usually identify the right approach', value: 'yes' },
      { text: 'Only if the problem looks similar to one I\'ve practiced', value: 'partial' },
      { text: 'I need someone to tell me which method to use', value: 'no' },
    ]},
  { id: 9, section: 'cognitive_readiness', bloom_level: 'analyze',
    question_text: 'Can you compare two different ways of solving the same problem and explain which is better?',
    options: [
      { text: 'Yes, I can evaluate pros and cons of different approaches', value: 'yes' },
      { text: 'I can see differences but struggle to judge which is better', value: 'partial' },
      { text: 'I usually just use whatever method the teacher showed', value: 'no' },
    ]},
  { id: 10, section: 'cognitive_readiness', bloom_level: 'evaluate',
    question_text: 'If a classmate shows you their solution, can you tell if it\'s correct and explain any errors?',
    options: [
      { text: 'Yes, I can spot errors and explain what went wrong', value: 'yes' },
      { text: 'Sometimes, but only for simple mistakes', value: 'partial' },
      { text: 'I can\'t usually tell if someone else\'s answer is right or wrong', value: 'no' },
    ]},

  // ── Section 3: Learning Strategy (5 Qs) ──
  { id: 11, section: 'learning_strategy',
    question_text: 'When you don\'t understand something, what do you usually do FIRST?',
    options: [
      { text: 'Re-read the text or notes more carefully', value: 'surface' },
      { text: 'Try practice problems to figure it out', value: 'deep' },
      { text: 'Ask a friend or teacher to explain differently', value: 'social' },
      { text: 'Draw a diagram or make notes in my own words', value: 'active' },
    ]},
  { id: 12, section: 'learning_strategy',
    question_text: 'Before a test, how do you usually prepare?',
    options: [
      { text: 'Review my notes and highlight key points', value: 'surface' },
      { text: 'Do as many practice questions as possible', value: 'deep' },
      { text: 'Explain topics to a friend or study partner', value: 'social' },
      { text: 'Create summary sheets, flashcards, or mind maps', value: 'active' },
    ]},
  { id: 13, section: 'learning_strategy',
    question_text: 'You learn best when the teacher:',
    options: [
      { text: 'Explains everything step by step clearly', value: 'guided' },
      { text: 'Gives a problem to figure out on my own', value: 'discovery' },
      { text: 'Shows a video, demo, or real-world example', value: 'visual' },
      { text: 'Lets me practice immediately and learn by doing', value: 'kinesthetic' },
    ]},
  { id: 14, section: 'learning_strategy',
    question_text: 'When solving a hard problem, you usually:',
    options: [
      { text: 'Try to remember a similar example I\'ve seen', value: 'surface' },
      { text: 'Break it into smaller parts and solve each', value: 'deep' },
      { text: 'Try different approaches until something works', value: 'competent' },
      { text: 'Feel stuck and wait for help', value: 'struggling' },
    ]},
  { id: 15, section: 'learning_strategy',
    question_text: 'After getting a wrong answer, you usually:',
    options: [
      { text: 'Check the correct answer and move on', value: 'surface' },
      { text: 'Try to understand WHY my answer was wrong', value: 'deep' },
      { text: 'Redo the problem using a different method', value: 'competent' },
      { text: 'Feel frustrated and skip to the next question', value: 'struggling' },
    ]},

  // ── Section 4: Processing Preference (5 Qs) ──
  { id: 16, section: 'processing_preference',
    question_text: 'Which type of explanation helps you understand BEST?',
    options: [
      { text: 'A clear written paragraph with definitions', value: 'reading' },
      { text: 'A diagram, chart, or visual illustration', value: 'visual' },
      { text: 'A worked-out example with step-by-step solution', value: 'logical' },
      { text: 'A teacher explaining it out loud with a story', value: 'auditory' },
    ]},
  { id: 17, section: 'processing_preference',
    question_text: 'Which classroom activity do you enjoy MOST?',
    options: [
      { text: 'Reading and taking notes', value: 'reflective' },
      { text: 'Solving problems and quizzes', value: 'logical' },
      { text: 'Group discussion and debate', value: 'auditory' },
      { text: 'Building, creating, or hands-on activities', value: 'kinesthetic' },
    ]},
  { id: 18, section: 'processing_preference',
    question_text: 'When learning something completely new, you prefer to:',
    options: [
      { text: 'See the big picture first, then details', value: 'visual' },
      { text: 'Start with the details and build up', value: 'logical' },
      { text: 'Try it immediately and learn by doing', value: 'kinesthetic' },
      { text: 'Watch someone else do it first, then try', value: 'reflective' },
    ]},
  { id: 19, section: 'processing_preference',
    question_text: 'In class, you pay MOST attention when:',
    options: [
      { text: 'The teacher is talking and explaining', value: 'auditory' },
      { text: 'The class is having a discussion', value: 'auditory' },
      { text: 'We\'re doing an activity or experiment', value: 'kinesthetic' },
      { text: 'The teacher shows pictures, videos, or diagrams', value: 'visual' },
    ]},
  { id: 20, section: 'processing_preference',
    question_text: 'Your ideal study environment is:',
    options: [
      { text: 'Quiet, alone, with my notes', value: 'reflective' },
      { text: 'With background music or sounds', value: 'auditory' },
      { text: 'With a study partner or group', value: 'kinesthetic' },
      { text: 'At a desk with organized materials and good lighting', value: 'logical' },
    ]},
];

// ─── Scoring Algorithm ────────────────────────────────────────

export function scoreDiagnostic(answers: Record<number, string>): DiagnosticResult {
  // 1. Prior Knowledge Score (Q1-5)
  const pkScores: Record<string, number> = { strong: 100, moderate: 65, weak: 30, none: 0 };
  let pkTotal = 0;
  for (let i = 1; i <= 5; i++) {
    pkTotal += pkScores[answers[i]] || 0;
  }
  const prior_knowledge_score = Math.round(pkTotal / 5);

  // 2. Bloom Ceiling (Q6-10)
  const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate'];
  let bloom_ceiling = 'remember';
  for (let i = 6; i <= 10; i++) {
    if (answers[i] === 'yes' || answers[i] === 'partial') {
      bloom_ceiling = bloomLevels[i - 6];
    } else {
      break; // Stop at first 'no'
    }
  }

  // 3. Strategy Profile (Q14 + Q15 primary, Q11-13 secondary)
  const strategyMap: Record<string, StrategyProfile> = {
    surface: 'surface', deep: 'deep', competent: 'competent', struggling: 'struggling',
  };
  const q14 = answers[14] || 'surface';
  const q15 = answers[15] || 'surface';
  let strategy_profile: StrategyProfile = strategyMap[q14] || 'surface';
  // If Q14 and Q15 agree, high confidence. If not, use Q14 as primary.
  if (q14 === q15) {
    strategy_profile = strategyMap[q14] || 'surface';
  } else if (q14 === 'struggling' || q15 === 'struggling') {
    strategy_profile = 'struggling';
  } else if (q14 === 'competent' || q15 === 'competent') {
    strategy_profile = 'competent';
  }

  // 4. Learning Dimensions (Q11-13 + Q16-20)
  const dims = { logical: 50, visual: 50, reflective: 50, kinesthetic: 50, auditory: 50 };
  const dimMap: Record<string, Record<string, keyof typeof dims>> = {
    '11': { surface: 'reflective', deep: 'kinesthetic', social: 'auditory', active: 'visual' },
    '12': { surface: 'reflective', deep: 'logical', social: 'auditory', active: 'kinesthetic' },
    '13': { guided: 'logical', discovery: 'kinesthetic', visual: 'visual', kinesthetic: 'kinesthetic' },
    '16': { reading: 'reflective', visual: 'visual', logical: 'logical', auditory: 'auditory' },
    '17': { reflective: 'reflective', logical: 'logical', auditory: 'auditory', kinesthetic: 'kinesthetic' },
    '18': { visual: 'visual', logical: 'logical', kinesthetic: 'kinesthetic', reflective: 'reflective' },
    '19': { auditory: 'auditory', kinesthetic: 'kinesthetic', visual: 'visual' },
    '20': { reflective: 'reflective', auditory: 'auditory', kinesthetic: 'kinesthetic', logical: 'logical' },
  };

  for (const [qId, mapping] of Object.entries(dimMap)) {
    const answer = answers[parseInt(qId)];
    if (answer && mapping[answer]) {
      dims[mapping[answer]] = Math.min(100, dims[mapping[answer]] + 15);
    }
  }

  // Normalize so strongest = 80-100, weakest = 20-40
  const maxDim = Math.max(...Object.values(dims));
  const minDim = Math.min(...Object.values(dims));
  const range = maxDim - minDim || 1;
  const normalized = {
    logical: Math.round(20 + ((dims.logical - minDim) / range) * 80),
    visual: Math.round(20 + ((dims.visual - minDim) / range) * 80),
    reflective: Math.round(20 + ((dims.reflective - minDim) / range) * 80),
    kinesthetic: Math.round(20 + ((dims.kinesthetic - minDim) / range) * 80),
    auditory: Math.round(20 + ((dims.auditory - minDim) / range) * 80),
  };

  return {
    answers,
    prior_knowledge_score,
    bloom_ceiling,
    strategy_profile,
    learning_dimensions: normalized,
  };
}
