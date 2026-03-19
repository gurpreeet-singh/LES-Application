import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/kg — Full knowledge graph
router.get('/', async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const [gatesResult, edgesResult] = await Promise.all([
    supabaseAdmin
      .from('gates')
      .select('*, sub_concepts(*)')
      .eq('course_id', courseId)
      .neq('status', 'rejected')
      .order('sort_order'),
    supabaseAdmin
      .from('gate_prerequisites')
      .select('*, gate:gate_id(id, gate_number), prerequisite:prerequisite_gate_id(id, gate_number)')
      .in('gate_id',
        (await supabaseAdmin.from('gates').select('id').eq('course_id', courseId)).data?.map(g => g.id) || []
      ),
  ]);

  if (gatesResult.error) {
    res.status(500).json({ error: gatesResult.error.message });
    return;
  }

  res.json({
    course_id: courseId,
    gates: gatesResult.data,
    edges: edgesResult.data || [],
  });
});

// GET /courses/:courseId/kg/gates
router.get('/gates', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('gates')
    .select('*')
    .eq('course_id', req.params.courseId)
    .order('sort_order');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ gates: data });
});

// GET /courses/:courseId/kg/gates/:gateId
router.get('/gates/:gateId', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('gates')
    .select('*, sub_concepts(*), gate_bloom_targets(*)')
    .eq('id', req.params.gateId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Gate not found' });
    return;
  }

  res.json({ gate: data });
});

// PUT /courses/:courseId/kg/gates/:gateId
router.put('/gates/:gateId', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, short_title, period, color, light_color } = req.body;

  const { data, error } = await supabaseAdmin
    .from('gates')
    .update({ title, short_title, period, color, light_color, updated_at: new Date().toISOString() })
    .eq('id', req.params.gateId)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ gate: data });
});

// PUT /courses/:courseId/kg/gates/:gateId/status
router.put('/gates/:gateId/status', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!['draft', 'accepted', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be draft, accepted, or rejected' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('gates')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.gateId)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ gate: data });
});

// PUT /courses/:courseId/kg/sub-concepts/:id
router.put('/sub-concepts/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, description, status } = req.body;

  const updates: Record<string, unknown> = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status) updates.status = status;

  const { data, error } = await supabaseAdmin
    .from('sub_concepts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ sub_concept: data });
});

export default router;
