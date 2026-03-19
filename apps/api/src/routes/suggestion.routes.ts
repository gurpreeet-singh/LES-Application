import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/suggestions
router.get('/', requireRole('teacher'), async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('ai_suggestions')
    .select('*')
    .eq('course_id', req.params.courseId)
    .order('generated_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ suggestions: data });
});

// PUT /courses/:courseId/suggestions/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status, teacher_edit } = req.body;

  if (!['pending', 'accepted', 'edited', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const updates: Record<string, unknown> = {
    status,
    resolved_at: status !== 'pending' ? new Date().toISOString() : null,
    resolved_by: status !== 'pending' ? req.user!.id : null,
  };
  if (teacher_edit !== undefined) updates.teacher_edit = teacher_edit;

  const { data, error } = await supabaseAdmin
    .from('ai_suggestions')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ suggestion: data });
});

export default router;
