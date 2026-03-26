import type { SupabaseClient } from '@supabase/supabase-js';
import { GATE_COLORS } from '@leap/shared';

// ─── Course Data ─────────────────────────────────────────────

const CS101_GATES = [
  { number: 1, title: 'Programming Fundamentals', short: 'Prog Basics', subs: ['Variables & Data Types', 'Operators & Expressions', 'Control Flow (if/else/loops)', 'Input/Output'], blooms: ['remember', 'understand'] },
  { number: 2, title: 'Functions & Recursion', short: 'Functions', subs: ['Function Definition & Scope', 'Parameters & Return Values', 'Recursion & Base Cases', 'Higher-Order Functions'], blooms: ['understand', 'apply'] },
  { number: 3, title: 'Data Structures Basics', short: 'Data Structures', subs: ['Arrays & Lists', 'Dictionaries & Hash Maps', 'Stacks & Queues', 'Trees & Graphs Intro'], blooms: ['apply', 'analyze'] },
  { number: 4, title: 'Object-Oriented Programming', short: 'OOP', subs: ['Classes & Objects', 'Inheritance & Polymorphism', 'Encapsulation & Abstraction', 'Design Patterns Intro'], blooms: ['apply', 'analyze'] },
];

const MATH201_GATES = [
  { number: 1, title: 'Vectors & Matrices', short: 'Vectors', subs: ['Vector Spaces', 'Matrix Operations', 'Determinants', 'Systems of Linear Equations'], blooms: ['remember', 'understand'] },
  { number: 2, title: 'Linear Transformations', short: 'Transforms', subs: ['Linear Maps', 'Eigenvalues & Eigenvectors', 'Diagonalization', 'SVD Intro'], blooms: ['apply', 'analyze'] },
  { number: 3, title: 'Probability Foundations', short: 'Probability', subs: ['Probability Axioms', 'Bayes Theorem', 'Random Variables', 'Common Distributions'], blooms: ['understand', 'apply'] },
  { number: 4, title: 'Statistical Inference', short: 'Statistics', subs: ['Hypothesis Testing', 'Confidence Intervals', 'Regression Analysis', 'Maximum Likelihood'], blooms: ['analyze', 'evaluate'] },
];

const CS301_GATES = [
  { number: 1, title: 'ML Foundations', short: 'ML Basics', subs: ['Supervised vs Unsupervised', 'Bias-Variance Tradeoff', 'Model Evaluation Metrics', 'Train/Test/Validate Split'], blooms: ['understand', 'apply'] },
  { number: 2, title: 'Regression & Classification', short: 'Regression', subs: ['Linear Regression', 'Logistic Regression', 'SVMs', 'Gradient Descent'], blooms: ['apply', 'analyze'] },
  { number: 3, title: 'Neural Networks', short: 'Neural Nets', subs: ['Perceptrons', 'Backpropagation', 'Activation Functions', 'CNNs Intro'], blooms: ['analyze', 'evaluate'] },
  { number: 4, title: 'ML Systems & Projects', short: 'ML Systems', subs: ['Feature Engineering', 'Hyperparameter Tuning', 'Model Deployment', 'End-to-End Pipeline'], blooms: ['evaluate', 'create'] },
];

const STUDENT_NAMES = ['Aditya R.', 'Sneha K.', 'Rahul V.', 'Priyanka M.', 'Vikram S.', 'Neha T.'];

// Scores: [CS101 G1-4, MATH201 G1-4, CS301 G1-4]
const STUDENT_SCORES = [
  [88, 82, 75, 70, 85, 78, 72, 65, 80, 72, 60, 55], // Aditya: solid across
  [92, 88, 80, 78, 70, 58, 50, 40, 68, 55, 35, 20], // Sneha: strong CS, weak math → blocked in ML
  [78, 70, 60, 52, 90, 85, 82, 78, 75, 70, 65, 58], // Rahul: strong math, weaker CS
  [95, 90, 88, 85, 92, 88, 85, 80, 90, 85, 80, 75], // Priyanka: top performer
  [65, 55, 40, 30, 60, 48, 35, 20, 45, 30, 0, 0],   // Vikram: struggling everywhere
  [82, 75, 68, 60, 78, 72, 65, 55, 70, 62, 50, 42], // Neha: steady middle
];

// ─── Seeder Function ─────────────────────────────────────────

export async function seedCollegeDemoCourses(db: SupabaseClient, teacherId: string): Promise<{ courseIds: string[] }> {
  const courseConfigs = [
    { title: 'CS 101 — Intro to Computer Science', subject: 'Computer Science', level: '101', gates: CS101_GATES, colorOffset: 0 },
    { title: 'MATH 201 — Linear Algebra & Statistics', subject: 'Mathematics', level: '201', gates: MATH201_GATES, colorOffset: 2 },
    { title: 'CS 301 — Introduction to Machine Learning', subject: 'Machine Learning', level: '301', gates: CS301_GATES, colorOffset: 4 },
  ];

  const courseIds: string[] = [];
  const allGateIdMaps: Map<string, string>[] = []; // courseIdx -> gateNumber -> gateId

  // 1. Create courses
  for (const cfg of courseConfigs) {
    const { data: course } = await db.from('courses').insert({
      teacher_id: teacherId,
      title: cfg.title,
      subject: cfg.subject,
      class_level: cfg.level,
      section: 'A',
      academic_year: '2026-27',
      status: 'active',
      llm_provider: 'openrouter',
      mastery_threshold: 70,
      total_sessions: 24,
      session_duration_minutes: 50,
      syllabus_text: `${cfg.title} — ${cfg.gates.map(g => g.title).join(', ')}`,
    }).select().single();

    if (!course) throw new Error(`Failed to create course: ${cfg.title}`);
    courseIds.push(course.id);

    // 2. Create gates
    const gateInserts = cfg.gates.map((g, i) => ({
      course_id: course.id,
      gate_number: g.number,
      title: g.title,
      short_title: g.short,
      color: GATE_COLORS[(cfg.colorOffset + i) % GATE_COLORS.length].color,
      light_color: GATE_COLORS[(cfg.colorOffset + i) % GATE_COLORS.length].light,
      status: 'accepted',
      sort_order: g.number,
    }));
    const { data: gates } = await db.from('gates').insert(gateInserts).select();
    if (!gates) throw new Error('Failed to create gates');

    const gateIdMap = new Map(gates.map(g => [g.gate_number, g.id]));
    allGateIdMaps.push(gateIdMap);

    // 3. Within-course prerequisites
    const prereqs: any[] = [];
    for (let gn = 2; gn <= cfg.gates.length; gn++) {
      prereqs.push({ gate_id: gateIdMap.get(gn)!, prerequisite_gate_id: gateIdMap.get(gn - 1)! });
    }
    if (prereqs.length > 0) await db.from('gate_prerequisites').insert(prereqs);

    // 4. Sub-concepts
    const subInserts = cfg.gates.flatMap(g =>
      g.subs.map((s, i) => ({ gate_id: gateIdMap.get(g.number)!, title: s, sort_order: i + 1, status: 'accepted' }))
    );
    await db.from('sub_concepts').insert(subInserts);

    // 5. Lessons + Socratic scripts + Questions (6 per gate = 24 per course)
    let lessonNum = 0;
    for (const g of cfg.gates) {
      const gateId = gateIdMap.get(g.number)!;
      for (let li = 0; li < 6; li++) {
        lessonNum++;
        const subTopic = g.subs[li % g.subs.length];
        const bl = g.blooms;

        const { data: lesson } = await db.from('lessons').insert({
          gate_id: gateId, course_id: course.id, lesson_number: lessonNum,
          title: `${subTopic}${li >= g.subs.length ? ' — Advanced' : ''}`,
          objective: `Students will ${bl[0]} and ${bl[1]} concepts of ${subTopic.toLowerCase()}`,
          key_idea: `Core principle of ${subTopic.toLowerCase()} in ${cfg.subject.toLowerCase()}`,
          conceptual_breakthrough: `Connection between ${subTopic.toLowerCase()} and practical applications`,
          bloom_levels: bl,
          examples: [{ text: `Industry application of ${subTopic.toLowerCase()}` }],
          exercises: [{ text: `Problem set: ${subTopic.toLowerCase()}` }, { text: `Lab exercise: ${subTopic.toLowerCase()}` }],
          duration_minutes: 50, status: 'accepted', sort_order: lessonNum,
        }).select().single();

        if (lesson) {
          await db.from('socratic_scripts').insert([
            { lesson_id: lesson.id, stage_number: 1, stage_title: 'Context Setting', duration_minutes: 8, teacher_prompt: `Why is ${subTopic.toLowerCase()} important in ${cfg.subject}?`, expected_response: 'Students connect to prior knowledge', follow_up: 'Lets formalize this', sort_order: 1, status: 'accepted' },
            { lesson_id: lesson.id, stage_number: 2, stage_title: 'Guided Exploration', duration_minutes: 20, teacher_prompt: `Work through this ${subTopic.toLowerCase()} problem step by step. What patterns do you notice?`, expected_response: 'Students identify key patterns', follow_up: 'Now generalize', sort_order: 2, status: 'accepted' },
            { lesson_id: lesson.id, stage_number: 3, stage_title: 'Formalization', duration_minutes: 12, teacher_prompt: `Define ${subTopic.toLowerCase()} formally. How does this relate to ${g.title}?`, expected_response: 'Students formulate precise definitions', follow_up: 'Apply to a new scenario', sort_order: 3, status: 'accepted' },
            { lesson_id: lesson.id, stage_number: 4, stage_title: 'Application & Synthesis', duration_minutes: 10, teacher_prompt: `Solve this challenge problem. Discuss with your neighbor.`, expected_response: 'Students apply concepts collaboratively', follow_up: 'Next class builds on this', sort_order: 4, status: 'accepted' },
          ]);

          // 10 questions per lesson
          const qInserts = [
            { type: 'mcq', bloom: 'remember', diff: 1, text: `Define ${subTopic.toLowerCase()}.` },
            { type: 'mcq', bloom: 'understand', diff: 2, text: `Which statement best describes ${subTopic.toLowerCase()}?` },
            { type: 'mcq', bloom: 'apply', diff: 3, text: `Apply ${subTopic.toLowerCase()} to solve this problem.` },
            { type: 'true_false', bloom: 'remember', diff: 1, text: `True/False: ${subTopic} is a fundamental concept in ${cfg.subject}.` },
            { type: 'true_false', bloom: 'understand', diff: 2, text: `True/False: ${subTopic} requires understanding of ${g.subs[0]}.` },
            { type: 'short_answer', bloom: 'apply', diff: 3, text: `Demonstrate ${subTopic.toLowerCase()} with a worked example.` },
            { type: 'short_answer', bloom: 'analyze', diff: 4, text: `Compare two approaches to ${subTopic.toLowerCase()}.` },
            { type: 'open_ended', bloom: 'analyze', diff: 4, text: `Analyze the limitations of ${subTopic.toLowerCase()}.` },
            { type: 'open_ended', bloom: 'evaluate', diff: 5, text: `Evaluate when ${subTopic.toLowerCase()} is the optimal approach.` },
            { type: 'open_ended', bloom: 'create', diff: 5, text: `Design a novel application of ${subTopic.toLowerCase()}.` },
          ].map(q => ({
            gate_id: gateId, course_id: course.id, question_text: q.text,
            question_type: q.type, bloom_level: q.bloom, difficulty: q.diff,
            options: q.type === 'mcq' ? [{ text: 'Correct', is_correct: true }, { text: 'Incorrect A', is_correct: false }, { text: 'Incorrect B', is_correct: false }, { text: 'Incorrect C', is_correct: false }]
              : q.type === 'true_false' ? [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] : null,
            correct_answer: `Model answer for ${subTopic.toLowerCase()}`,
            rubric: 'Full: Complete with reasoning. Partial: Correct but incomplete. Zero: Incorrect.',
            status: 'accepted',
          }));
          await db.from('questions').insert(qInserts);
        }
      }
    }
  }

  // 6. CROSS-COURSE PREREQUISITES (the key differentiator)
  const [cs101Gates, math201Gates, cs301Gates] = allGateIdMaps;
  const crossPrereqs = [
    // CS 301 G1 (ML Basics) requires CS 101 G3 (Data Structures) & MATH 201 G3 (Probability)
    { gate_id: cs301Gates.get(1)!, prerequisite_gate_id: cs101Gates.get(3)! },
    { gate_id: cs301Gates.get(1)!, prerequisite_gate_id: math201Gates.get(3)! },
    // CS 301 G2 (Regression) requires MATH 201 G2 (Linear Transforms)
    { gate_id: cs301Gates.get(2)!, prerequisite_gate_id: math201Gates.get(2)! },
    // CS 301 G3 (Neural Nets) requires MATH 201 G1 (Vectors & Matrices)
    { gate_id: cs301Gates.get(3)!, prerequisite_gate_id: math201Gates.get(1)! },
    // CS 301 G3 also requires CS 101 G4 (OOP)
    { gate_id: cs301Gates.get(3)!, prerequisite_gate_id: cs101Gates.get(4)! },
    // CS 301 G4 (ML Systems) requires MATH 201 G4 (Statistics)
    { gate_id: cs301Gates.get(4)!, prerequisite_gate_id: math201Gates.get(4)! },
  ];
  await db.from('gate_prerequisites').insert(crossPrereqs);

  // 7. Create college students + enroll in ALL 3 courses + seed progress
  const studentIds: string[] = [];
  for (const name of STUDENT_NAMES) {
    const email = `college.${name.toLowerCase().replace(/[^a-z]/g, '')}.${Date.now()}@university.demo`;
    try {
      const { data: user } = await db.auth.admin.createUser({
        email, password: 'student123', email_confirm: true,
        user_metadata: { full_name: name, role: 'student' },
      });
      if (user?.user) {
        await db.from('profiles').insert({ id: user.user.id, email, full_name: name, role: 'student', school: 'Horizon University College' });
        studentIds.push(user.user.id);
      }
    } catch { /* skip */ }
  }

  if (studentIds.length > 0) {
    // Enroll in all 3 courses
    const enrollments = studentIds.flatMap(sid => courseIds.map(cid => ({ course_id: cid, student_id: sid })));
    for (let i = 0; i < enrollments.length; i += 10) {
      await db.from('enrollments').insert(enrollments.slice(i, i + 10));
    }

    // Seed progress: 12 scores per student (4 gates × 3 courses)
    const progressRows: any[] = [];
    const allGates = [cs101Gates, math201Gates, cs301Gates];
    for (let si = 0; si < studentIds.length; si++) {
      let scoreIdx = 0;
      for (let ci = 0; ci < 3; ci++) {
        for (let gn = 1; gn <= 4; gn++) {
          const sc = STUDENT_SCORES[si]?.[scoreIdx] || 0;
          scoreIdx++;
          progressRows.push({
            student_id: studentIds[si],
            gate_id: allGates[ci].get(gn)!,
            course_id: courseIds[ci],
            mastery_pct: sc,
            is_unlocked: sc > 0,
            bloom_scores: {
              remember: Math.min(100, sc + 10),
              understand: sc,
              apply: Math.max(0, sc - 10),
              analyze: Math.max(0, sc - 25),
              evaluate: Math.max(0, sc - 40),
              create: Math.max(0, sc - 55),
            },
          });
        }
      }
    }
    for (let i = 0; i < progressRows.length; i += 10) {
      await db.from('student_gate_progress').insert(progressRows.slice(i, i + 10));
    }
  }

  // 8. AI Suggestions highlighting cross-course bottlenecks
  await db.from('ai_suggestions').insert([
    { course_id: courseIds[2], gate_id: cs301Gates.get(2), type: 'lesson_refine', title: 'Math prerequisite gap blocking ML students', description: '3 students struggling in Regression (CS 301 G2) lack Linear Transformations mastery (MATH 201 G2). Coordinate with Prof. Iyer for remedial session.', status: 'pending' },
    { course_id: courseIds[2], gate_id: cs301Gates.get(1), type: 'remediation', title: 'Probability foundations needed', description: 'Sneha and Vikram scored below 50% on Probability (MATH 201 G3), blocking ML Foundations (CS 301 G1). Recommend probability refresher before proceeding.', status: 'pending' },
    { course_id: courseIds[0], gate_id: cs101Gates.get(3), type: 'peer_teaching', title: 'Peer teaching for Data Structures', description: 'Priyanka (88%) can mentor Vikram (40%) on Data Structures. This would unblock Vikrams access to ML course gates.', status: 'accepted' },
  ]);

  console.log(`College demo seeded: ${courseIds.length} courses, ${studentIds.length} students, ${crossPrereqs.length} cross-course edges`);
  return { courseIds };
}
