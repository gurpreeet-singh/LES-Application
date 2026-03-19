import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/lessons
router.get('/', async (req: Request, res: Response) => {
  const { gate_id } = req.query;

  let query = supabaseAdmin
    .from('lessons')
    .select('*, socratic_scripts(*)')
    .eq('course_id', req.params.courseId)
    .order('sort_order');

  if (gate_id) {
    query = query.eq('gate_id', gate_id as string);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ lessons: data });
});

// GET /courses/:courseId/lessons/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('*, socratic_scripts(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }

  res.json({ lesson: data });
});

// PUT /courses/:courseId/lessons/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, objective, key_idea, conceptual_breakthrough, bloom_levels, examples, exercises, duration_minutes, teacher_notes } = req.body;

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update({
      title, objective, key_idea, conceptual_breakthrough,
      bloom_levels, examples, exercises, duration_minutes, teacher_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ lesson: data });
});

// PUT /courses/:courseId/lessons/:id/status
router.put('/:id/status', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!['draft', 'accepted', 'edited', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ lesson: data });
});

export default router;
