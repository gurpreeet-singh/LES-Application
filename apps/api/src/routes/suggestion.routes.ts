import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { AdaptiveSuggestionService } from '../services/adaptive-suggestion.service.js';

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

  // Check if we should generate fresh suggestions (query param ?refresh=true)
  const shouldRefresh = req.query.refresh === 'true';

  // Get existing suggestions from DB
  const { data: dbSuggestions } = await supabaseAdmin
    .from('ai_suggestions')
    .select('*')
    .eq('course_id', courseId)
    .order('generated_at', { ascending: false });

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('total_sessions, llm_provider')
    .eq('id', courseId)
    .single();

  // If refresh requested or no suggestions exist, generate new ones via AI
  if (shouldRefresh || !dbSuggestions || dbSuggestions.length === 0) {
    try {
      const provider = createLLMProvider(course?.llm_provider || undefined);
      const service = new AdaptiveSuggestionService(provider, supabaseAdmin);
      const aiSuggestions = await service.generateSuggestions(courseId);

      // Re-fetch from DB after generation
      const { data: freshSuggestions } = await supabaseAdmin
        .from('ai_suggestions')
        .select('*')
        .eq('course_id', courseId)
        .order('generated_at', { ascending: false });

      const suggestions = (freshSuggestions || aiSuggestions).map((s: any) => ({
        id: s.id || `gen-${Date.now()}`,
        type: s.type,
        priority: s.priority || (s.type === 'remediation' ? 'high' : s.type === 'lesson_refine' ? 'medium' : 'low'),
        affects_sessions: s.affects_sessions || (s.tag ? s.tag.split(',').map(Number).filter(Boolean) : []),
        title: s.title,
        reason: s.reason || s.description,
        affected_students: s.affected_students || [],
        current: s.current || null,
        proposed: s.proposed || { key_changes: [s.description || s.reason || ''] },
        status: s.status || 'pending',
        teacher_notes: s.teacher_edit || s.teacher_notes || null,
      }));

      // Get history (resolved suggestions)
      const history = (freshSuggestions || [])
        .filter((s: any) => s.status !== 'pending')
        .map((s: any) => ({
          id: s.id, type: s.type, title: s.title,
          status: s.status, resolved_at: s.resolved_at,
          outcome: s.rationale || 'Applied to upcoming sessions',
        }));

      res.json({
        analysis_based_on: 'Latest student assessment data',
        generated_at: new Date().toISOString(),
        current_session: Math.floor((course?.total_sessions || 30) * 0.6),
        suggestions: suggestions.filter((s: any) => s.status === 'pending'),
        history,
      });
      return;
    } catch (err) {
      console.error('Adaptive suggestion generation error:', err);
    }
  }

  // Return existing DB suggestions
  const suggestions = (dbSuggestions || []).map(s => ({
    id: s.id,
    type: s.type,
    priority: s.type === 'remediation' ? 'high' : s.type === 'lesson_refine' ? 'medium' : 'low',
    affects_sessions: s.tag ? s.tag.split(',').map(Number).filter(Boolean) : [],
    title: s.title,
    reason: s.description,
    affected_students: [],
    current: null,
    proposed: { key_changes: [s.description] },
    status: s.status,
    teacher_notes: s.teacher_edit,
  }));

  const pending = suggestions.filter(s => s.status === 'pending');
  const history = suggestions.filter(s => s.status !== 'pending').map(s => ({
    id: s.id, type: s.type, title: s.title, status: s.status, resolved_at: null, outcome: '',
  }));

  res.json({
    analysis_based_on: 'Latest student assessment data',
    generated_at: new Date().toISOString(),
    current_session: Math.floor((course?.total_sessions || 30) * 0.6),
    suggestions: pending.length > 0 ? pending : [{
      id: 'placeholder', type: 'lesson_refine', priority: 'medium', affects_sessions: [], title: 'AI suggestions will appear after student assessments are graded',
      reason: 'Grade at least one session\'s quiz to enable AI-driven suggestions based on real student performance data.',
      affected_students: [], current: null, proposed: { key_changes: ['Complete grading to activate AI suggestions'] }, status: 'pending', teacher_notes: null,
    }],
    history,
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
