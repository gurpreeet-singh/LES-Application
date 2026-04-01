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

// GET /courses/:courseId/lessons/:id/prep — Pre-class prep content (Data/Information level only)
router.get('/:id/prep', async (req: Request, res: Response) => {
  const { data: lesson } = await supabaseAdmin
    .from('lessons').select('id, title, objective, key_idea, examples, bloom_levels, gate_id, lesson_number')
    .eq('id', req.params.id).single();
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  // Get 5 Remember/Understand questions for readiness check
  const { data: allQuestions } = await supabaseAdmin
    .from('questions').select('id, question_text, question_type, bloom_level, options, correct_answer')
    .eq('gate_id', lesson.gate_id).eq('course_id', req.params.courseId)
    .in('bloom_level', ['remember', 'understand'])
    .limit(20);

  // Round-robin to get this lesson's share, take max 5
  const { data: gateLessons } = await supabaseAdmin
    .from('lessons').select('id').eq('gate_id', lesson.gate_id).eq('course_id', req.params.courseId).order('lesson_number');
  const idx = (gateLessons || []).findIndex(l => l.id === lesson.id);
  const count = (gateLessons || []).length || 1;
  const myQuestions = (allQuestions || []).filter((_: any, qi: number) => qi % count === idx).slice(0, 5);

  // Check if student already completed prep
  let prepStatus = null;
  if (req.user) {
    const { data: progress } = await supabaseAdmin
      .from('student_gate_progress')
      .select('prep_score, prep_completed_at')
      .eq('student_id', req.user.id).eq('gate_id', lesson.gate_id).eq('course_id', req.params.courseId)
      .single();
    prepStatus = progress;
  }

  res.json({
    lesson: { id: lesson.id, title: lesson.title, objective: lesson.objective, key_idea: lesson.key_idea, examples: lesson.examples, lesson_number: lesson.lesson_number },
    readiness_questions: myQuestions,
    prep_status: prepStatus,
  });
});

// POST /courses/:courseId/lessons/:id/prep/submit — Record readiness check score
router.post('/:id/prep/submit', async (req: Request, res: Response) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { score } = req.body;
  if (score === undefined) { res.status(400).json({ error: 'score required' }); return; }

  const { data: lesson } = await supabaseAdmin
    .from('lessons').select('gate_id').eq('id', req.params.id).single();
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  await supabaseAdmin
    .from('student_gate_progress')
    .upsert({
      student_id: req.user.id,
      gate_id: lesson.gate_id,
      course_id: req.params.courseId,
      prep_score: score,
      prep_completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,gate_id' });

  res.json({ message: 'Prep score recorded', score });
});

export default router;
