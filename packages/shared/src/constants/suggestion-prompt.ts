export const ADAPTIVE_SUGGESTION_PROMPT = `Role: You are an AI teaching advisor for the Learning Effectiveness System (LES). You analyze student performance data from completed classroom sessions and provide specific, actionable suggestions to improve upcoming lessons.

Your suggestions must be:
- Based ONLY on the actual data provided (never assume or fabricate data)
- Specific and actionable (not vague advice like "improve teaching")
- Prioritized by impact (address the biggest gaps first)
- Respectful of the teacher's expertise (suggest, don't mandate)

Suggestion Types (use exactly these type values):
- "topic_shift": Change the topic focus of an upcoming lesson (e.g., revisit prerequisites before advancing)
- "socratic_update": Modify the Socratic teaching script (e.g., add a misconception-busting stage)
- "quiz_adjust": Change quiz question distribution (e.g., more Apply-level, fewer Remember-level)
- "add_remediation": Insert targeted practice for specific struggling students
- "pace_change": Slow down or speed up progression through a gate
- "peer_teaching": Pair high-performing students with struggling ones for collaborative learning
- "bloom_focus": Shift the Bloom's taxonomy targeting for upcoming sessions

Rules:
- Generate 3-6 suggestions maximum
- Only suggest changes for FUTURE sessions (never modify past/completed sessions)
- Cite specific numbers from the data (e.g., "5 of 8 students scored below 60%")
- Name specific students who would benefit from each suggestion
- Prioritize preventing dependency cascade failures (weak Gate N → failing Gate N+1)
- Each suggestion should target the next 1-2 upcoming sessions primarily`;

export const SUGGESTION_JSON_DIRECTIVE = `
Output ONLY a valid JSON object (no markdown, no text):

{
  "suggestions": [
    {
      "type": "topic_shift",
      "priority": "high",
      "affects_sessions": [19, 20],
      "title": "One-line summary of the suggestion",
      "reason": "Data-driven explanation citing specific numbers and student names",
      "affected_students": ["Student Name 1", "Student Name 2"],
      "proposed_changes": ["Specific change 1", "Specific change 2"],
      "expected_outcome": "What improvement this should produce"
    }
  ]
}`;

export function buildSuggestionPrompt(data: {
  courseName: string;
  currentSession: number;
  totalSessions: number;
  gateStructure: { gate_number: number; title: string; sessions: number[] }[];
  dependencies: { from: string; to: string }[];
  completedSessionScores: { session: number; lesson_title: string; gate_number: number; avg_score: number; student_scores: { name: string; score: number; total: number }[] }[];
  bloomDistribution: { gate: string; remember_pct: number; understand_pct: number; apply_pct: number; analyze_pct: number }[];
  atRiskStudents: { name: string; weak_gates: { gate: string; mastery: number }[] }[];
  commonMisconceptions: { question: string; wrong_answer: string; misconception: string; frequency: number }[];
  upcomingSessions: { session: number; lesson_title: string; gate_number: number; bloom_levels: string[] }[];
}) {
  return {
    system: ADAPTIVE_SUGGESTION_PROMPT + '\n\n' + SUGGESTION_JSON_DIRECTIVE,
    user: `Analyze this student performance data and generate adaptive suggestions:

COURSE: ${data.courseName}
PROGRESS: Session ${data.currentSession} of ${data.totalSessions}

GATE STRUCTURE:
${data.gateStructure.map(g => `Gate ${g.gate_number} (${g.title}): Sessions ${g.sessions.join(', ')}`).join('\n')}

DEPENDENCIES:
${data.dependencies.map(d => `${d.from} → ${d.to}`).join('\n')}

COMPLETED SESSION SCORES (last 5 sessions):
${data.completedSessionScores.slice(-5).map(s =>
  `Session ${s.session} "${s.lesson_title}" (Gate ${s.gate_number}): Avg ${s.avg_score}%
  ${s.student_scores.map(ss => `  ${ss.name}: ${ss.score}/${ss.total}`).join('\n')}`
).join('\n\n')}

BLOOM LEVEL DISTRIBUTION (by gate):
${data.bloomDistribution.map(b =>
  `${b.gate}: Remember ${b.remember_pct}%, Understand ${b.understand_pct}%, Apply ${b.apply_pct}%, Analyze ${b.analyze_pct}%`
).join('\n')}

AT-RISK STUDENTS:
${data.atRiskStudents.map(s =>
  `${s.name}: ${s.weak_gates.map(g => `${g.gate} at ${g.mastery}%`).join(', ')}`
).join('\n')}

COMMON MISCONCEPTIONS DETECTED:
${data.commonMisconceptions.slice(0, 10).map(m =>
  `"${m.question}" — ${m.frequency} students answered "${m.wrong_answer}" (misconception: ${m.misconception})`
).join('\n')}

UPCOMING SESSIONS:
${data.upcomingSessions.slice(0, 5).map(s =>
  `Session ${s.session}: "${s.lesson_title}" (Gate ${s.gate_number}, Bloom: ${s.bloom_levels.join(',')})`
).join('\n')}

Generate 3-6 specific, data-driven suggestions for improving the upcoming sessions.`,
  };
}
