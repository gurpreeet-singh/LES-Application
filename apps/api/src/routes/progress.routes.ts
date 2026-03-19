import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router({ mergeParams: true });

// GET /students/:studentId/progress?course_id=xxx
router.get('/', async (req: Request, res: Response) => {
  const { course_id } = req.query;
  const studentId = req.params.studentId;

  // Only allow students to see their own progress, or teachers to see enrolled students
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

  // Also get learning profile
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

// POST /students/:studentId/progress/attempt
router.post('/attempt', async (req: Request, res: Response) => {
  const studentId = req.params.studentId;
  const { question_id, gate_id, answer_text, time_spent_seconds } = req.body;

  if (req.user!.id !== studentId) {
    res.status(403).json({ error: 'Can only submit own attempts' });
    return;
  }

  // Get the question
  const { data: question, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', question_id)
    .single();

  if (qErr || !question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  // Simple evaluation (for now — will be replaced with AI evaluation)
  let is_correct = false;
  let score = 0;

  if (question.question_type === 'mcq' && question.options) {
    const correctOption = question.options.find((o: { is_correct: boolean }) => o.is_correct);
    is_correct = correctOption?.text === answer_text;
    score = is_correct ? 100 : 0;
  }

  // Record attempt
  const { data: attempt, error } = await supabaseAdmin
    .from('question_attempts')
    .insert({
      student_id: studentId,
      question_id,
      gate_id,
      answer_text,
      is_correct,
      score,
      bloom_level_demonstrated: question.bloom_level,
      time_spent_seconds,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Update gate progress (simplified — recalculate from all attempts)
  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('score, bloom_level_demonstrated')
    .eq('student_id', studentId)
    .eq('gate_id', gate_id);

  if (attempts && attempts.length > 0) {
    const avgScore = Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length);

    await supabaseAdmin
      .from('student_gate_progress')
      .update({
        mastery_pct: avgScore,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('gate_id', gate_id);
  }

  res.json({ attempt });
});

export default router;
