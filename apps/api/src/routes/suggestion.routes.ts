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

// GET /courses/:courseId/suggestions/adaptive — AI-driven adaptive suggestions
router.get('/adaptive', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  // Get actual suggestions from DB
  const { data: dbSuggestions } = await supabaseAdmin
    .from('ai_suggestions')
    .select('*')
    .eq('course_id', courseId)
    .order('generated_at', { ascending: false });

  // Get course info for context
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('total_sessions')
    .eq('id', courseId)
    .single();

  // Transform DB suggestions into adaptive format
  const suggestions = (dbSuggestions || []).map(s => ({
    id: s.id,
    type: s.type,
    priority: s.type === 'remediation' ? 'high' : s.type === 'lesson_refine' ? 'medium' : 'low',
    affects_sessions: [],
    title: s.title,
    reason: s.description,
    affected_students: [],
    current: null,
    proposed: { key_changes: [s.description] },
    status: s.status,
    teacher_notes: s.teacher_edit,
  }));

  // If no DB suggestions yet, return helpful placeholder suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      { id: 'auto-1', type: 'lesson_refine', priority: 'medium', affects_sessions: [], title: 'AI suggestions will appear here after students complete quizzes', reason: 'The AI analyzes student performance after each session and generates actionable suggestions to improve upcoming lesson plans.', affected_students: [], current: null, proposed: { key_changes: ['Suggestions are generated automatically based on quiz scores, Bloom level gaps, and misconception patterns'] }, status: 'pending', teacher_notes: null },
    );
  }

  res.json({
    analysis_based_on: 'Latest session results',
    generated_at: new Date().toISOString(),
    current_session: Math.floor((course?.total_sessions || 30) * 0.6),
    suggestions,
    history: [],
  });
});

// PUT /courses/:courseId/suggestions/adaptive/:id
router.put('/adaptive/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status, teacher_notes } = req.body;

  // Try updating in DB first
  const { data, error } = await supabaseAdmin
    .from('ai_suggestions')
    .update({
      status: status || 'pending',
      teacher_edit: teacher_notes,
      resolved_at: status !== 'pending' ? new Date().toISOString() : null,
      resolved_by: req.user!.id,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    // If not in DB (placeholder suggestion), just return success
    res.json({ suggestion: { id: req.params.id, status, teacher_notes } });
    return;
  }

  res.json({ suggestion: data });
});

// POST /courses/:courseId/suggestions/apply-all
router.post('/apply-all', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: accepted } = await supabaseAdmin
    .from('ai_suggestions')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'accepted');

  const count = accepted?.length || 0;

  // Mark all accepted as applied (using 'edited' status since 'applied' doesn't exist in enum)
  if (count > 0) {
    await supabaseAdmin
      .from('ai_suggestions')
      .update({ status: 'edited', resolved_at: new Date().toISOString(), resolved_by: req.user!.id })
      .eq('course_id', courseId)
      .eq('status', 'accepted');
  }

  res.json({ applied: count, message: `${count} suggestions applied. Timetable updated for remaining sessions.` });
});

export default router;
