import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { GradingService } from '../services/grading.service.js';

const router = Router({ mergeParams: true });

// GET /students/:studentId/progress?course_id=xxx
router.get('/', async (req: Request, res: Response) => {
  const { course_id } = req.query;
  const studentId = req.params.studentId;

  if (req.user!.role === 'student' && req.user!.id !== studentId) {
    res.status(403).json({ error: 'Cannot view other student progress' });
    return;
  }

  let query = supabaseAdmin
    .from('student_gate_progress')
    .select('*, gate:gate_id(id, gate_number, title, short_title, color)')
    .eq('student_id', studentId);

  if (course_id) {
    query = query.eq('course_id', course_id as string);
  }

  const { data, error } = await query.order('gate(gate_number)');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let profileQuery = supabaseAdmin
    .from('learning_profiles')
    .select('*')
    .eq('student_id', studentId);

  if (course_id) {
    profileQuery = profileQuery.eq('course_id', course_id as string);
  }

  const { data: profile } = await profileQuery.single();

  res.json({ progress: data, learning_profile: profile });
});

// POST /students/:studentId/progress/attempt — Single question attempt
router.post('/attempt', async (req: Request, res: Response) => {
  const studentId = req.params.studentId;
  const { question_id, gate_id, answer_text, time_spent_seconds } = req.body;

  if (req.user!.id !== studentId) {
    res.status(403).json({ error: 'Can only submit own attempts' });
    return;
  }

  const { data: question, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', question_id)
    .single();

  if (qErr || !question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  // Auto-grade MCQ and True/False
  let is_correct = false;
  let score = 0;
  let ai_feedback = '';

  if (question.question_type === 'mcq' || question.question_type === 'true_false') {
    if (question.options) {
      const correctOption = question.options.find((o: { is_correct: boolean }) => o.is_correct);
      is_correct = correctOption?.text?.toLowerCase().trim() === answer_text?.toLowerCase().trim();
    }
    score = is_correct ? 100 : 0;
    ai_feedback = is_correct ? 'Correct!' : `Incorrect. The correct answer is: ${question.correct_answer || ''}`;
  } else {
    // For subjective: use AI grading
    try {
      const provider = createLLMProvider();
      const gradingService = new GradingService(provider, supabaseAdmin);
      const results = await gradingService.gradeStudentAnswers(studentId, question.course_id, gate_id, [{
        question_id, question_number: 1, question_text: question.question_text,
        question_type: question.question_type, correct_answer: question.correct_answer || '',
        rubric: question.rubric || '', max_score: question.question_type === 'short_answer' ? 4 : 5,
        student_answer: answer_text, options: question.options,
      }]);
      if (results.length > 0) {
        score = Math.round((results[0].score / results[0].max_score) * 100);
        is_correct = results[0].score === results[0].max_score;
        ai_feedback = results[0].feedback;
      }
    } catch {
      score = 50; // Fallback
      ai_feedback = 'AI grading unavailable. Score set to 50%. Please review manually.';
    }
  }

  const { data: attempt, error } = await supabaseAdmin
    .from('question_attempts')
    .insert({
      student_id: studentId, question_id, gate_id, answer_text,
      is_correct, score, bloom_level_demonstrated: question.bloom_level,
      time_spent_seconds, ai_feedback,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Update gate progress
  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('score, bloom_level_demonstrated')
    .eq('student_id', studentId)
    .eq('gate_id', gate_id);

  if (attempts && attempts.length > 0) {
    const avgScore = Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length);
    await supabaseAdmin
      .from('student_gate_progress')
      .upsert({
        student_id: studentId, gate_id, course_id: question.course_id,
        mastery_pct: avgScore, last_attempt_at: new Date().toISOString(),
        is_unlocked: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,gate_id' });
  }

  res.json({ attempt: { ...attempt, ai_feedback } });
});

// POST /courses/:courseId/lessons/:lessonId/scores — Manual score entry from teacher
router.post('/scores', requireRole('teacher'), async (req: Request, res: Response) => {
  const { scores: studentScores } = req.body;
  if (!Array.isArray(studentScores)) {
    res.status(400).json({ error: 'scores array required' });
    return;
  }

  let savedCount = 0;
  for (const entry of studentScores) {
    const { student_id, question_scores } = entry;
    if (!student_id || !Array.isArray(question_scores)) continue;

    for (const qs of question_scores) {
      await supabaseAdmin.from('question_attempts').insert({
        student_id,
        question_id: qs.question_id,
        gate_id: qs.gate_id || '',
        answer_text: `Score: ${qs.score}`,
        is_correct: qs.score > 0,
        score: qs.score,
        bloom_level_demonstrated: 'remember',
      });
      savedCount++;
    }

    // Get the gate_id from first question
    if (question_scores.length > 0) {
      const { data: q } = await supabaseAdmin.from('questions').select('gate_id, course_id').eq('id', question_scores[0].question_id).single();
      if (q) {
        const totalScore = question_scores.reduce((a: number, qs: any) => a + (qs.score || 0), 0);
        const maxPossible = question_scores.length * 5; // approximate
        const pct = Math.round((totalScore / maxPossible) * 100);
        await supabaseAdmin.from('student_gate_progress').upsert({
          student_id, gate_id: q.gate_id, course_id: q.course_id,
          mastery_pct: Math.min(100, pct), is_unlocked: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id,gate_id' });
      }
    }
  }

  res.json({ saved: savedCount, message: `Scores saved for ${studentScores.length} students.` });
});

// POST /courses/:courseId/lessons/:lessonId/grade — Bulk grade a session (teacher submits scores)
router.post('/grade', requireRole('teacher'), async (req: Request, res: Response) => {
  const { student_scores } = req.body;
  // student_scores: [{ student_id, answers: [{ question_id, answer_text }] }]

  if (!Array.isArray(student_scores)) {
    res.status(400).json({ error: 'student_scores array is required' });
    return;
  }

  const results: any[] = [];
  const provider = createLLMProvider();
  const gradingService = new GradingService(provider, supabaseAdmin);

  for (const student of student_scores) {
    // Get questions for this lesson
    const questionIds = student.answers.map((a: any) => a.question_id);
    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select('*')
      .in('id', questionIds);

    if (!questions) continue;

    const marksPerType: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

    const answersForGrading = student.answers.map((a: any, i: number) => {
      const q = questions.find((q: any) => q.id === a.question_id);
      return {
        question_id: a.question_id,
        question_number: i + 1,
        question_text: q?.question_text || '',
        question_type: q?.question_type || 'mcq',
        correct_answer: q?.correct_answer || '',
        rubric: q?.rubric || '',
        max_score: marksPerType[q?.question_type || 'mcq'] || 2,
        student_answer: a.answer_text,
        options: q?.options,
      };
    });

    const gate_id = questions[0]?.gate_id;
    const course_id = questions[0]?.course_id;

    if (gate_id && course_id) {
      const gradeResults = await gradingService.gradeStudentAnswers(
        student.student_id, course_id, gate_id, answersForGrading
      );
      results.push({
        student_id: student.student_id,
        results: gradeResults,
        total_score: gradeResults.reduce((a, r) => a + r.score, 0),
        max_score: gradeResults.reduce((a, r) => a + r.max_score, 0),
      });
    }
  }

  res.json({ grades: results });
});

export default router;
