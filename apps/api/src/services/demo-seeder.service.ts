import type { SupabaseClient } from '@supabase/supabase-js';
import { GATE_COLORS } from '@les/shared';

const GATE_DATA = [
  { number: 1, title: 'Large Numbers & Place Value', short: 'Numbers', period: 'Mar-May', subs: ['Place Value (8-9 digit)', 'Expanded Form', 'Indian vs International System', 'Comparison & Ordering'] },
  { number: 2, title: 'Factors, HCF & LCM', short: 'HCF / LCM', period: 'Jul', subs: ['Prime Factorisation', 'HCF by Division', 'LCM by Multiples'] },
  { number: 3, title: 'Fractions (All Operations)', short: 'Fractions', period: 'Jul-Aug', subs: ['Equivalent Fractions', 'Add/Subtract Unlike', 'Multiply Fractions', 'Word Problems'] },
  { number: 4, title: 'Decimals & Measurement', short: 'Decimals', period: 'Oct-Dec', subs: ['Decimal Place Value', 'Fraction-Decimal Conversion', 'Measurement Units'] },
  { number: 5, title: 'Geometry & Mensuration', short: 'Geometry', period: 'Sep', subs: ['Angles & Types', 'Perimeter & Area', 'Volume Basics'] },
  { number: 6, title: 'Percentage & Data Handling', short: 'Percentage', period: 'Jan-Feb', subs: ['Fraction to Percentage', 'Bar & Pie Charts'] },
];

const LESSON_DIST = [6, 5, 6, 5, 5, 3]; // 30 total
const LESSON_TITLES: Record<number, string[]> = {
  1: ['Intro to Place Value', 'Expanded Form', 'Indian Number System', 'International Number System', 'Comparing Large Numbers', 'Rounding & Estimation'],
  2: ['Understanding Factors', 'Prime & Composite Numbers', 'Prime Factorisation', 'Finding HCF', 'Finding LCM'],
  3: ['Understanding Fractions', 'Equivalent Fractions', 'Adding Unlike Fractions', 'Multiplying Fractions', 'Dividing Fractions', 'Fraction Word Problems'],
  4: ['Decimal Place Value', 'Fraction-Decimal Conversion', 'Operations with Decimals', 'Measurement Units', 'Decimal Word Problems'],
  5: ['Types of Angles', 'Properties of Triangles', 'Quadrilaterals', 'Perimeter & Area', 'Volume Basics'],
  6: ['Fraction to Percentage', 'Percentage Applications', 'Reading Charts'],
};

const BLOOM_CYCLE = [['remember', 'understand'], ['understand', 'apply'], ['apply', 'analyze'], ['analyze', 'evaluate'], ['apply', 'create'], ['remember', 'understand']];

const STUDENT_NAMES = ['Aarav M.', 'Priya S.', 'Kabir R.', 'Sia P.', 'Aryan S.', 'Meera T.', 'Rohan K.', 'Anaya D.'];
const STUDENT_SCORES = [[92,85,72,60,78,55],[92,78,54,0,81,0],[88,70,60,45,75,0],[95,88,80,72,82,68],[78,65,48,0,60,0],[82,60,40,0,55,0],[90,82,75,68,88,52],[85,72,58,0,70,0]];

export async function seedDemoCourse(db: SupabaseClient, teacherId: string): Promise<string> {
  // 1. Create course
  const { data: course } = await db.from('courses').insert({
    teacher_id: teacherId, title: 'Class 5 Mathematics (Demo)', subject: 'Mathematics',
    class_level: '5', section: 'B', academic_year: '2026-27', status: 'active',
    llm_provider: 'openrouter', mastery_threshold: 75, total_sessions: 30, session_duration_minutes: 40,
    syllabus_text: 'Ch1: Numbers, Ch2: HCF/LCM, Ch3: Fractions, Ch4: Decimals, Ch5: Geometry, Ch6: Percentage',
  }).select().single();

  if (!course) throw new Error('Failed to create demo course');
  const courseId = course.id;

  // 2. Create gates
  const gateInserts = GATE_DATA.map((g, i) => ({
    course_id: courseId, gate_number: g.number, title: g.title, short_title: g.short,
    color: GATE_COLORS[i % GATE_COLORS.length].color, light_color: GATE_COLORS[i % GATE_COLORS.length].light,
    period: g.period, status: 'accepted', sort_order: g.number,
  }));
  const { data: gates } = await db.from('gates').insert(gateInserts).select();
  if (!gates) throw new Error('Failed to create gates');
  const gateIdMap = new Map(gates.map(g => [g.gate_number, g.id]));

  // 3. Prerequisites
  const prereqs = [
    { gate_id: gateIdMap.get(2)!, prerequisite_gate_id: gateIdMap.get(1)! },
    { gate_id: gateIdMap.get(3)!, prerequisite_gate_id: gateIdMap.get(2)! },
    { gate_id: gateIdMap.get(4)!, prerequisite_gate_id: gateIdMap.get(3)! },
    { gate_id: gateIdMap.get(5)!, prerequisite_gate_id: gateIdMap.get(1)! },
    { gate_id: gateIdMap.get(6)!, prerequisite_gate_id: gateIdMap.get(4)! },
  ];
  await db.from('gate_prerequisites').insert(prereqs);

  // 4. Sub-concepts
  const subInserts = GATE_DATA.flatMap(g =>
    g.subs.map((s, i) => ({ gate_id: gateIdMap.get(g.number)!, title: s, sort_order: i + 1, status: 'accepted' }))
  );
  await db.from('sub_concepts').insert(subInserts);

  // 5. 30 Lessons + Socratic scripts
  let lessonNum = 0;
  for (let gn = 1; gn <= 6; gn++) {
    const gateId = gateIdMap.get(gn)!;
    const titles = LESSON_TITLES[gn];
    for (let li = 0; li < LESSON_DIST[gn - 1]; li++) {
      lessonNum++;
      const t = titles[li];
      const bl = BLOOM_CYCLE[li % BLOOM_CYCLE.length];

      const { data: lesson } = await db.from('lessons').insert({
        gate_id: gateId, course_id: courseId, lesson_number: lessonNum, title: t,
        objective: `Students will ${bl[0]} and ${bl[1]} key concepts of ${t.toLowerCase()}`,
        key_idea: `The foundational principle behind ${t.toLowerCase()}`,
        conceptual_breakthrough: `Students discover the connection between ${t.toLowerCase()} and real life`,
        bloom_levels: bl, examples: [{ text: `Real-world example of ${t.toLowerCase()}` }, { text: `Visual model for ${t.toLowerCase()}` }],
        exercises: [{ text: `Practice problems on ${t.toLowerCase()}` }, { text: `Group activity: ${t.toLowerCase()}` }],
        duration_minutes: 40, status: 'accepted', sort_order: lessonNum,
      }).select().single();

      if (lesson) {
        await db.from('socratic_scripts').insert([
          { lesson_id: lesson.id, stage_number: 1, stage_title: 'Hook', duration_minutes: 5, teacher_prompt: `What do you already know about ${t.toLowerCase()}?`, expected_response: 'Students share prior knowledge', follow_up: 'Lets explore further', sort_order: 1, status: 'accepted' },
          { lesson_id: lesson.id, stage_number: 2, stage_title: 'Discovery', duration_minutes: 15, teacher_prompt: `Why do we need ${t.toLowerCase()} in real life?`, expected_response: 'Students connect to everyday situations', follow_up: 'Notice the pattern', sort_order: 2, status: 'accepted' },
          { lesson_id: lesson.id, stage_number: 3, stage_title: 'Concept Build', duration_minutes: 12, teacher_prompt: `How would you define ${t.toLowerCase()} in your own words?`, expected_response: 'Students formulate their own definition', follow_up: 'Compare with the textbook', sort_order: 3, status: 'accepted' },
          { lesson_id: lesson.id, stage_number: 4, stage_title: 'Application', duration_minutes: 8, teacher_prompt: `Solve this problem using ${t.toLowerCase()}. Work in pairs.`, expected_response: 'Students apply the concept', follow_up: 'Tomorrow we go deeper', sort_order: 4, status: 'accepted' },
        ]);

        // 10 questions per lesson
        const qTypes = [
          { type: 'mcq', bloom: 'remember', diff: 1, opts: [{ text: 'Correct', is_correct: true }, { text: 'Wrong A', is_correct: false }, { text: 'Wrong B', is_correct: false }, { text: 'Wrong C', is_correct: false }] },
          { type: 'mcq', bloom: 'understand', diff: 2, opts: [{ text: 'Best example', is_correct: true }, { text: 'Unrelated', is_correct: false }, { text: 'Partial', is_correct: false }, { text: 'Mistake', is_correct: false }] },
          { type: 'mcq', bloom: 'apply', diff: 3, opts: [{ text: '8', is_correct: true }, { text: '42', is_correct: false }, { text: '54', is_correct: false }, { text: '288', is_correct: false }] },
          { type: 'true_false', bloom: 'remember', diff: 1, opts: [{ text: 'True', is_correct: false }, { text: 'False', is_correct: true }] },
          { type: 'true_false', bloom: 'understand', diff: 2, opts: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] },
          { type: 'short_answer', bloom: 'apply', diff: 3 },
          { type: 'short_answer', bloom: 'analyze', diff: 4 },
          { type: 'open_ended', bloom: 'understand', diff: 2 },
          { type: 'open_ended', bloom: 'evaluate', diff: 5 },
          { type: 'open_ended', bloom: 'create', diff: 5 },
        ];
        const texts = [
          `What is the definition of ${t.toLowerCase()}?`, `Which example best shows ${t.toLowerCase()}?`,
          `Apply ${t.toLowerCase()} to solve a problem.`, `True or False: ${t} has no real use.`,
          `True or False: ${t.toLowerCase()} is essential.`, `Show your working using ${t.toLowerCase()}.`,
          `Compare two methods for ${t.toLowerCase()}.`, `Why does ${t.toLowerCase()} matter? Give examples.`,
          `Is ${t.toLowerCase()} the hardest? Argue.`, `Create a challenge using ${t.toLowerCase()}.`,
        ];
        const qInserts = qTypes.map((qt, qi) => ({
          gate_id: gateId, course_id: courseId, question_text: texts[qi],
          question_type: qt.type, bloom_level: qt.bloom, difficulty: qt.diff,
          options: (qt as any).opts || null, correct_answer: `Model answer for ${t.toLowerCase()}`,
          rubric: 'Full marks: complete. Partial: some. Zero: wrong.', is_diagnostic: qi >= 6, status: 'accepted',
        }));
        await db.from('questions').insert(qInserts);
      }
    }
  }

  // 6. Create demo students + enroll + progress
  const studentIds: string[] = [];
  for (let si = 0; si < STUDENT_NAMES.length; si++) {
    const name = STUDENT_NAMES[si];
    const email = `demo.${name.toLowerCase().replace(/[^a-z]/g, '')}.${Date.now()}@lmgc.demo`;
    try {
      const { data: user } = await db.auth.admin.createUser({
        email, password: 'student123', email_confirm: true,
        user_metadata: { full_name: name, role: 'student' },
      });
      if (user?.user) {
        await db.from('profiles').insert({ id: user.user.id, email, full_name: name, role: 'student', school: 'LMGC', class_section: '5B' });
        studentIds.push(user.user.id);
      }
    } catch { /* skip if fails */ }
  }

  if (studentIds.length > 0) {
    await db.from('enrollments').insert(studentIds.map(sid => ({ course_id: courseId, student_id: sid })));

    // Progress data
    const progressRows: any[] = [];
    for (let gi = 0; gi < 6; gi++) {
      const gateId = gateIdMap.get(gi + 1)!;
      for (let si = 0; si < studentIds.length; si++) {
        const sc = STUDENT_SCORES[si][gi];
        progressRows.push({
          student_id: studentIds[si], gate_id: gateId, course_id: courseId,
          mastery_pct: sc, is_unlocked: sc > 0,
          bloom_scores: { remember: Math.min(100, sc + 10), understand: sc, apply: Math.max(0, sc - 15), analyze: Math.max(0, sc - 30), evaluate: Math.max(0, sc - 45), create: Math.max(0, sc - 60) },
        });
      }
    }
    for (let i = 0; i < progressRows.length; i += 10) {
      await db.from('student_gate_progress').insert(progressRows.slice(i, i + 10));
    }
  }

  // 7. AI Suggestions
  await db.from('ai_suggestions').insert([
    { course_id: courseId, gate_id: gateIdMap.get(3), type: 'lesson_refine', title: 'Add visual fraction models', description: '44% stuck at Apply. Area models bridge to Analyze.', status: 'pending' },
    { course_id: courseId, gate_id: gateIdMap.get(3), type: 'peer_teaching', title: 'Peer teaching for Fractions', description: 'Sia (80%) can mentor Aryan (48%) on equivalent fractions.', status: 'accepted' },
    { course_id: courseId, gate_id: gateIdMap.get(4), type: 'pace_change', title: 'Delay Gate 4 by 1 session', description: '4 students below 75% on Gate 3. Rushing compounds gaps.', status: 'pending' },
  ]);

  return courseId;
}
