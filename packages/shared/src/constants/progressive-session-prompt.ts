import { getClassLevelDirective } from './system-prompt';

export interface ProgressiveSessionParams {
  // Gate context
  gateTitle: string;
  gateSubConcepts: string[];
  gateNumber: number;
  totalGates: number;
  // Session context
  lessonNumber: number;
  totalSessions: number;
  sessionDuration: number;
  dikwTargetLevel: 'data' | 'information' | 'knowledge' | 'wisdom';
  classLevel?: string;
  // Previous session (null for Session 1)
  previousSession?: {
    title: string;
    objective: string;
    keyIdea: string;
    bloomLevels: string[];
  };
  // Previous session performance (null for Session 1)
  previousPerformance?: {
    classAverage: number;
    bloomDistribution: Record<string, number>;
    topMisconceptions: { text: string; frequency: number }[];
    atRiskStudents: { name: string; score: number }[];
    totalStudents: number;
  };
  // Teacher's feedback for this session
  teacherFeedback?: string;
  // What's left to cover
  remainingSubConcepts: string[];
  lessonsRemainingInGate: number;
  // Class-level diagnostic profile (aggregated)
  classProfile?: {
    assessed_count: number;
    total_students: number;
    dominant_strategy: string;
    dominant_strategy_pct: number;
    avg_prior_knowledge: number;
    dominant_learning_dimension: string;
    dominant_dimension_score: number;
    learning_dimensions: Record<string, number>;
    struggling_count: number;
    strategy_distribution: Record<string, number>;
  };
}

const DIKW_SCRIPT_STYLES: Record<string, string> = {
  data: `Socratic Script Style: TEACHER-LED EXPLANATION
- Stage 1 "Hook" (3 min): Quick question connecting to prior knowledge
- Stage 2 "Explain & Explore" (15 min): Teacher delivers core facts and definitions clearly
- Stage 3 "Guided Practice" (12 min): Students practice with teacher support
- Stage 4 "Check Understanding" (remaining time): Quick comprehension check`,
  information: `Socratic Script Style: GUIDED EXPLORATION
- Stage 1 "Hook" (5 min): Scenario connecting to students' experience
- Stage 2 "Discovery" (12 min): Students explore relationships between ideas
- Stage 3 "Concept Build" (13 min): Students articulate understanding
- Stage 4 "Practice" (remaining time): Apply understanding to structured exercises`,
  knowledge: `Socratic Script Style: DISCOVERY & APPLICATION
- Stage 1 "Hook" (5 min): Real-world puzzle or problem
- Stage 2 "Discovery" (15 min): Guide students to discover patterns through questions. Include a [TPS] moment: "Turn to your partner and discuss: [specific question about the pattern]"
- Stage 3 "Concept Build" (12 min): Students formalize the concept
- Stage 4 "Application" (remaining time): Apply to a new problem`,
  wisdom: `Socratic Script Style: DEBATE & JUDGMENT
- Stage 1 "Dilemma" (5 min): Present a real-world dilemma with no single right answer
- Stage 2 "Debate" (18 min): Students explore multiple perspectives with evidence. Include [TPS]: "Discuss with your partner: which side do you agree with and why?"
- Stage 3 "Synthesis" (10 min): Integrate ideas across lessons. Include [TPS]: "With your partner, summarize the key insight in one sentence."
- Stage 4 "Position Defense" (remaining time): Students articulate and justify their judgment`,
};

export function buildProgressiveSessionPrompt(params: ProgressiveSessionParams): { system: string; user: string } {
  const classDirective = getClassLevelDirective(params.classLevel);
  const scriptStyle = DIKW_SCRIPT_STYLES[params.dikwTargetLevel] || DIKW_SCRIPT_STYLES.knowledge;

  const system = `Role: You are an expert curriculum architect generating ONE lesson for a progressive, adaptive course. Each session builds directly on the previous session's outcomes.

You generate content that ADAPTS to student performance:
- If previous session performance was LOW (<60%): Revisit key concepts, add scaffolding, lower Bloom target, include more examples
- If previous session performance was MODERATE (60-85%): Proceed normally, address detected misconceptions
- If previous session performance was HIGH (>85%): Accelerate, push to higher Bloom levels, include challenge problems
- If teacher gave feedback: prioritize their observations over raw data

WORKED EXAMPLE FADING (based on cognitive load theory):
${params.lessonNumber <= Math.ceil(params.totalSessions * 0.3) ?
  '- EARLY COURSE: Include 3-4 detailed worked examples with step-by-step solutions. Include 1-2 exercises. Students are novices — they need to see HOW before they DO.' :
  params.lessonNumber <= Math.ceil(params.totalSessions * 0.7) ?
  '- MID COURSE: Include 2 worked examples + 2-3 exercises. Provide partial solutions (completion tasks) where students fill in missing steps. Fading from guided to independent.' :
  '- LATE COURSE: Include 1 brief example + 3-4 exercises/challenges. Students should be doing most of the cognitive work themselves. Minimize hand-holding.'}

${scriptStyle}

DIKW Target: ${params.dikwTargetLevel.toUpperCase()} level
${classDirective}

Output ONLY valid JSON (no markdown, no commentary):
{
  "lesson": {
    "title": "Lesson title",
    "objective": "Learning objective for this session",
    "key_idea": "Core insight students should grasp",
    "conceptual_breakthrough": "The aha moment",
    "examples": [{"text": "Example 1"}, {"text": "Example 2"}],
    "exercises": [{"text": "Exercise 1"}, {"text": "Exercise 2"}],
    "bloom_levels": ["remember", "understand"],
    "dikw_level": "${params.dikwTargetLevel}",
    "duration_minutes": ${params.sessionDuration}
  },
  "socratic_script": {
    "stages": [
      {"stage_number": 1, "title": "Hook", "duration_minutes": 5, "teacher_prompt": "question", "expected_response": "response", "follow_up": "bridge"},
      {"stage_number": 2, "title": "Discovery", "duration_minutes": 15, "teacher_prompt": "question", "expected_response": "response", "follow_up": "bridge"},
      {"stage_number": 3, "title": "Concept Build", "duration_minutes": 12, "teacher_prompt": "question", "expected_response": "response", "follow_up": "bridge"},
      {"stage_number": 4, "title": "Application", "duration_minutes": 8, "teacher_prompt": "question", "expected_response": "response", "follow_up": "bridge"}
    ]
  },
  "questions": [
    {
      "question_text": "specific question",
      "question_type": "mcq",
      "bloom_level": "remember",
      "difficulty": 1,
      "options": [{"text": "A", "is_correct": true}, {"text": "B", "is_correct": false}],
      "correct_answer": "explanation",
      "rubric": "grading criteria",
      "distractors": [{"answer": "wrong", "misconception": "why"}]
    }
  ]
}`;

  // Build user message with context
  let userMessage = `Generate Session ${params.lessonNumber} of ${params.totalSessions} for this course.

GATE ${params.gateNumber} of ${params.totalGates}: "${params.gateTitle}"
Sub-concepts in this gate: ${params.gateSubConcepts.join(', ')}
Lessons remaining in this gate: ${params.lessonsRemainingInGate}
Remaining sub-concepts to cover: ${params.remainingSubConcepts.join(', ') || 'All covered — review and deepen'}
Session duration: ${params.sessionDuration} minutes
`;

  if (params.previousSession) {
    userMessage += `
PREVIOUS SESSION (Session ${params.lessonNumber - 1}):
- Title: "${params.previousSession.title}"
- Objective: ${params.previousSession.objective}
- Key Idea: ${params.previousSession.keyIdea}
- Bloom Levels: ${params.previousSession.bloomLevels.join(', ')}
`;
  } else {
    userMessage += `
This is the FIRST SESSION of the course. No previous session data available.
Start with foundational concepts at the Data/Information level.
`;
  }

  if (params.previousPerformance) {
    const perf = params.previousPerformance;
    userMessage += `
PREVIOUS SESSION STUDENT PERFORMANCE:
- Class Average: ${perf.classAverage}% (${perf.totalStudents} students)
- Bloom Distribution: ${Object.entries(perf.bloomDistribution).map(([k, v]) => `${k}: ${v}%`).join(', ')}
${perf.classAverage < 60 ? '⚠️ LOW PERFORMANCE — Students are struggling. Revisit key concepts before advancing. Add more scaffolding and simpler examples.' : ''}
${perf.classAverage > 85 ? '✅ HIGH PERFORMANCE — Students are ready to accelerate. Push to higher Bloom levels and add challenge problems.' : ''}
`;

    if (perf.topMisconceptions.length > 0) {
      userMessage += `
TOP MISCONCEPTIONS DETECTED:
${perf.topMisconceptions.slice(0, 5).map(m => `- "${m.text}" (${m.frequency} students)`).join('\n')}
ADDRESS THESE in your lesson — include examples that specifically correct these misunderstandings.
`;
    }

    if (perf.atRiskStudents.length > 0) {
      userMessage += `
AT-RISK STUDENTS (scoring <60%):
${perf.atRiskStudents.slice(0, 5).map(s => `- ${s.name}: ${s.score}%`).join('\n')}
Include scaffolded exercises that help these students catch up.
`;
    }
  }

  if (params.teacherFeedback) {
    userMessage += `
TEACHER'S FEEDBACK (HIGHEST PRIORITY — override data if conflicting):
"${params.teacherFeedback}"
`;
  }

  // Class diagnostic profile (aggregated from individual assessments)
  if (params.classProfile && params.classProfile.assessed_count > 0) {
    const cp = params.classProfile;
    userMessage += `
CLASS LEARNING PROFILE (from diagnostic assessment of ${cp.assessed_count}/${cp.total_students} students):
- Dominant learning strategy: ${cp.dominant_strategy_pct}% of class are "${cp.dominant_strategy}" learners
  (${Object.entries(cp.strategy_distribution).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(', ')})
- Average prior knowledge: ${cp.avg_prior_knowledge}%${cp.avg_prior_knowledge < 40 ? ' — LOW: Do not assume prerequisites. Start with basics.' : cp.avg_prior_knowledge > 70 ? ' — HIGH: Students have strong foundations. Push to higher Bloom levels.' : ''}
- Dominant learning style: ${cp.dominant_learning_dimension} (${cp.dominant_dimension_score}%)
  (Full: logical=${cp.learning_dimensions.logical}%, visual=${cp.learning_dimensions.visual}%, reflective=${cp.learning_dimensions.reflective}%, kinesthetic=${cp.learning_dimensions.kinesthetic}%, auditory=${cp.learning_dimensions.auditory}%)
- Struggling students: ${cp.struggling_count} need immediate scaffolding

ADAPT YOUR LESSON BASED ON THIS PROFILE:
${cp.dominant_strategy === 'surface' ? '- Most students are surface learners. Include explicit step-by-step explanations, worked examples, and clear connections between ideas. Do NOT assume they will discover patterns on their own.' : ''}
${cp.dominant_strategy === 'deep' ? '- Most students are deep learners. Include "why" explanations, conceptual challenges, and connections to prior topics. They can handle guided inquiry.' : ''}
${cp.dominant_strategy === 'struggling' ? '- Many students are struggling. Use very simple language, concrete examples, and lots of scaffolding. Break every concept into micro-steps.' : ''}
${cp.dominant_learning_dimension === 'visual' ? '- Class is predominantly visual. Emphasize diagrams, charts, mind maps, and visual analogies in examples.' : ''}
${cp.dominant_learning_dimension === 'kinesthetic' ? '- Class is predominantly kinesthetic. Emphasize hands-on exercises, physical sorting, building activities.' : ''}
${cp.dominant_learning_dimension === 'auditory' ? '- Class is predominantly auditory. Emphasize discussion prompts, Think-Pair-Share, verbal explanations.' : ''}
${cp.dominant_learning_dimension === 'logical' ? '- Class is predominantly logical. Emphasize step-by-step procedures, formulas, structured problem-solving.' : ''}
${cp.dominant_learning_dimension === 'reflective' ? '- Class is predominantly reflective. Include journaling prompts, self-explanation exercises, quiet thinking time.' : ''}
`;
  }

  // Interleaved review directive (only after Session 3)
  if (params.lessonNumber > 3 && params.previousSession) {
    userMessage += `
INTERLEAVED REVIEW (research shows 50-125% improvement in retention):
In the 10 quiz questions, include 2 REVIEW QUESTIONS from earlier sessions:
- 1 question reviewing a concept from 2 sessions ago
- 1 question reviewing a concept from 4+ sessions ago (if available)
These review questions should be at the Remember or Understand level to reinforce prior learning.
Mark these review questions with bloom_level appropriate to the reviewed concept.
`;
  }

  userMessage += `
Generate:
1. ONE lesson plan with title, objective, key_idea, examples, exercises, bloom_levels, dikw_level
2. ONE 4-stage Socratic teaching script following the ${params.dikwTargetLevel.toUpperCase()} style
3. TEN quiz questions (mix of MCQ, True/False, Short Answer, Open-Ended) adapted to student level${params.lessonNumber > 3 ? ' — including 2 interleaved review questions from earlier sessions' : ''}

Make the content SPECIFIC to this gate's topic — not generic templates.`;

  return { system, user: userMessage };
}
