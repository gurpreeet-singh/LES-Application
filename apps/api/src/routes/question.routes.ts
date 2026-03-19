import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/questions
router.get('/', async (req: Request, res: Response) => {
  const { gate_id, bloom_level, type, is_diagnostic } = req.query;

  let query = supabaseAdmin
    .from('questions')
    .select('*')
    .eq('course_id', req.params.courseId)
    .neq('status', 'rejected')
    .order('gate_id')
    .order('bloom_level');

  if (gate_id) query = query.eq('gate_id', gate_id as string);
  if (bloom_level) query = query.eq('bloom_level', bloom_level as string);
  if (type) query = query.eq('question_type', type as string);
  if (is_diagnostic === 'true') query = query.eq('is_diagnostic', true);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ questions: data });
});

// PUT /courses/:courseId/questions/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { question_text, options, correct_answer, rubric, explanation, bloom_level } = req.body;

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({ question_text, options, correct_answer, rubric, explanation, bloom_level })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ question: data });
});

// PUT /courses/:courseId/questions/:id/status
router.put('/:id/status', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status } = req.body;

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ question: data });
});

export default router;
