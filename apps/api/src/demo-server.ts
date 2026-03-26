import express from 'express';
import cors from 'cors';
import { MOCK_TEACHER, MOCK_STUDENTS, MOCK_COURSE, MOCK_GATES, MOCK_SUGGESTIONS, MOCK_LEARNING_PROFILE, getMockProgress } from './services/mock-data.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

let currentUser = MOCK_TEACHER;
let suggestions = [...MOCK_SUGGESTIONS];

// Dependency edges with reasons
const GATE_EDGES = [
  { gate_id: 'gate-2', prerequisite_gate_id: 'gate-1', reason: 'Number sense is foundational for finding factors and multiples' },
  { gate_id: 'gate-3', prerequisite_gate_id: 'gate-2', reason: 'HCF/LCM needed for finding common denominators in fractions' },
  { gate_id: 'gate-4', prerequisite_gate_id: 'gate-3', reason: 'Fraction understanding required for decimal conversion' },
  { gate_id: 'gate-5', prerequisite_gate_id: 'gate-1', reason: 'Basic number operations needed for measurement calculations' },
  { gate_id: 'gate-6', prerequisite_gate_id: 'gate-4', reason: 'Decimal understanding required for percentage calculations' },
];

// Gate lesson distribution: 30 lessons across 6 gates
const GATE_LESSON_COUNTS = [6, 5, 6, 5, 5, 3]; // total = 30

// Lesson titles per gate
const LESSON_TITLES: Record<string, string[]> = {
  'gate-1': ['Introduction to Place Value', 'Expanded Form & Notation', 'Indian Number System', 'International Number System', 'Comparing & Ordering Large Numbers', 'Rounding & Estimation'],
  'gate-2': ['Understanding Factors', 'Prime & Composite Numbers', 'Prime Factorisation', 'Finding HCF', 'Finding LCM & Applications'],
  'gate-3': ['Understanding Fractions', 'Equivalent Fractions', 'Adding & Subtracting Unlike Fractions', 'Multiplying Fractions', 'Dividing Fractions', 'Fraction Word Problems'],
  'gate-4': ['Decimal Place Value', 'Fraction-Decimal Conversion', 'Operations with Decimals', 'Measurement & Units', 'Decimal Word Problems'],
  'gate-5': ['Types of Angles', 'Properties of Triangles', 'Quadrilaterals & Polygons', 'Perimeter & Area', 'Volume Basics'],
  'gate-6': ['Fraction to Percentage', 'Percentage Applications', 'Reading & Interpreting Charts'],
};

const BLOOM_PROGRESSION = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

// Generate 30 lessons
let lessonNumber = 0;
const MOCK_LESSONS: any[] = [];

MOCK_GATES.forEach((gate, gi) => {
  const titles = LESSON_TITLES[gate.id];
  const count = GATE_LESSON_COUNTS[gi];

  for (let li = 0; li < count; li++) {
    lessonNumber++;
    const title = titles[li] || `${gate.short_title} Lesson ${li + 1}`;
    const progressInGate = li / (count - 1 || 1);
    const bloomIdx = Math.min(Math.floor(progressInGate * 3), 2);
    const blooms = BLOOM_PROGRESSION.slice(bloomIdx, bloomIdx + 2);

    MOCK_LESSONS.push({
      id: `lesson-${lessonNumber}`,
      gate_id: gate.id,
      course_id: 'course-001',
      lesson_number: lessonNumber,
      title,
      objective: `Students will ${blooms[0]} and ${blooms[1] || blooms[0]} key concepts of ${title.toLowerCase()}`,
      key_idea: `The foundational principle behind ${title.toLowerCase()} and how it connects to ${gate.short_title.toLowerCase()}`,
      conceptual_breakthrough: `Students discover the deep connection between ${title.toLowerCase()} and real-world applications`,
      bloom_levels: blooms,
      examples: [
        { text: `Real-world scenario demonstrating ${title.toLowerCase()}` },
        { text: `Visual model for understanding ${title.toLowerCase()}` },
        { text: `Story problem that introduces ${title.toLowerCase()} naturally` },
      ],
      exercises: [
        { text: `Practice problems on ${title.toLowerCase()} (increasing difficulty)` },
        { text: `Group activity: apply ${title.toLowerCase()} to a real scenario` },
      ],
      duration_minutes: 40,
      status: 'draft',
      sort_order: lessonNumber,
      teacher_notes: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      socratic_scripts: [
        { id: `ss-${lessonNumber}-1`, lesson_id: `lesson-${lessonNumber}`, stage_number: 1, stage_title: 'Hook', duration_minutes: 5, teacher_prompt: `What comes to mind when you hear "${title.toLowerCase()}"? Share any real-life connections.`, expected_response: 'Students share prior knowledge and everyday observations', follow_up: 'Interesting! Let\'s explore whether your intuitions are correct...', sort_order: 1, status: 'draft' },
        { id: `ss-${lessonNumber}-2`, lesson_id: `lesson-${lessonNumber}`, stage_number: 2, stage_title: 'Discovery', duration_minutes: 15, teacher_prompt: `Look at this problem. Before I show the method, how would YOU try to solve it? What strategy feels natural?`, expected_response: 'Students attempt to reason through the problem using what they already know', follow_up: 'Notice how your approach relates to the formal method we\'re about to learn', sort_order: 2, status: 'draft' },
        { id: `ss-${lessonNumber}-3`, lesson_id: `lesson-${lessonNumber}`, stage_number: 3, stage_title: 'Concept Build', duration_minutes: 12, teacher_prompt: `Now that we've seen the method, can you explain WHY it works? Not just HOW, but WHY.`, expected_response: 'Students attempt to articulate the underlying principle, not just the procedure', follow_up: 'That\'s the conceptual breakthrough — understanding the WHY makes you flexible with the HOW', sort_order: 3, status: 'draft' },
        { id: `ss-${lessonNumber}-4`, lesson_id: `lesson-${lessonNumber}`, stage_number: 4, stage_title: 'Application', duration_minutes: 8, teacher_prompt: `Create your own problem that uses ${title.toLowerCase()}. Make it tricky enough to challenge your partner!`, expected_response: 'Students design problems that test deep understanding', follow_up: 'Exchange and solve — if you can create a good problem, you truly understand the concept', sort_order: 4, status: 'draft' },
      ],
    });
  }
});

// Generate 10 questions per lesson (300 total)
const MOCK_QUESTIONS: any[] = [];

MOCK_LESSONS.forEach((lesson, li) => {
  const gate = MOCK_GATES.find(g => g.id === lesson.gate_id)!;
  const t = lesson.title;

  MOCK_QUESTIONS.push(
    { id: `q-${li}-1`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `What is the correct definition of ${t.toLowerCase()}?`, question_type: 'mcq', bloom_level: 'remember', difficulty: 1, options: [{ text: `The standard mathematical definition of ${t.toLowerCase()}`, is_correct: true }, { text: 'A definition from a different topic', is_correct: false }, { text: 'A common but incorrect understanding', is_correct: false }, { text: 'None of the above', is_correct: false }], correct_answer: `The standard definition`, rubric: 'Must identify the accurate definition', distractors: [{ answer: 'Common misconception', misconception: 'Confuses with a related concept' }], status: 'draft', is_diagnostic: true, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-2`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `Which example best demonstrates ${t.toLowerCase()} in real life?`, question_type: 'mcq', bloom_level: 'understand', difficulty: 2, options: [{ text: `Using ${t.toLowerCase()} at a shop`, is_correct: true }, { text: 'Reading a storybook', is_correct: false }, { text: 'Playing a sport', is_correct: false }, { text: 'Drawing a picture', is_correct: false }], correct_answer: `Using ${t.toLowerCase()} at a shop`, rubric: 'Must connect concept to real-world application', distractors: [{ answer: 'Sport', misconception: 'Thinks any activity involves this concept' }], status: 'draft', is_diagnostic: true, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-3`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `Solve: Apply the concept of ${t.toLowerCase()} to find the answer when given the values 48 and 6.`, question_type: 'mcq', bloom_level: 'apply', difficulty: 3, options: [{ text: '8', is_correct: true }, { text: '42', is_correct: false }, { text: '54', is_correct: false }, { text: '288', is_correct: false }], correct_answer: '8', rubric: 'Must apply the correct operation', distractors: [{ answer: '42', misconception: 'Subtracted instead of dividing' }], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-4`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `True or False: ${t} has no practical application outside the classroom.`, question_type: 'true_false', bloom_level: 'remember', difficulty: 1, options: [{ text: 'True', is_correct: false }, { text: 'False', is_correct: true }], correct_answer: 'False — widely used in daily life', rubric: 'Should recognize real-world relevance', distractors: [], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-5`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `True or False: Mastering ${t.toLowerCase()} is essential before learning the next topic.`, question_type: 'true_false', bloom_level: 'understand', difficulty: 2, options: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }], correct_answer: 'True — prerequisite for later concepts', rubric: 'Should understand dependency', distractors: [], status: 'draft', is_diagnostic: true, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-6`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `A student has 360 items to organize using ${t.toLowerCase()}. Show your working and explain your approach.`, question_type: 'short_answer', bloom_level: 'apply', difficulty: 3, correct_answer: 'Student should show step-by-step working with the correct method', rubric: 'Must show working AND explain reasoning', distractors: [{ answer: 'Just writing the answer', misconception: 'Procedural without understanding' }], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-7`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `Compare two different methods for solving a ${t.toLowerCase()} problem. Which is more efficient and why?`, question_type: 'short_answer', bloom_level: 'analyze', difficulty: 4, correct_answer: 'Compare methods, identify trade-offs, justify choice', rubric: 'Must compare 2+ methods with reasoning', distractors: [], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-8`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `Explain why ${t.toLowerCase()} matters in mathematics. Give at least two real-world examples.`, question_type: 'open_ended', bloom_level: 'understand', difficulty: 2, rubric: 'Conceptual understanding with original, relevant examples', distractors: [], status: 'draft', is_diagnostic: true, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-9`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `A classmate says "${t} is the hardest topic." Do you agree? Justify with 3 reasons.`, question_type: 'open_ended', bloom_level: 'evaluate', difficulty: 5, rubric: 'Clear position, 3+ arguments, considers counterarguments', distractors: [], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
    { id: `q-${li}-10`, gate_id: gate.id, lesson_id: lesson.id, course_id: 'course-001', question_text: `Design a real-world challenge that requires ${t.toLowerCase()}. Write the problem, solution, and explain what makes it tricky.`, question_type: 'open_ended', bloom_level: 'create', difficulty: 5, rubric: 'Original problem, correct solution, identifies cognitive challenge', distractors: [], status: 'draft', is_diagnostic: false, created_at: '2026-01-01T00:00:00Z' },
  );
});

// Session analytics mock data
const CURRENT_SESSION = 18;

function getSessionAnalytics() {
  const sessions = MOCK_LESSONS.map((lesson, i) => {
    const sessionNum = i + 1;
    const gate = MOCK_GATES.find(g => g.id === lesson.gate_id)!;
    let status: string, avgScore: number, attempted: number, passed: number;

    if (sessionNum < CURRENT_SESSION) {
      status = 'completed';
      // Scores improve gradually over the course
      const baseScore = 65 + (sessionNum / 30) * 20 + (Math.random() * 10 - 5);
      avgScore = Math.round(Math.min(95, Math.max(50, baseScore)));
      attempted = 8;
      passed = avgScore >= 60 ? Math.round(6 + Math.random() * 2) : Math.round(3 + Math.random() * 3);
    } else if (sessionNum === CURRENT_SESSION) {
      status = 'in_progress';
      avgScore = 0;
      attempted = Math.round(3 + Math.random() * 3);
      passed = 0;
    } else {
      status = 'upcoming';
      avgScore = 0;
      attempted = 0;
      passed = 0;
    }

    // Per-student scores for completed sessions
    const studentScores = status === 'completed' ? MOCK_STUDENTS.map((s, si) => {
      const baseStudentScore = [85, 78, 68, 92, 60, 55, 82, 65][si];
      const variation = Math.round(Math.random() * 15 - 7);
      const sessionBonus = Math.round(sessionNum * 0.5);
      return {
        student_id: s.id,
        student_name: s.full_name,
        score: Math.min(100, Math.max(20, baseStudentScore + variation + sessionBonus)),
        completed: true,
      };
    }) : [];

    return {
      session_number: sessionNum,
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      gate_id: gate.id,
      gate_number: gate.gate_number,
      gate_color: gate.color,
      gate_short_title: gate.short_title,
      status,
      avg_quiz_score: avgScore,
      students_attempted: attempted,
      students_passed: passed,
      student_scores: studentScores,
    };
  });

  // Gate status based on session completion
  let cumulativeSessionStart = 0;
  const gatesStatus = MOCK_GATES.map((gate, gi) => {
    const sessionsInGate = GATE_LESSON_COUNTS[gi];
    const startSession = cumulativeSessionStart + 1;
    const endSession = cumulativeSessionStart + sessionsInGate;
    cumulativeSessionStart += sessionsInGate;

    const completedSessions = sessions.filter(s => s.gate_id === gate.id && s.status === 'completed').length;
    const inProgressSessions = sessions.filter(s => s.gate_id === gate.id && s.status === 'in_progress').length;

    // Check prerequisites
    const prereqs = GATE_EDGES.filter(e => e.gate_id === gate.id);
    const prereqsMet = prereqs.every(e => {
      const prereqGate = MOCK_GATES.find(g => g.id === e.prerequisite_gate_id);
      if (!prereqGate) return true;
      const prereqGi = MOCK_GATES.indexOf(prereqGate);
      const prereqSessions = GATE_LESSON_COUNTS[prereqGi];
      const prereqCompleted = sessions.filter(s => s.gate_id === prereqGate.id && s.status === 'completed').length;
      return prereqCompleted >= prereqSessions;
    });

    let status: string;
    if (completedSessions >= sessionsInGate) {
      status = 'completed';
    } else if (inProgressSessions > 0 || completedSessions > 0) {
      status = 'in_progress';
    } else if (prereqsMet) {
      status = 'unlocked';
    } else {
      status = 'locked';
    }

    return {
      gate_id: gate.id,
      gate_number: gate.gate_number,
      short_title: gate.short_title,
      title: gate.title,
      color: gate.color,
      light_color: gate.light_color,
      status,
      sessions_in_gate: sessionsInGate,
      completed_sessions: completedSessions,
      start_session: startSession,
      end_session: endSession,
    };
  });

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const totalQuizzesCompleted = completedCount * 8; // 8 students per completed session
  const totalQuizzesPossible = 30 * 8;
  const avgMastery = Math.round(sessions.filter(s => s.status === 'completed').reduce((a, s) => a + s.avg_quiz_score, 0) / (completedCount || 1));

  return {
    current_session: CURRENT_SESSION,
    total_sessions: 30,
    completed_sessions: completedCount,
    sessions,
    gates_status: gatesStatus,
    course_stats: {
      overall_completion_pct: Math.round((completedCount / 30) * 100),
      avg_mastery: avgMastery,
      total_quizzes_completed: totalQuizzesCompleted,
      total_quizzes_possible: totalQuizzesPossible,
      students_on_track: 5,
      students_at_risk: 3,
    },
  };
}

// Multiple courses
const ALL_COURSES = [
  { ...MOCK_COURSE, id: 'course-001', title: 'Class 5 Mathematics', subject: 'Mathematics', class_level: '5', status: 'active', total_sessions: 30, session_duration_minutes: 40, syllabus_text: 'Chapter 1: Large Numbers and Place Value\nChapter 2: Factors, HCF and LCM\nChapter 3: Fractions\nChapter 4: Decimals and Measurement\nChapter 5: Geometry and Mensuration\nChapter 6: Percentage and Data Handling' },
  { ...MOCK_COURSE, id: 'course-002', title: 'Class 9 Economic Applications', subject: 'Economics', class_level: '9', status: 'review', section: 'A' },
  { ...MOCK_COURSE, id: 'course-003', title: 'Class 6 Science', subject: 'Science', class_level: '6', status: 'draft', section: 'C' },
];

const createdCourses: typeof ALL_COURSES = [];

function findCourse(id: string) {
  return ALL_COURSES.find(c => c.id === id) || createdCourses.find(c => c.id === id);
}

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'demo' }));

// Auth
app.post('/api/v1/auth/signup', (req, res) => {
  const { full_name, role, email } = req.body;
  currentUser = { ...MOCK_TEACHER, full_name: full_name || 'Demo User', role: role || 'teacher', email: email || 'demo@lmgc.edu' };
  res.status(201).json({ user: { id: currentUser.id }, session: { access_token: 'demo-token' } });
});
app.post('/api/v1/auth/login', (_req, res) => res.json({ user: { id: currentUser.id }, session: { access_token: 'demo-token' } }));
app.get('/api/v1/auth/me', (_req, res) => res.json({ profile: currentUser }));
app.put('/api/v1/auth/me', (req, res) => {
  if (req.body.role) currentUser = { ...currentUser, role: req.body.role };
  if (req.body.full_name) currentUser = { ...currentUser, full_name: req.body.full_name };
  res.json({ profile: currentUser });
});

// Courses
app.get('/api/v1/courses', (_req, res) => res.json({ courses: [...ALL_COURSES, ...createdCourses] }));
app.post('/api/v1/courses', (req, res) => {
  const nc = { ...MOCK_COURSE, ...req.body, id: 'course-new-' + Date.now(), status: 'draft' as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  createdCourses.push(nc);
  res.status(201).json({ course: nc });
});
app.get('/api/v1/courses/:id', (req, res) => res.json({ course: findCourse(req.params.id) || MOCK_COURSE }));
app.put('/api/v1/courses/:id', (req, res) => {
  const c = findCourse(req.params.id);
  if (c) Object.assign(c, req.body);
  res.json({ course: c || MOCK_COURSE });
});
app.post('/api/v1/courses/:id/syllabus', (req, res) => {
  const c = findCourse(req.params.id);
  if (c) {
    c.syllabus_text = req.body.syllabus_text;
    if (req.body.llm_provider) c.llm_provider = req.body.llm_provider;
    if (req.body.total_sessions) (c as any).total_sessions = req.body.total_sessions;
    if (req.body.session_duration_minutes) (c as any).session_duration_minutes = req.body.session_duration_minutes;
  }
  res.json({ course: c || MOCK_COURSE });
});
app.post('/api/v1/courses/:id/syllabus/upload', (req, res) => {
  const c = findCourse(req.params.id);
  const mockText = 'Chapter 1: Large Numbers and Place Value\n- Place value up to 9 digits\n- Indian and International number systems\n\nChapter 2: Factors, HCF and LCM\n- Prime factorisation\n- HCF and LCM methods\n\nChapter 3: Fractions\n- All operations\n- Word problems\n\nChapter 4: Decimals and Measurement\n\nChapter 5: Geometry and Mensuration\n\nChapter 6: Percentage and Data Handling';
  if (c) c.syllabus_text = mockText;
  res.json({ course: c || MOCK_COURSE, extracted_text: mockText, filename: req.body.filename || 'syllabus.pdf' });
});

// SSE Processing
app.post('/api/v1/courses/:id/process', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const steps = ['Extract Core Concepts', 'Build Knowledge Graph', 'Define Critical Gates', "Bloom's Taxonomy Mapping", 'Reorder to Cognitive Sequence', 'Lesson Architecture', 'Socratic Teaching Scripts', 'Diagnostic Questions', 'Visual Master Map', 'Learning Outcomes'];
  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      res.write(`data: ${JSON.stringify({ type: 'step', step: i + 1, name: steps[i], status: 'complete' })}\n\n`);
      i++;
    } else {
      const c = findCourse(req.params.id);
      if (c) c.status = 'review' as any;
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 800);
});

app.post('/api/v1/courses/:id/finalize', (req, res) => {
  const c = findCourse(req.params.id);
  if (c) c.status = 'active' as any;
  res.json({ course: c || { ...MOCK_COURSE, status: 'active' } });
});
app.post('/api/v1/courses/:id/enroll', (req, res) => res.json({ enrolled: [], found: 0, requested: req.body.student_emails?.length || 0 }));

// KG
app.get('/api/v1/courses/:courseId/kg', (_req, res) => res.json({ course_id: 'course-001', gates: MOCK_GATES, edges: GATE_EDGES }));
app.get('/api/v1/courses/:courseId/kg/gates', (_req, res) => {
  const gatesWithPrereqs = MOCK_GATES.map(g => {
    const prereqs = GATE_EDGES.filter(e => e.gate_id === g.id).map(e => {
      const pg = MOCK_GATES.find(x => x.id === e.prerequisite_gate_id);
      return pg ? { gate_id: pg.id, gate_number: pg.gate_number, short_title: pg.short_title, reason: e.reason } : null;
    }).filter(Boolean);
    const dependents = GATE_EDGES.filter(e => e.prerequisite_gate_id === g.id).map(e => {
      const dg = MOCK_GATES.find(x => x.id === e.gate_id);
      return dg ? { gate_id: dg.id, gate_number: dg.gate_number, short_title: dg.short_title } : null;
    }).filter(Boolean);
    return { ...g, prerequisites: prereqs, dependents };
  });
  res.json({ gates: gatesWithPrereqs, edges: GATE_EDGES });
});
app.get('/api/v1/courses/:courseId/kg/gates/:gateId', (req, res) => res.json({ gate: MOCK_GATES.find(g => g.id === req.params.gateId) || MOCK_GATES[0] }));
app.put('/api/v1/courses/:courseId/kg/gates/:gateId', (req, res) => {
  const g = MOCK_GATES.find(g => g.id === req.params.gateId);
  if (g) Object.assign(g, req.body);
  res.json({ gate: g });
});
app.put('/api/v1/courses/:courseId/kg/gates/:gateId/status', (req, res) => {
  const g = MOCK_GATES.find(g => g.id === req.params.gateId);
  if (g) (g as any).status = req.body.status;
  res.json({ gate: g });
});

// Lessons
app.get('/api/v1/courses/:courseId/lessons', (_req, res) => res.json({ lessons: MOCK_LESSONS }));
app.get('/api/v1/courses/:courseId/lessons/:id', (req, res) => {
  const lesson = MOCK_LESSONS.find((l: any) => l.id === req.params.id);
  if (!lesson) return res.json({ lesson: MOCK_LESSONS[0], questions: MOCK_QUESTIONS.filter((q: any) => q.lesson_id === MOCK_LESSONS[0].id), gate: MOCK_GATES[0] });
  const questions = MOCK_QUESTIONS.filter((q: any) => q.lesson_id === lesson.id);
  const gate = MOCK_GATES.find(g => g.id === lesson.gate_id);
  res.json({ lesson, questions, gate });
});
app.put('/api/v1/courses/:courseId/lessons/:id', (req, res) => {
  const l = MOCK_LESSONS.find((l: any) => l.id === req.params.id);
  if (l) Object.assign(l, req.body);
  res.json({ lesson: l });
});
app.put('/api/v1/courses/:courseId/lessons/:id/status', (req, res) => {
  const l = MOCK_LESSONS.find((l: any) => l.id === req.params.id);
  if (l) (l as any).status = req.body.status;
  res.json({ lesson: l || { id: req.params.id, status: req.body.status } });
});

// Questions
app.get('/api/v1/courses/:courseId/questions', (_req, res) => res.json({ questions: MOCK_QUESTIONS }));
app.put('/api/v1/courses/:courseId/questions/:id', (req, res) => {
  const q = MOCK_QUESTIONS.find((q: any) => q.id === req.params.id);
  if (q) Object.assign(q, req.body);
  res.json({ question: q });
});
app.put('/api/v1/courses/:courseId/questions/:id/status', (req, res) => {
  const q = MOCK_QUESTIONS.find((q: any) => q.id === req.params.id);
  if (q) (q as any).status = req.body.status;
  res.json({ question: q || { id: req.params.id, status: req.body.status } });
});

// Timetable — 1:1 session-to-lesson mapping
app.get('/api/v1/courses/:courseId/timetable', (req, res) => {
  const course = findCourse(req.params.courseId);
  const sessions = MOCK_LESSONS.map((lesson: any, i: number) => {
    const gate = MOCK_GATES.find(g => g.id === lesson.gate_id);
    const questions = MOCK_QUESTIONS.filter((q: any) => q.lesson_id === lesson.id);
    return {
      id: `session-${i + 1}`,
      course_id: req.params.courseId,
      session_number: i + 1,
      lesson_id: lesson.id,
      lesson_portion: 'full',
      topic_summary: `${lesson.title}: ${lesson.objective}`,
      quiz_included: true,
      lesson,
      gate,
      questions,
    };
  });
  res.json({ sessions, total_sessions: (course as any)?.total_sessions || 30, session_duration_minutes: (course as any)?.session_duration_minutes || 40 });
});

// Session Analytics
app.get('/api/v1/courses/:courseId/analytics/sessions', (_req, res) => {
  res.json(getSessionAnalytics());
});

// Student progress
app.get('/api/v1/students/:studentId/progress', (req, res) => {
  const idx = MOCK_STUDENTS.findIndex(s => s.id === req.params.studentId);
  res.json({ progress: getMockProgress(idx >= 0 ? idx : 1), learning_profile: MOCK_LEARNING_PROFILE });
});

// Analytics
app.get('/api/v1/courses/:courseId/analytics/heatmap', (_req, res) => {
  const students = MOCK_STUDENTS.map((s, si) => {
    const scores = getMockProgress(si);
    const gateScores = scores.map(p => ({ gate_id: p.gate_id, gate_number: MOCK_GATES.findIndex(g => g.id === p.gate_id) + 1, mastery_pct: p.mastery_pct }));
    const nonZero = gateScores.filter(g => g.mastery_pct > 0);
    return { id: s.id, name: s.full_name, gate_scores: gateScores, average: nonZero.length > 0 ? Math.round(nonZero.reduce((a, g) => a + g.mastery_pct, 0) / nonZero.length) : 0 };
  });
  const gates = MOCK_GATES.map(g => {
    const scores = MOCK_STUDENTS.map((_, si) => getMockProgress(si).find(p => p.gate_id === g.id)?.mastery_pct || 0);
    const nonZero = scores.filter(s => s > 0);
    return { id: g.id, gate_number: g.gate_number, title: g.title, short_title: g.short_title, color: g.color, avg: nonZero.length > 0 ? Math.round(nonZero.reduce((a, s) => a + s, 0) / nonZero.length) : 0 };
  });
  res.json({ students, gates });
});
app.get('/api/v1/courses/:courseId/analytics/bloom-dist/:gateId', (req, res) => {
  const gateId = req.params.gateId;
  const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const distribution = levels.map(level => {
    const count = MOCK_STUDENTS.filter((_, si) => {
      const prog = getMockProgress(si).find(p => p.gate_id === gateId);
      return prog && (prog.bloom_scores as Record<string, number>)[level] >= 50;
    }).length;
    return { level, pct: Math.round((count / MOCK_STUDENTS.length) * 100) };
  });
  let maxDrop = 0, dropIdx = 0;
  for (let i = 1; i < distribution.length; i++) { const d = distribution[i - 1].pct - distribution[i].pct; if (d > maxDrop) { maxDrop = d; dropIdx = i; } }
  const gap = maxDrop > 0 ? `${distribution[dropIdx - 1].pct}% ${distribution[dropIdx - 1].level} but only ${distribution[dropIdx].pct}% ${distribution[dropIdx].level}. Focus next lesson on bridging this gap.` : 'Bloom distribution is even across all levels.';
  res.json({ gate_id: gateId, levels: distribution, gap_analysis: gap });
});
app.get('/api/v1/courses/:courseId/analytics/dependency-risk', (_req, res) => {
  res.json({ risks: [
    { from_gate: { id: 'gate-2', number: 2, title: 'HCF / LCM' }, to_gate: { id: 'gate-3', number: 3, title: 'Fractions' }, affected_students: [{ id: 'student-005', name: 'Aryan S.', from_mastery: 65, to_mastery: 48 }, { id: 'student-006', name: 'Meera T.', from_mastery: 60, to_mastery: 40 }, { id: 'student-008', name: 'Anaya D.', from_mastery: 72, to_mastery: 58 }], severity: 'critical', reason: 'HCF/LCM weakness cascading to Fractions' },
    { from_gate: { id: 'gate-3', number: 3, title: 'Fractions' }, to_gate: { id: 'gate-4', number: 4, title: 'Decimals' }, affected_students: [{ id: 'student-003', name: 'Kabir R.', from_mastery: 60, to_mastery: 45 }, { id: 'student-001', name: 'Aarav M.', from_mastery: 72, to_mastery: 60 }], severity: 'high', reason: 'Fractions weakness cascading to Decimals' },
    { from_gate: { id: 'gate-1', number: 1, title: 'Numbers' }, to_gate: { id: 'gate-5', number: 5, title: 'Geometry' }, affected_students: [{ id: 'student-006', name: 'Meera T.', from_mastery: 82, to_mastery: 55 }], severity: 'low', reason: 'Numbers to Geometry (calculation errors)' },
  ]});
});
app.get('/api/v1/courses/:courseId/analytics/attention', (_req, res) => {
  const atRisk = MOCK_STUDENTS.map((s, si) => {
    const prog = getMockProgress(si);
    const risky = prog.filter(p => p.mastery_pct > 0 && p.mastery_pct < 60);
    if (risky.length === 0) return null;
    return { id: s.id, name: s.full_name, at_risk_gates: risky.map(p => ({ gate_number: MOCK_GATES.findIndex(g => g.id === p.gate_id) + 1, short_title: MOCK_GATES.find(g => g.id === p.gate_id)?.short_title || '', mastery_pct: p.mastery_pct })) };
  }).filter(Boolean);
  res.json({ students: atRisk });
});

// Suggestions
app.get('/api/v1/courses/:courseId/suggestions', (_req, res) => res.json({ suggestions }));
app.put('/api/v1/courses/:courseId/suggestions/:id', (req, res) => {
  const idx = suggestions.findIndex(s => s.id === req.params.id);
  if (idx >= 0) { suggestions[idx] = { ...suggestions[idx], ...req.body, resolved_at: new Date().toISOString() }; res.json({ suggestion: suggestions[idx] }); }
  else res.status(404).json({ error: 'Not found' });
});

// Adaptive AI Suggestions — based on student performance
const adaptiveSuggestions = [
  {
    id: 'adapt-1', type: 'topic_shift', priority: 'high', affects_sessions: [19],
    title: 'Revisit Equivalent Fractions before Dividing Fractions',
    reason: '5 of 8 students scored below 60% on Equivalent Fractions quiz (Session 15). Dividing Fractions requires this as a prerequisite — proceeding now will compound gaps.',
    affected_students: ['Aryan S.', 'Meera T.', 'Anaya D.', 'Kabir R.', 'Priya S.'],
    current: { session: 19, title: 'Dividing Fractions', objective: 'Apply division of fractions to solve problems', bloom_levels: ['apply', 'analyze'] },
    proposed: { session: 19, title: 'Equivalent Fractions — Deep Practice', objective: 'Master equivalent fractions through visual models and real-world applications', bloom_levels: ['understand', 'apply'],
      key_changes: ['Topic shifted from Dividing to Equivalent Fractions review', 'Bloom target lowered to ensure foundation is solid', 'Added visual fraction bar models to examples', 'Quiz refocused on Apply-level equivalent fraction problems'] },
    status: 'pending', teacher_notes: null,
  },
  {
    id: 'adapt-2', type: 'socratic_update', priority: 'medium', affects_sessions: [19],
    title: 'Add misconception-busting Discovery stage',
    reason: 'Quiz analysis shows 4 students believe 2/4 > 1/2. This misconception will cascade into Decimals (Gate 4) if not addressed now.',
    affected_students: ['Aryan S.', 'Meera T.', 'Kabir R.', 'Anaya D.'],
    current: { stage_count: 4, stages: ['Hook', 'Discovery', 'Concept Build', 'Application'] },
    proposed: { stage_count: 5, stages: ['Hook', 'Misconception Check', 'Discovery', 'Concept Build', 'Application'],
      new_stage: { title: 'Misconception Check', duration_minutes: 8, teacher_prompt: 'Is 2/4 greater than, less than, or equal to 1/2? Prove your answer using a drawing.', expected_response: 'Students draw fraction bars and discover they are equal' } },
    status: 'pending', teacher_notes: null,
  },
  {
    id: 'adapt-3', type: 'quiz_adjust', priority: 'medium', affects_sessions: [19, 20],
    title: 'Replace Remember-level questions with Apply-level',
    reason: '85% of students can recall fraction definitions but only 40% can apply them in word problems. Quiz difficulty needs to shift upward.',
    affected_students: [],
    current: { remember_pct: 30, understand_pct: 30, apply_pct: 20, analyze_pct: 20 },
    proposed: { remember_pct: 10, understand_pct: 20, apply_pct: 40, analyze_pct: 30, changes: 'Replace 2 MCQ Remember questions with 2 Short Answer Apply questions. Add 1 Analyze-level open-ended question.' },
    status: 'pending', teacher_notes: null,
  },
  {
    id: 'adapt-4', type: 'add_remediation', priority: 'high', affects_sessions: [19],
    title: '15-min HCF remediation for at-risk students',
    reason: 'Aryan (48%), Meera (40%), and Anaya (58%) are below mastery threshold on Gate 2 (HCF/LCM). This prerequisite weakness is cascading into Fractions performance.',
    affected_students: ['Aryan S.', 'Meera T.', 'Anaya D.'],
    current: null,
    proposed: { remediation_type: 'targeted', duration_minutes: 15, focus: 'HCF by division method — visual walkthrough with manipulatives', placement: 'Start of Session 19',
      key_changes: ['Insert 15-min targeted remediation before main lesson', 'Use fraction bars and visual aids', 'Focus on 3 specific at-risk students while others do independent practice'] },
    status: 'pending', teacher_notes: null,
  },
  {
    id: 'adapt-5', type: 'peer_teaching', priority: 'low', affects_sessions: [19, 20],
    title: 'Pair top performers with at-risk students',
    reason: 'Research shows peer teaching benefits both mentor and mentee. Sia (92%) and Rohan (82%) can solidify their understanding by teaching others.',
    affected_students: ['Sia P.', 'Rohan K.', 'Aryan S.', 'Meera T.'],
    current: null,
    proposed: { pairs: [{ mentor: 'Sia P.', mentor_score: '92%', mentee: 'Aryan S.', mentee_score: '48%', focus: 'Equivalent Fractions' }, { mentor: 'Rohan K.', mentor_score: '82%', mentee: 'Meera T.', mentee_score: '40%', focus: 'HCF basics' }],
      key_changes: ['Assign peer teaching pairs during group exercise time', 'Mentors explain concepts in their own words', 'Monitor pairs — if mentee improves, extend arrangement'] },
    status: 'pending', teacher_notes: null,
  },
  {
    id: 'adapt-6', type: 'pace_change', priority: 'low', affects_sessions: [19, 20, 21],
    title: 'Consider extending Gate 3 by 1 session',
    reason: 'Class average on Gate 3 dropped from 72% to 58% over the last 2 sessions. Current pace may leave 4 students below mastery threshold when Gate 4 begins.',
    affected_students: ['Aryan S.', 'Meera T.', 'Anaya D.', 'Kabir R.'],
    current: { gate_3_sessions: 6, remaining: 2 },
    proposed: { gate_3_sessions: 7, remaining: 3, key_changes: ['Add 1 extra session for Gate 3 review and practice', 'Shift Sessions 20-30 forward by 1', 'Remove 1 review session from end of course to accommodate'] },
    status: 'pending', teacher_notes: null,
  },
];

const adaptiveHistory = [
  { id: 'hist-1', type: 'bloom_focus', title: 'Shifted Session 16 to target Apply level', status: 'accepted', resolved_at: '2026-03-17T10:00:00Z', outcome: 'Class Apply-level scores improved by 15% in Session 17 quiz' },
  { id: 'hist-2', type: 'topic_shift', title: 'Added extra practice on Prime Factorisation', status: 'accepted', resolved_at: '2026-03-15T09:00:00Z', outcome: 'Gate 2 mastery improved from 62% to 75% over 2 sessions' },
  { id: 'hist-3', type: 'peer_teaching', title: 'Paired Sia with Priya for Numbers gate', status: 'accepted', resolved_at: '2026-03-12T11:00:00Z', outcome: 'Priya\'s Gate 1 mastery jumped from 71% to 92%' },
];

app.get('/api/v1/courses/:courseId/suggestions/adaptive', (_req, res) => {
  res.json({
    analysis_based_on: `Session ${CURRENT_SESSION - 1} results`,
    generated_at: '2026-03-19T14:00:00Z',
    current_session: CURRENT_SESSION,
    suggestions: adaptiveSuggestions,
    history: adaptiveHistory,
  });
});

app.put('/api/v1/courses/:courseId/suggestions/adaptive/:id', (req, res) => {
  const s = adaptiveSuggestions.find(s => s.id === req.params.id);
  if (s) {
    s.status = req.body.status || s.status;
    if (req.body.teacher_notes !== undefined) s.teacher_notes = req.body.teacher_notes;
    res.json({ suggestion: s });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/v1/courses/:courseId/suggestions/apply-all', (_req, res) => {
  const accepted = adaptiveSuggestions.filter(s => s.status === 'accepted');
  accepted.forEach(s => { s.status = 'applied' as any; });
  res.json({ applied: accepted.length, message: `${accepted.length} suggestions applied. Timetable updated for Sessions 19-30.` });
});

// Student management
const courseStudents: Record<string, any[]> = {
  'course-001': MOCK_STUDENTS.map((s, i) => ({
    id: s.id, full_name: s.full_name, email: s.email, roll_number: String(i + 1).padStart(2, '0'),
    class_section: s.class_section, phone: `98765432${10 + i}`, parent_name: `Parent of ${s.full_name}`, parent_phone: `98765433${10 + i}`,
  })),
};

app.get('/api/v1/courses/:courseId/students', (req, res) => {
  res.json({ students: courseStudents[req.params.courseId] || [] });
});

app.post('/api/v1/courses/:courseId/students', (req, res) => {
  const { full_name, email, roll_number, phone, parent_name, parent_phone } = req.body;
  const student = { id: `student-new-${Date.now()}`, full_name, email, roll_number, class_section: '5B', phone, parent_name, parent_phone };
  if (!courseStudents[req.params.courseId]) courseStudents[req.params.courseId] = [];
  courseStudents[req.params.courseId].push(student);
  res.json({ student });
});

app.post('/api/v1/courses/:courseId/students/upload', (req, res) => {
  const rows = req.body.students || [];
  const newStudents = rows.map((r: any, i: number) => ({
    id: `student-csv-${Date.now()}-${i}`, full_name: r.name || r.full_name || '', email: r.email || '',
    roll_number: r.roll_number || '', class_section: `${r.class || '5'}${r.section || 'B'}`,
    phone: r.phone || '', parent_name: r.parent_name || '', parent_phone: r.parent_phone || '',
  }));
  if (!courseStudents[req.params.courseId]) courseStudents[req.params.courseId] = [];
  courseStudents[req.params.courseId].push(...newStudents);
  res.json({ students: newStudents, count: newStudents.length });
});

// Answer sheet grading (mock AI)
app.post('/api/v1/courses/:courseId/lessons/:lessonId/grade', (req, res) => {
  const students = courseStudents[req.params.courseId] || MOCK_STUDENTS.map((s, i) => ({
    id: s.id, full_name: s.full_name, roll_number: String(i + 1).padStart(2, '0'),
  }));
  const lessonQuestions = MOCK_QUESTIONS.filter((q: any) => q.lesson_id === req.params.lessonId);
  const marksPerType: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

  const grades = students.map((s: any) => {
    const answers = lessonQuestions.map((q: any, qi: number) => {
      const maxScore = marksPerType[q.question_type] || 2;
      const isCorrect = Math.random() > 0.3;
      const score = isCorrect ? maxScore : (q.question_type === 'short_answer' || q.question_type === 'open_ended' ? Math.floor(Math.random() * maxScore) : 0);
      return {
        question_id: q.id, question_num: qi + 1,
        answer: isCorrect ? (q.correct_answer || 'Correct answer') : 'Student answer',
        is_correct: isCorrect, score, max_score: maxScore,
        ai_feedback: !isCorrect && (q.question_type === 'short_answer' || q.question_type === 'open_ended') ? 'Partial understanding shown but missing key concept' : undefined,
      };
    });
    return {
      student_id: s.id, student_name: s.full_name, roll_number: s.roll_number || '—',
      answers, total_score: answers.reduce((a: number, ans: any) => a + ans.score, 0),
      max_score: answers.reduce((a: number, ans: any) => a + ans.max_score, 0), status: 'graded' as const,
    };
  });

  res.json({ grades });
});

app.get('/api/v1/courses/:courseId/lessons/:lessonId/grades', (_req, res) => {
  res.json({ grades: [] });
});

app.listen(3001, () => {
  console.log('');
  console.log('  LEAP Platform — Demo Mode');
  console.log('  API:      http://localhost:3001');
  console.log('  Frontend: http://localhost:5180');
  console.log(`  ${ALL_COURSES.length} courses | ${MOCK_GATES.length} gates | ${MOCK_LESSONS.length} lessons | ${MOCK_QUESTIONS.length} questions`);
  console.log('');
});
