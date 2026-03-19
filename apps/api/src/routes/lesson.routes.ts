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

// GET /courses/:courseId/lessons/:id — with questions and gate context
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

  // Get questions for this lesson's gate
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('gate_id', data.gate_id)
    .eq('course_id', req.params.courseId)
    .order('bloom_level')
    .order('difficulty');

  // Get gate info
  const { data: gate } = await supabaseAdmin
    .from('gates')
    .select('*, sub_concepts(*)')
    .eq('id', data.gate_id)
    .single();

  // Distribute questions across lessons in this gate (10 per lesson)
  const { data: gateLessons } = await supabaseAdmin
    .from('lessons')
    .select('id, lesson_number')
    .eq('gate_id', data.gate_id)
    .eq('course_id', req.params.courseId)
    .order('lesson_number');

  let lessonQuestions = questions || [];
  if (gateLessons && gateLessons.length > 0 && lessonQuestions.length > 0) {
    const lessonIndex = gateLessons.findIndex((l: any) => l.id === data.id);
    if (lessonIndex >= 0) {
      const qPerLesson = Math.ceil(lessonQuestions.length / gateLessons.length);
      const start = lessonIndex * qPerLesson;
      lessonQuestions = lessonQuestions.slice(start, start + qPerLesson);
    }
  }

  res.json({ lesson: data, questions: lessonQuestions, gate });
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
