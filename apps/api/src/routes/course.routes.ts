import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/role.js';
import { supabaseAdmin } from '../config/supabase.js';
import { DeconstructionService } from '../services/deconstruction.service.js';
import { QuizGenerationService } from '../services/quiz-generation.service.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { SessionPlannerService } from '../services/session-planner.service.js';

const router = Router();

// GET /courses
router.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  let query;

  if (user.role === 'teacher') {
    query = supabaseAdmin.from('courses').select('*').eq('teacher_id', user.id);
  } else {
    query = supabaseAdmin
      .from('courses')
      .select('*, enrollments!inner(student_id)')
      .eq('enrollments.student_id', user.id)
      .eq('status', 'active');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ courses: data });
});

// POST /courses
router.post('/', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, subject, class_level, section, academic_year } = req.body;

  if (!title || !subject) {
    res.status(400).json({ error: 'title and subject are required' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert({
      teacher_id: req.user!.id,
      title,
      subject,
      class_level,
      section,
      academic_year,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ course: data });
});

// GET /courses/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  res.json({ course: data });
});

// PUT /courses/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, subject, class_level, section, academic_year } = req.body;

  const { data, error } = await supabaseAdmin
    .from('courses')
    .update({ title, subject, class_level, section, academic_year, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ course: data });
});

// POST /courses/:id/syllabus — Upload syllabus text + timetable config
router.post('/:id/syllabus', requireRole('teacher'), async (req: Request, res: Response) => {
  const { syllabus_text, llm_provider, llm_model, total_sessions, session_duration_minutes } = req.body;

  if (!syllabus_text) {
    res.status(400).json({ error: 'syllabus_text is required' });
    return;
  }

  const updates: Record<string, unknown> = {
    syllabus_text,
    updated_at: new Date().toISOString(),
  };
  if (llm_provider) updates.llm_provider = llm_provider;
  if (llm_model) updates.llm_model = llm_model;
  if (total_sessions) updates.total_sessions = total_sessions;
  if (session_duration_minutes) updates.session_duration_minutes = session_duration_minutes;

  const { data, error } = await supabaseAdmin
    .from('courses')
    .update(updates)
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ course: data });
});

// POST /courses/:id/syllabus/upload — File upload (text extraction placeholder)
router.post('/:id/syllabus/upload', requireRole('teacher'), async (req: Request, res: Response) => {
  const { filename } = req.body;

  // For now, just acknowledge the upload. In production, this would:
  // 1. Accept multipart file upload
  // 2. Extract text from PDF/DOCX using a library
  // 3. Store the extracted text as syllabus_text

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('syllabus_text')
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id)
    .single();

  const extractedText = course?.syllabus_text || `[Uploaded file: ${filename || 'document'}. Text extraction pending.]`;

  res.json({
    course: course,
    extracted_text: extractedText,
    filename: filename || 'uploaded_file',
  });
});

// POST /courses/:id/process — Trigger LLM deconstruction (SSE)
router.post('/:id/process', requireRole('teacher'), async (req: Request, res: Response) => {
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id)
    .single();

  if (error || !course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  if (!course.syllabus_text) {
    res.status(400).json({ error: 'No syllabus text uploaded yet' });
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Update status
    await supabaseAdmin
      .from('courses')
      .update({ status: 'processing', processing_started_at: new Date().toISOString(), processing_error: null })
      .eq('id', course.id);

    const provider = createLLMProvider(course.llm_provider || 'anthropic');
    const service = new DeconstructionService(provider, supabaseAdmin);

    await service.processSyllabus(
      course.id,
      course.syllabus_text,
      (step, name, status) => { sendEvent({ type: 'step', step, name, status }); },
      course.total_sessions || undefined,
      course.session_duration_minutes || undefined,
    );

    // Generate quizzes for each lesson
    sendEvent({ type: 'step', step: 11, name: 'Generating Quiz Questions', status: 'processing' });
    try {
      const quizService = new QuizGenerationService(provider, supabaseAdmin);
      await quizService.generateQuizzesForCourse(course.id, (msg) => {
        sendEvent({ type: 'step', step: 11, name: msg, status: 'processing' });
      });
      sendEvent({ type: 'step', step: 11, name: 'Quiz Questions Generated', status: 'complete' });
    } catch (quizErr) {
      console.error('Quiz generation failed (non-fatal):', quizErr);
      sendEvent({ type: 'step', step: 11, name: 'Quiz generation skipped', status: 'complete' });
    }

    sendEvent({ type: 'complete' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await supabaseAdmin
      .from('courses')
      .update({ status: 'draft', processing_error: message })
      .eq('id', course.id);
    sendEvent({ type: 'error', error: message });
  } finally {
    res.end();
  }
});

// POST /courses/:id/finalize
router.post('/:id/finalize', requireRole('teacher'), async (req: Request, res: Response) => {
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id)
    .single();

  if (error || !course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  if (course.status !== 'review') {
    res.status(400).json({ error: 'Course must be in review status to finalize' });
    return;
  }

  // Check that all gates are accepted
  const { data: draftGates } = await supabaseAdmin
    .from('gates')
    .select('id')
    .eq('course_id', course.id)
    .eq('status', 'draft');

  if (draftGates && draftGates.length > 0) {
    res.status(400).json({ error: `${draftGates.length} gates still need review` });
    return;
  }

  // Set course active
  const { data, error: updateError } = await supabaseAdmin
    .from('courses')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', course.id)
    .select()
    .single();

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Create initial progress for enrolled students
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('course_id', course.id);

  const { data: gates } = await supabaseAdmin
    .from('gates')
    .select('id, gate_number')
    .eq('course_id', course.id)
    .eq('status', 'accepted');

  const { data: prereqs } = await supabaseAdmin
    .from('gate_prerequisites')
    .select('gate_id')
    .in('gate_id', (gates || []).map(g => g.id));

  const gatesWithPrereqs = new Set((prereqs || []).map(p => p.gate_id));

  if (enrollments && gates) {
    const progressRows = enrollments.flatMap(e =>
      gates.map(g => ({
        student_id: e.student_id,
        gate_id: g.id,
        course_id: course.id,
        is_unlocked: !gatesWithPrereqs.has(g.id),
      }))
    );

    if (progressRows.length > 0) {
      await supabaseAdmin.from('student_gate_progress').upsert(progressRows, {
        onConflict: 'student_id,gate_id',
      });
    }
  }

  // Auto-generate timetable if configured
  if (course.total_sessions) {
    try {
      const planner = new SessionPlannerService(supabaseAdmin);
      await planner.generateSessionPlan(course.id);
    } catch (err) {
      // Non-fatal: timetable generation failure shouldn't block finalization
      console.error('Timetable generation error:', err);
    }
  }

  res.json({ course: data });
});

// GET /courses/:id/timetable — Get full session plan
router.get('/:id/timetable', async (req: Request, res: Response) => {
  const { data: sessions, error } = await supabaseAdmin
    .from('session_plan')
    .select('*, lesson:lessons(*)')
    .eq('course_id', req.params.id)
    .order('session_number', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Attach questions for each session's lesson
  const lessonIds = [...new Set((sessions || []).map(s => s.lesson?.gate_id).filter(Boolean))];
  let questionsMap: Record<string, any[]> = {};

  if (lessonIds.length > 0) {
    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('course_id', req.params.id)
      .in('gate_id', lessonIds)
      .in('status', ['accepted', 'edited']);

    if (questions) {
      for (const q of questions) {
        if (!questionsMap[q.gate_id]) questionsMap[q.gate_id] = [];
        questionsMap[q.gate_id].push(q);
      }
    }
  }

  const sessionsWithQuestions = (sessions || []).map(s => ({
    ...s,
    questions: s.lesson?.gate_id ? (questionsMap[s.lesson.gate_id] || []) : [],
  }));

  res.json({ sessions: sessionsWithQuestions });
});

// GET /courses/:id/timetable/:sessionNum — Get single session detail
router.get('/:id/timetable/:sessionNum', async (req: Request, res: Response) => {
  const { data: session, error } = await supabaseAdmin
    .from('session_plan')
    .select('*, lesson:lessons(*, socratic_scripts(*))')
    .eq('course_id', req.params.id)
    .eq('session_number', parseInt(req.params.sessionNum as string))
    .single();

  if (error || !session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Get questions for this lesson's gate
  let questions: any[] = [];
  if (session.lesson?.gate_id) {
    const { data } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('gate_id', session.lesson.gate_id)
      .eq('course_id', req.params.id)
      .in('status', ['accepted', 'edited']);
    questions = data || [];
  }

  res.json({ session: { ...session, questions } });
});

// POST /courses/:id/timetable/generate — Regenerate session plan
router.post('/:id/timetable/generate', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const planner = new SessionPlannerService(supabaseAdmin);
    await planner.generateSessionPlan(req.params.id as string);

    const { data: sessions } = await supabaseAdmin
      .from('session_plan')
      .select('*, lesson:lessons(*)')
      .eq('course_id', req.params.id)
      .order('session_number', { ascending: true });

    res.json({ sessions: sessions || [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate timetable' });
  }
});

// POST /courses/:id/enroll
router.post('/:id/enroll', requireRole('teacher'), async (req: Request, res: Response) => {
  const { student_emails } = req.body;

  if (!Array.isArray(student_emails) || student_emails.length === 0) {
    res.status(400).json({ error: 'student_emails array is required' });
    return;
  }

  const { data: students } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', student_emails)
    .eq('role', 'student');

  if (!students || students.length === 0) {
    res.status(404).json({ error: 'No matching student accounts found' });
    return;
  }

  const enrollments = students.map(s => ({
    course_id: req.params.id,
    student_id: s.id,
  }));

  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .upsert(enrollments, { onConflict: 'course_id,student_id' })
    .select();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ enrolled: data, found: students.length, requested: student_emails.length });
});

export default router;
