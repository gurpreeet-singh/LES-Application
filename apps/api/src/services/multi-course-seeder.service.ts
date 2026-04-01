import type { SupabaseClient } from '@supabase/supabase-js';

// ─── 30 Student Archetypes ─────────────────────────────────
const STUDENTS = [
  // Top performers (5)
  { name: 'Aanya Sharma', accuracy: 0.93, bloomCeil: 5, style: { logical: 85, visual: 70, reflective: 60, kinesthetic: 40, auditory: 55 } },
  { name: 'Ishaan Gupta', accuracy: 0.90, bloomCeil: 5, style: { logical: 75, visual: 80, reflective: 70, kinesthetic: 50, auditory: 65 } },
  { name: 'Saanvi Patel', accuracy: 0.88, bloomCeil: 5, style: { logical: 80, visual: 65, reflective: 75, kinesthetic: 45, auditory: 70 } },
  { name: 'Vihaan Reddy', accuracy: 0.87, bloomCeil: 4, style: { logical: 90, visual: 55, reflective: 65, kinesthetic: 35, auditory: 50 } },
  { name: 'Diya Nair', accuracy: 0.85, bloomCeil: 5, style: { logical: 70, visual: 85, reflective: 55, kinesthetic: 60, auditory: 75 } },
  // Strong learners (8)
  { name: 'Advait Joshi', accuracy: 0.82, bloomCeil: 4, style: { logical: 72, visual: 68, reflective: 58, kinesthetic: 55, auditory: 60 } },
  { name: 'Myra Kapoor', accuracy: 0.79, bloomCeil: 4, style: { logical: 65, visual: 78, reflective: 62, kinesthetic: 50, auditory: 72 } },
  { name: 'Reyansh Verma', accuracy: 0.77, bloomCeil: 3, style: { logical: 80, visual: 55, reflective: 50, kinesthetic: 65, auditory: 45 } },
  { name: 'Anvi Singh', accuracy: 0.75, bloomCeil: 4, style: { logical: 60, visual: 75, reflective: 70, kinesthetic: 45, auditory: 68 } },
  { name: 'Arjun Mehta', accuracy: 0.73, bloomCeil: 3, style: { logical: 78, visual: 60, reflective: 55, kinesthetic: 70, auditory: 42 } },
  { name: 'Kiara Desai', accuracy: 0.71, bloomCeil: 3, style: { logical: 55, visual: 82, reflective: 68, kinesthetic: 48, auditory: 75 } },
  { name: 'Vivaan Rao', accuracy: 0.70, bloomCeil: 3, style: { logical: 75, visual: 58, reflective: 62, kinesthetic: 55, auditory: 50 } },
  { name: 'Navya Iyer', accuracy: 0.70, bloomCeil: 4, style: { logical: 62, visual: 70, reflective: 72, kinesthetic: 40, auditory: 65 } },
  // Average (8)
  { name: 'Aditya Kulkarni', accuracy: 0.66, bloomCeil: 3, style: { logical: 58, visual: 62, reflective: 50, kinesthetic: 65, auditory: 55 } },
  { name: 'Riya Banerjee', accuracy: 0.64, bloomCeil: 3, style: { logical: 52, visual: 70, reflective: 58, kinesthetic: 48, auditory: 68 } },
  { name: 'Dev Choudhury', accuracy: 0.62, bloomCeil: 2, style: { logical: 68, visual: 48, reflective: 45, kinesthetic: 72, auditory: 40 } },
  { name: 'Aarohi Mishra', accuracy: 0.60, bloomCeil: 3, style: { logical: 50, visual: 65, reflective: 60, kinesthetic: 42, auditory: 62 } },
  { name: 'Kabir Saxena', accuracy: 0.58, bloomCeil: 2, style: { logical: 62, visual: 52, reflective: 48, kinesthetic: 68, auditory: 45 } },
  { name: 'Tara Bhat', accuracy: 0.57, bloomCeil: 2, style: { logical: 48, visual: 72, reflective: 55, kinesthetic: 50, auditory: 58 } },
  { name: 'Rohan Agarwal', accuracy: 0.55, bloomCeil: 2, style: { logical: 65, visual: 45, reflective: 42, kinesthetic: 70, auditory: 38 } },
  { name: 'Zara Khan', accuracy: 0.55, bloomCeil: 3, style: { logical: 45, visual: 68, reflective: 65, kinesthetic: 38, auditory: 72 } },
  // Struggling (6)
  { name: 'Pranav Tiwari', accuracy: 0.50, bloomCeil: 2, style: { logical: 55, visual: 48, reflective: 40, kinesthetic: 62, auditory: 42 } },
  { name: 'Sneha Pillai', accuracy: 0.47, bloomCeil: 2, style: { logical: 42, visual: 60, reflective: 52, kinesthetic: 45, auditory: 55 } },
  { name: 'Arnav Dubey', accuracy: 0.44, bloomCeil: 1, style: { logical: 58, visual: 40, reflective: 35, kinesthetic: 65, auditory: 32 } },
  { name: 'Pooja Yadav', accuracy: 0.42, bloomCeil: 2, style: { logical: 38, visual: 55, reflective: 48, kinesthetic: 42, auditory: 52 } },
  { name: 'Karthik Nambiar', accuracy: 0.40, bloomCeil: 1, style: { logical: 52, visual: 42, reflective: 38, kinesthetic: 58, auditory: 35 } },
  { name: 'Divya Shetty', accuracy: 0.40, bloomCeil: 2, style: { logical: 35, visual: 58, reflective: 50, kinesthetic: 38, auditory: 48 } },
  // At-risk (3)
  { name: 'Rahul Pandey', accuracy: 0.32, bloomCeil: 1, style: { logical: 45, visual: 35, reflective: 30, kinesthetic: 55, auditory: 28 } },
  { name: 'Neha Srivastava', accuracy: 0.28, bloomCeil: 1, style: { logical: 30, visual: 48, reflective: 40, kinesthetic: 32, auditory: 42 } },
  { name: 'Amit Thakur', accuracy: 0.22, bloomCeil: 0, style: { logical: 38, visual: 30, reflective: 25, kinesthetic: 48, auditory: 22 } },
];

const BLOOMS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

// Deterministic pseudo-random based on seed
function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Generate misconceptions based on bloom level and subject context
function getMisconception(bloom: string, subject: string, seed: number): string[] {
  const misconceptions: Record<string, Record<string, string[]>> = {
    'English Language': {
      remember: ['Confuses noun types', 'Cannot recall rule', 'Mixes up articles a/an'],
      understand: ['Applies rule mechanically', 'Misidentifies parts of speech', 'Confuses tense usage'],
      apply: ['Wrong plural rule applied', 'Incorrect sentence structure', 'Misuses pronoun form'],
    },
    Mathematics: {
      remember: ['Cannot recall formula', 'Confuses operation signs', 'Forgets order of operations'],
      understand: ['Misinterprets word problem', 'Confuses inverse operations', 'Cannot explain method'],
      apply: ['Calculation error', 'Wrong operation selected', 'Fails unit conversion', 'Sign error in algebra'],
      analyze: ['Cannot identify relevant info', 'Misses constraints', 'Incomplete factorization'],
    },
    Economics: {
      remember: ['Confuses GDP with GNP', 'Cannot recall definition', 'Mixes up economist names'],
      understand: ['Misinterprets demand curve shift', 'Confuses micro and macro', 'Misapplies price mechanism'],
      apply: ['Wrong formula applied', 'Calculation error in index numbers', 'Misreads graph data'],
      analyze: ['Correlation treated as causation', 'Ignores ceteris paribus', 'Incomplete analysis'],
      evaluate: ['One-sided argument', 'No evidence cited', 'Cannot compare policy options'],
    },
  };
  const subjectMisc = misconceptions[subject] || misconceptions['Mathematics'];
  const levelMisc = subjectMisc[bloom] || subjectMisc['remember'] || ['General misunderstanding'];
  const idx = Math.floor(seededRand(seed) * levelMisc.length);
  return [{ misconception: levelMisc[idx] }] as any;
}

export async function seedStudentsForCourses(
  db: SupabaseClient,
  courseIds: string[],
): Promise<{ students: number; attempts: number; progress: number }> {
  console.log(`Seeding 30 students for ${courseIds.length} courses...`);

  // ─── 1. Create 30 student auth accounts ──────────────────
  const studentIds: string[] = [];
  const ts = Date.now();

  for (let si = 0; si < STUDENTS.length; si++) {
    const s = STUDENTS[si];
    const email = `demo.${s.name.toLowerCase().replace(/[^a-z]/g, '')}.${ts}@lmgc.demo`;
    try {
      const { data: user } = await db.auth.admin.createUser({
        email, password: 'student123', email_confirm: true,
        user_metadata: { full_name: s.name, role: 'student' },
      });
      if (user?.user) {
        await db.from('profiles').upsert({
          id: user.user.id, email, full_name: s.name, role: 'student',
          school: 'LMGC', class_section: 'Demo',
        });
        studentIds.push(user.user.id);
      }
    } catch (err) {
      console.error(`Failed to create student ${s.name}:`, (err as Error).message);
    }
  }
  console.log(`Created ${studentIds.length} students`);

  let totalAttempts = 0;
  let totalProgress = 0;

  // ─── 2. Process each course ──────────────────────────────
  for (const courseId of courseIds) {
    // Get course info
    const { data: course } = await db.from('courses').select('title, subject, class_level').eq('id', courseId).single();
    if (!course) { console.error(`Course ${courseId} not found`); continue; }
    console.log(`\nSeeding: ${course.title}`);

    // Get gates
    const { data: gates } = await db.from('gates').select('id, gate_number, title').eq('course_id', courseId).order('gate_number');
    if (!gates || gates.length === 0) { console.error('No gates found'); continue; }

    // Get lessons
    const { data: lessons } = await db.from('lessons').select('id, gate_id, lesson_number, title, objective, bloom_levels').eq('course_id', courseId).order('lesson_number');
    if (!lessons) { console.error('No lessons found'); continue; }

    // Get or create questions
    let { data: questions } = await db.from('questions').select('id, gate_id, question_type, bloom_level, difficulty, options').eq('course_id', courseId);

    if (!questions || questions.length === 0) {
      console.log('  No questions found — generating template questions...');
      const qInserts: any[] = [];
      for (const lesson of lessons) {
        const t = lesson.title;
        const qTemplates = [
          { type: 'mcq', bloom: 'remember', diff: 1, text: `What is the basic definition of ${t.toLowerCase()}?`, opts: [{ text: 'Correct definition', is_correct: true }, { text: 'Partially correct', is_correct: false }, { text: 'Common misconception', is_correct: false }, { text: 'Unrelated concept', is_correct: false }] },
          { type: 'mcq', bloom: 'understand', diff: 2, text: `Which example best demonstrates ${t.toLowerCase()}?`, opts: [{ text: 'Best example', is_correct: true }, { text: 'Related but incorrect', is_correct: false }, { text: 'Opposite concept', is_correct: false }, { text: 'Different topic', is_correct: false }] },
          { type: 'mcq', bloom: 'apply', diff: 3, text: `Apply the concept of ${t.toLowerCase()} to solve this problem.`, opts: [{ text: 'Correct application', is_correct: true }, { text: 'Wrong method', is_correct: false }, { text: 'Partial solution', is_correct: false }, { text: 'Common error', is_correct: false }] },
          { type: 'true_false', bloom: 'remember', diff: 1, text: `${t} is a fundamental concept in this subject.`, opts: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] },
          { type: 'true_false', bloom: 'understand', diff: 2, text: `${t.toLowerCase()} can only be applied in one specific way.`, opts: [{ text: 'True', is_correct: false }, { text: 'False', is_correct: true }] },
          { type: 'short_answer', bloom: 'apply', diff: 3, text: `Show your working: apply ${t.toLowerCase()} to a new scenario.` },
          { type: 'short_answer', bloom: 'analyze', diff: 4, text: `Compare two different approaches to ${t.toLowerCase()}.` },
          { type: 'open_ended', bloom: 'understand', diff: 2, text: `Explain why ${t.toLowerCase()} matters. Give examples.` },
          { type: 'open_ended', bloom: 'evaluate', diff: 4, text: `Evaluate the effectiveness of ${t.toLowerCase()} in practice.` },
          { type: 'open_ended', bloom: 'create', diff: 5, text: `Design a creative challenge using ${t.toLowerCase()}.` },
        ];
        for (const qt of qTemplates) {
          qInserts.push({
            gate_id: lesson.gate_id, course_id: courseId, question_text: qt.text,
            question_type: qt.type, bloom_level: qt.bloom, difficulty: qt.diff,
            options: (qt as any).opts || null, correct_answer: `Model answer for ${t.toLowerCase()}`,
            rubric: 'Full marks: complete and correct. Partial: some understanding shown. Zero: incorrect or missing.',
            is_diagnostic: qt.diff >= 4, status: 'accepted',
          });
        }
      }
      // Batch insert questions
      for (let i = 0; i < qInserts.length; i += 200) {
        await db.from('questions').insert(qInserts.slice(i, i + 200));
      }
      const { data: newQ } = await db.from('questions').select('id, gate_id, question_type, bloom_level, difficulty, options').eq('course_id', courseId);
      questions = newQ || [];
      console.log(`  Generated ${questions.length} questions`);
    } else {
      console.log(`  Found ${questions.length} existing questions`);
    }

    // ─── 3. Enroll all students ───────────────────────────
    const enrollInserts = studentIds.map(sid => ({ course_id: courseId, student_id: sid }));
    await db.from('enrollments').upsert(enrollInserts, { onConflict: 'course_id,student_id' });
    console.log(`  Enrolled ${studentIds.length} students`);

    // ─── 4. Generate question attempts ────────────────────
    const classLevel = parseInt(course.class_level || '8', 10);
    const subject = course.subject || 'General';
    const gateQuestions = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!gateQuestions.has(q.gate_id)) gateQuestions.set(q.gate_id, []);
      gateQuestions.get(q.gate_id)!.push(q);
    }

    const attemptBatch: any[] = [];
    const progressMap = new Map<string, { scores: number[]; bloomScores: Record<string, number[]> }>();

    for (let si = 0; si < studentIds.length; si++) {
      const student = STUDENTS[si];
      const studentId = studentIds[si];

      // Per-course accuracy variation (±10%)
      const courseVariation = seededRand(si * 100 + courseIds.indexOf(courseId) * 7) * 0.2 - 0.1;
      const effectiveAccuracy = Math.max(0.1, Math.min(0.98, student.accuracy + courseVariation));

      for (const gate of gates) {
        const gateQ = gateQuestions.get(gate.id) || [];
        const key = `${studentId}:${gate.id}`;
        if (!progressMap.has(key)) progressMap.set(key, { scores: [], bloomScores: {} });
        const prog = progressMap.get(key)!;

        // Gate difficulty progression (later gates are harder)
        const gateIdx = gates.indexOf(gate);
        const gatePenalty = gateIdx * 0.03; // 3% harder per gate

        for (let qi = 0; qi < gateQ.length; qi++) {
          const q = gateQ[qi];
          const bloomIdx = BLOOMS.indexOf(q.bloom_level);
          const seed = si * 10000 + gateIdx * 1000 + qi;

          // Higher bloom = harder for lower-ceiling students
          const bloomPenalty = bloomIdx > student.bloomCeil ? 0.35 : bloomIdx * 0.06;
          const diffPenalty = (q.difficulty - 1) * 0.05;
          const prob = Math.max(0.05, effectiveAccuracy - bloomPenalty - diffPenalty - gatePenalty);
          const roll = seededRand(seed);
          const isCorrect = roll < prob;

          // Score calculation
          let score: number;
          if (q.question_type === 'mcq' || q.question_type === 'true_false') {
            score = isCorrect ? 100 : 0;
          } else if (q.question_type === 'short_answer') {
            score = isCorrect ? (seededRand(seed + 1) > 0.3 ? 100 : 70) : (seededRand(seed + 2) > 0.5 ? 40 : 15);
          } else {
            score = isCorrect ? (seededRand(seed + 1) > 0.4 ? 100 : 75) : (seededRand(seed + 2) > 0.4 ? 45 : 20);
          }

          // Time spent (faster for easy, slower for hard)
          const baseTime = q.question_type === 'mcq' ? 25 : q.question_type === 'true_false' ? 15 : q.question_type === 'short_answer' ? 60 : 90;
          const timeVariation = Math.floor(seededRand(seed + 3) * baseTime * 0.6);
          const timeSpent = baseTime + timeVariation + (isCorrect ? 0 : Math.floor(seededRand(seed + 4) * 30));

          // Bloom demonstrated
          const demonstrated = isCorrect ? q.bloom_level : (bloomIdx > 0 ? BLOOMS[bloomIdx - 1] : 'remember');

          attemptBatch.push({
            student_id: studentId, question_id: q.id, gate_id: gate.id,
            answer_text: isCorrect ? 'Correct response' : 'Incorrect response',
            is_correct: isCorrect, score,
            bloom_level_demonstrated: demonstrated,
            time_spent_seconds: timeSpent,
            misconceptions: isCorrect ? null : getMisconception(q.bloom_level, subject, seed),
            attempted_at: new Date(Date.now() - Math.floor(seededRand(seed + 5) * 30 * 86400000)).toISOString(),
          });

          prog.scores.push(score);
          if (!prog.bloomScores[q.bloom_level]) prog.bloomScores[q.bloom_level] = [];
          prog.bloomScores[q.bloom_level].push(score);
        }
      }
    }

    // Batch insert attempts (chunks of 500)
    console.log(`  Inserting ${attemptBatch.length} question attempts...`);
    for (let i = 0; i < attemptBatch.length; i += 500) {
      const chunk = attemptBatch.slice(i, i + 500);
      const { error } = await db.from('question_attempts').insert(chunk);
      if (error) console.error(`  Attempt insert error at ${i}:`, error.message);
    }
    totalAttempts += attemptBatch.length;

    // ─── 5. Compute and insert student_gate_progress ──────
    const progressInserts: any[] = [];
    for (const [key, prog] of progressMap) {
      const [studentId, gateId] = key.split(':');
      const mastery = prog.scores.length > 0
        ? Math.round(prog.scores.reduce((a, b) => a + b, 0) / prog.scores.length)
        : 0;

      const bloomScoresFinal: Record<string, number> = {};
      for (const bl of BLOOMS) {
        const arr = prog.bloomScores[bl] || [];
        bloomScoresFinal[bl] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      }

      // Bloom ceiling = highest level with >50% score
      let bloomCeiling = 'remember';
      for (const bl of BLOOMS) {
        if (bloomScoresFinal[bl] >= 50) bloomCeiling = bl;
      }

      progressInserts.push({
        student_id: studentId, gate_id: gateId, course_id: courseId,
        mastery_pct: mastery, is_unlocked: mastery > 0,
        bloom_scores: bloomScoresFinal, bloom_ceiling: bloomCeiling,
        time_spent_minutes: Math.floor(prog.scores.length * 1.5),
      });
    }

    // Batch upsert progress
    for (let i = 0; i < progressInserts.length; i += 100) {
      await db.from('student_gate_progress').upsert(
        progressInserts.slice(i, i + 100),
        { onConflict: 'student_id,gate_id' }
      );
    }
    totalProgress += progressInserts.length;
    console.log(`  Inserted ${progressInserts.length} progress records`);

    // ─── 6. Create learning profiles ──────────────────────
    const profileInserts = studentIds.map((sid, si) => ({
      student_id: sid, course_id: courseId,
      logical: STUDENTS[si].style.logical,
      visual: STUDENTS[si].style.visual,
      reflective: STUDENTS[si].style.reflective,
      kinesthetic: STUDENTS[si].style.kinesthetic,
      auditory: STUDENTS[si].style.auditory,
      inferred_from_attempts: attemptBatch.filter(a => a.student_id === sid).length,
    }));
    await db.from('learning_profiles').upsert(profileInserts, { onConflict: 'student_id,course_id' });
    console.log(`  Inserted ${profileInserts.length} learning profiles`);

    // ─── 7. Add gate prerequisites (chain: G1→G2→G3→...→G8) ──
    const sortedGates = [...gates].sort((a, b) => a.gate_number - b.gate_number);
    const prereqInserts: { gate_id: string; prerequisite_gate_id: string }[] = [];
    for (let gi = 1; gi < sortedGates.length; gi++) {
      prereqInserts.push({ gate_id: sortedGates[gi].id, prerequisite_gate_id: sortedGates[gi - 1].id });
    }
    // Also add a skip dependency (G1→G4, G2→G5) for realistic non-linear deps
    if (sortedGates.length >= 5) {
      prereqInserts.push({ gate_id: sortedGates[3].id, prerequisite_gate_id: sortedGates[0].id });
      prereqInserts.push({ gate_id: sortedGates[4].id, prerequisite_gate_id: sortedGates[1].id });
    }
    if (sortedGates.length >= 7) {
      prereqInserts.push({ gate_id: sortedGates[6].id, prerequisite_gate_id: sortedGates[3].id });
    }
    await db.from('gate_prerequisites').upsert(prereqInserts, { onConflict: 'gate_id,prerequisite_gate_id' }).then(() => {
      console.log(`  Added ${prereqInserts.length} gate prerequisites`);
    }).catch(() => {
      // Try individual inserts if upsert fails
      prereqInserts.forEach(async p => {
        await db.from('gate_prerequisites').insert(p).catch(() => {});
      });
      console.log(`  Added gate prerequisites (individual)`);
    });

    // ─── 8. Seed AI suggestions ──────────────────────────────
    const weakGates = sortedGates.slice(-3); // Last 3 gates tend to have lower scores
    const suggestionTypes = ['lesson_refine', 'gate_delay', 'peer_teaching', 'remediation', 'pace_change'] as const;
    const suggestionInserts = [
      {
        course_id: courseId, gate_id: weakGates[0]?.id, type: 'remediation' as const,
        title: `Schedule remediation for ${weakGates[0]?.title || 'struggling topic'}`,
        description: `${Math.floor(3 + seededRand(courseIds.indexOf(courseId) * 77) * 5)} students are scoring below 50% in ${weakGates[0]?.title}. Consider a dedicated revision session before moving ahead.`,
        rationale: 'Bloom analysis shows students stuck at Remember level — they need guided practice at Understand and Apply levels before progressing.',
        tag: 'at-risk', status: 'pending' as const,
      },
      {
        course_id: courseId, gate_id: sortedGates[Math.floor(sortedGates.length / 2)]?.id, type: 'pace_change' as const,
        title: 'Slow down — concept gap detected',
        description: `Class average dropped from 72% to 55% between ${sortedGates[Math.floor(sortedGates.length / 2 - 1)]?.title} and ${sortedGates[Math.floor(sortedGates.length / 2)]?.title}. Students may need an additional session.`,
        rationale: 'The sharp drop suggests prerequisite concepts were not fully consolidated. Adding a bridging session could prevent cascading failures.',
        tag: 'pacing', status: 'pending' as const,
      },
      {
        course_id: courseId, gate_id: sortedGates[1]?.id, type: 'peer_teaching' as const,
        title: 'Pair strong and struggling students',
        description: `5 students are at 85%+ mastery in ${sortedGates[1]?.title} while 4 are below 45%. Peer teaching has shown 23% improvement in similar situations.`,
        rationale: 'Research shows peer explanation strengthens both the tutor (deeper processing) and the tutee (relatable language). Low-cost, high-impact intervention.',
        tag: 'collaboration', status: 'pending' as const,
      },
      {
        course_id: courseId, gate_id: weakGates[1]?.id || weakGates[0]?.id, type: 'lesson_refine' as const,
        title: `Add more visual examples to ${weakGates[1]?.title || 'difficult topic'}`,
        description: 'Learning profile analysis shows 60% of the class are visual learners, but current lessons are text-heavy. Adding diagrams and worked examples could improve comprehension.',
        rationale: 'Visual-spatial learners are underserved by the current content mix. Even a single diagram per concept has shown 15-20% improvement in recall.',
        tag: 'content', status: 'pending' as const,
      },
      {
        course_id: courseId, gate_id: sortedGates[0]?.id, type: 'gate_delay' as const,
        title: `Extend ${sortedGates[0]?.title} by one session`,
        description: 'Foundation gate mastery is critical. Currently at 68% class average — below the 75% threshold. One extra session focused on Apply-level exercises would solidify the foundation.',
        rationale: 'Gate 1 concepts are prerequisites for 5 downstream gates. A weak foundation here cascades through the entire course.',
        tag: 'foundation', status: 'accepted' as const,
      },
    ];
    await db.from('ai_suggestions').insert(suggestionInserts);
    console.log(`  Added ${suggestionInserts.length} AI suggestions`);

    console.log(`  ✓ ${course.title} complete`);
  }

  return { students: studentIds.length, attempts: totalAttempts, progress: totalProgress };
}
