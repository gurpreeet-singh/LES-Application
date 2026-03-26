import type { SupabaseClient } from '@supabase/supabase-js';

// Student performance profiles — consistent across all quizzes (bell curve)
const STUDENT_PROFILES: Record<string, { accuracy: number; bloomCeiling: string; strengths: string[]; weaknesses: string[] }> = {
  'Aarav M.':  { accuracy: 0.92, bloomCeiling: 'evaluate', strengths: ['remember', 'understand', 'apply'], weaknesses: ['create'] },
  'Priya S.':  { accuracy: 0.85, bloomCeiling: 'analyze',  strengths: ['remember', 'understand'], weaknesses: ['evaluate', 'create'] },
  'Kabir R.':  { accuracy: 0.72, bloomCeiling: 'apply',    strengths: ['remember'], weaknesses: ['analyze', 'evaluate', 'create'] },
  'Sia P.':    { accuracy: 0.78, bloomCeiling: 'apply',    strengths: ['remember', 'understand', 'apply'], weaknesses: ['analyze', 'create'] },
  'Aryan S.':  { accuracy: 0.55, bloomCeiling: 'understand', strengths: ['remember'], weaknesses: ['apply', 'analyze', 'evaluate', 'create'] },
  'Meera T.':  { accuracy: 0.65, bloomCeiling: 'apply',    strengths: ['remember', 'understand'], weaknesses: ['analyze', 'evaluate'] },
  'Rohan K.':  { accuracy: 0.88, bloomCeiling: 'evaluate', strengths: ['remember', 'understand', 'apply', 'analyze'], weaknesses: ['create'] },
  'Anaya D.':  { accuracy: 0.42, bloomCeiling: 'remember', strengths: [], weaknesses: ['understand', 'apply', 'analyze', 'evaluate', 'create'] },
};

const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const MARKS: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

const MISCONCEPTIONS: Record<string, string[]> = {
  remember: ['Confuses terminology', 'Mixes up definitions', 'Cannot recall formula'],
  understand: ['Applies rule mechanically without understanding why', 'Confuses cause and effect', 'Misinterprets the question context'],
  apply: ['Selects wrong operation for word problem', 'Calculation error in multi-step problem', 'Fails to convert units before computing'],
  analyze: ['Cannot identify which information is relevant', 'Misses hidden assumptions in the problem', 'Fails to break problem into sub-steps'],
  evaluate: ['Cannot justify choice of method', 'Accepts answer without verification', 'Fails to consider alternative approaches'],
  create: ['Solution lacks originality', 'Problem designed is trivially simple', 'Cannot extend concept to new context'],
};

function shouldGetCorrect(profile: typeof STUDENT_PROFILES[string], bloomLevel: string, questionIndex: number): boolean {
  const bloomIdx = BLOOM_ORDER.indexOf(bloomLevel);
  const ceilingIdx = BLOOM_ORDER.indexOf(profile.bloomCeiling);

  // Base probability from accuracy profile
  let prob = profile.accuracy;

  // Reduce probability for questions above bloom ceiling
  if (bloomIdx > ceilingIdx) {
    prob *= Math.max(0.1, 1 - (bloomIdx - ceilingIdx) * 0.25);
  }

  // Slight variation per question (deterministic based on index)
  const noise = ((questionIndex * 7 + bloomIdx * 13) % 20 - 10) / 100;
  prob = Math.max(0.05, Math.min(0.98, prob + noise));

  // Deterministic: use a hash-like function
  const hash = ((questionIndex + 1) * 31 + bloomIdx * 17) % 100;
  return hash < prob * 100;
}

export async function seedDemoQuizResponses(db: SupabaseClient, courseId: string): Promise<number> {
  // Get students
  const { data: enrollments } = await db
    .from('enrollments')
    .select('student_id, profiles:student_id(id, full_name)')
    .eq('course_id', courseId);

  if (!enrollments || enrollments.length === 0) return 0;

  // Get all questions grouped by gate
  const { data: questions } = await db
    .from('questions')
    .select('id, gate_id, question_text, question_type, bloom_level, correct_answer, options')
    .eq('course_id', courseId)
    .order('gate_id')
    .order('bloom_level');

  if (!questions || questions.length === 0) return 0;

  // Get gates
  const { data: gates } = await db
    .from('gates')
    .select('id, gate_number, title')
    .eq('course_id', courseId)
    .order('sort_order');

  if (!gates) return 0;

  // Clear existing attempts for this course's gates
  const gateIds = gates.map(g => g.id);
  await db.from('question_attempts').delete().in('gate_id', gateIds);

  // Generate attempts for each student × each question
  const attempts: any[] = [];
  let totalInserted = 0;

  for (const enrollment of enrollments) {
    const studentName = (enrollment as any).profiles?.full_name || 'Unknown';
    const profile = STUDENT_PROFILES[studentName] || STUDENT_PROFILES['Kabir R.']; // default to middle performer

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const bloomLevel = q.bloom_level || 'remember';
      const maxScore = MARKS[q.question_type] || 2;
      const isCorrect = shouldGetCorrect(profile, bloomLevel, qi);

      // Generate realistic answer text
      let answerText: string;
      let score: number;
      let feedback: string;
      let misconception: string | null = null;

      if (q.question_type === 'mcq' || q.question_type === 'true_false') {
        if (isCorrect) {
          const correctOpt = q.options?.find((o: any) => o.is_correct);
          answerText = correctOpt?.text || q.correct_answer || 'Correct';
          score = maxScore;
          feedback = 'Correct!';
        } else {
          const wrongOpts = (q.options || []).filter((o: any) => !o.is_correct);
          answerText = wrongOpts.length > 0 ? wrongOpts[qi % wrongOpts.length]?.text || 'Wrong answer' : 'Incorrect';
          score = 0;
          const misconceptions = MISCONCEPTIONS[bloomLevel] || MISCONCEPTIONS.remember;
          misconception = misconceptions[qi % misconceptions.length];
          feedback = `Incorrect. ${misconception}. The correct answer is: ${q.correct_answer || 'See model answer'}`;
        }
      } else {
        // Subjective questions — partial scores
        if (isCorrect) {
          score = maxScore;
          answerText = `[Strong answer demonstrating ${bloomLevel}-level understanding of ${q.question_text.slice(0, 30)}...]`;
          feedback = `Excellent ${bloomLevel}-level response. Shows clear understanding.`;
        } else {
          // Partial credit based on how close they are to their ceiling
          const bloomIdx = BLOOM_ORDER.indexOf(bloomLevel);
          const ceilingIdx = BLOOM_ORDER.indexOf(profile.bloomCeiling);
          const partialRatio = bloomIdx <= ceilingIdx ? 0.6 : Math.max(0.1, 0.5 - (bloomIdx - ceilingIdx) * 0.15);
          score = Math.round(maxScore * partialRatio);
          const misconceptions = MISCONCEPTIONS[bloomLevel] || MISCONCEPTIONS.remember;
          misconception = misconceptions[qi % misconceptions.length];
          answerText = `[Partial answer showing ${BLOOM_ORDER[Math.min(bloomIdx, ceilingIdx)]}-level thinking]`;
          feedback = `Partial credit. ${misconception}. Try to develop your response further at the ${bloomLevel} level.`;
        }
      }

      // Determine bloom level demonstrated
      const bloomIdx = BLOOM_ORDER.indexOf(bloomLevel);
      const demonstratedIdx = isCorrect ? bloomIdx : Math.max(0, bloomIdx - 1);
      const bloomDemonstrated = BLOOM_ORDER[demonstratedIdx];

      attempts.push({
        student_id: enrollment.student_id,
        question_id: q.id,
        gate_id: q.gate_id,
        answer_text: answerText,
        is_correct: isCorrect,
        score: Math.round((score / maxScore) * 100),
        bloom_level_demonstrated: bloomDemonstrated,
        ai_feedback: feedback,
        misconceptions: misconception ? [{ misconception }] : null,
      });

      // Batch insert every 100
      if (attempts.length >= 100) {
        await db.from('question_attempts').insert(attempts);
        totalInserted += attempts.length;
        attempts.length = 0;
      }
    }
  }

  // Insert remaining
  if (attempts.length > 0) {
    await db.from('question_attempts').insert(attempts);
    totalInserted += attempts.length;
  }

  // Update student_gate_progress with recalculated bloom_scores
  for (const enrollment of enrollments) {
    for (const gate of gates) {
      const { data: gateAttempts } = await db
        .from('question_attempts')
        .select('score, bloom_level_demonstrated, is_correct')
        .eq('student_id', enrollment.student_id)
        .eq('gate_id', gate.id);

      if (!gateAttempts || gateAttempts.length === 0) continue;

      const avgScore = Math.round(gateAttempts.reduce((s, a) => s + a.score, 0) / gateAttempts.length);

      // Calculate bloom scores
      const bloomScores: Record<string, number> = {};
      for (const level of BLOOM_ORDER) {
        const levelAttempts = gateAttempts.filter(a => a.bloom_level_demonstrated === level);
        bloomScores[level] = levelAttempts.length > 0
          ? Math.round(levelAttempts.reduce((s, a) => s + a.score, 0) / levelAttempts.length)
          : 0;
      }

      await db.from('student_gate_progress').upsert({
        student_id: enrollment.student_id,
        gate_id: gate.id,
        course_id: courseId,
        mastery_pct: avgScore,
        bloom_scores: bloomScores,
        is_unlocked: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,gate_id' });
    }
  }

  return totalInserted;
}
