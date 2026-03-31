import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireRole } from '../middleware/role.js';
import { supabaseAdmin } from '../config/supabase.js';
import { DeconstructionService } from '../services/deconstruction.service.js';
import { QuizGenerationService } from '../services/quiz-generation.service.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { SessionPlannerService } from '../services/session-planner.service.js';
import { detectCrossCourseEdges } from '../services/cross-course-detection.service.js';
import { llmLimit } from '../middleware/rate-limit.js';

const syllabusUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
}).single('syllabus_file');

const router = Router();

// GET /courses — list only, excludes large syllabus_text field
router.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  const fields = 'id,teacher_id,title,subject,class_level,section,academic_year,status,llm_provider,mastery_threshold,total_sessions,session_duration_minutes,processing_error,processing_started_at,created_at,updated_at';
  let query;

  if (user.role === 'teacher') {
    query = supabaseAdmin.from('courses').select(fields).eq('teacher_id', user.id);
  } else {
    query = supabaseAdmin
      .from('courses')
      .select(`${fields}, enrollments!inner(student_id)`)
      .eq('enrollments.student_id', user.id)
      .eq('status', 'active');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Auto-recover courses stuck in 'processing' for more than 10 minutes
  if (data && user.role === 'teacher') {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const staleCourses = data.filter((c: any) => c.status === 'processing' && c.updated_at < staleThreshold);
    for (const sc of staleCourses) {
      await supabaseAdmin.from('courses').update({
        status: 'draft',
        processing_error: 'Processing timed out. Please try again.',
        updated_at: new Date().toISOString(),
      }).eq('id', sc.id);
      sc.status = 'draft';
      sc.processing_error = 'Processing timed out. Please try again.';
    }
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

// GET /courses/:id — only accessible by course teacher or enrolled students
router.get('/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const courseId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  // Authorization: teacher who owns it OR enrolled student
  if (data.teacher_id !== userId) {
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('course_id', courseId)
      .eq('student_id', userId)
      .single();

    if (!enrollment) {
      res.status(403).json({ error: 'Not authorized to view this course' });
      return;
    }
  }

  res.json({ course: data });
});

// DELETE /courses/:id
router.delete('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const teacherId = req.user!.id;

  // Verify ownership
  const { data: course } = await supabaseAdmin.from('courses').select('id').eq('id', courseId).eq('teacher_id', teacherId).single();
  if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

  // Delete in order: attempts → progress → enrollments → questions → sub_concepts → prerequisites → lessons → scripts → suggestions → session_plan → gates → course
  await supabaseAdmin.from('question_attempts').delete().in('gate_id', (await supabaseAdmin.from('gates').select('id').eq('course_id', courseId)).data?.map(g => g.id) || []);
  await supabaseAdmin.from('student_gate_progress').delete().eq('course_id', courseId);
  await supabaseAdmin.from('enrollments').delete().eq('course_id', courseId);
  await supabaseAdmin.from('questions').delete().eq('course_id', courseId);
  await supabaseAdmin.from('ai_suggestions').delete().eq('course_id', courseId);
  await supabaseAdmin.from('session_plan').delete().eq('course_id', courseId);

  const gateIds = (await supabaseAdmin.from('gates').select('id').eq('course_id', courseId)).data?.map(g => g.id) || [];
  if (gateIds.length > 0) {
    await supabaseAdmin.from('gate_prerequisites').delete().in('gate_id', gateIds);
    await supabaseAdmin.from('sub_concepts').delete().in('gate_id', gateIds);
    const lessonIds = (await supabaseAdmin.from('lessons').select('id').in('gate_id', gateIds)).data?.map(l => l.id) || [];
    if (lessonIds.length > 0) {
      await supabaseAdmin.from('socratic_scripts').delete().in('lesson_id', lessonIds);
    }
    await supabaseAdmin.from('lessons').delete().eq('course_id', courseId);
    await supabaseAdmin.from('gates').delete().eq('course_id', courseId);
  }

  await supabaseAdmin.from('courses').delete().eq('id', courseId);
  res.json({ message: 'Course deleted' });
});

// PUT /courses/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { title, subject, class_level, section, academic_year, total_sessions, session_duration_minutes, mastery_threshold } = req.body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (subject !== undefined) updates.subject = subject;
  if (class_level !== undefined) updates.class_level = class_level;
  if (section !== undefined) updates.section = section;
  if (academic_year !== undefined) updates.academic_year = academic_year;
  if (total_sessions !== undefined) updates.total_sessions = total_sessions;
  if (session_duration_minutes !== undefined) updates.session_duration_minutes = session_duration_minutes;
  if (mastery_threshold !== undefined) updates.mastery_threshold = mastery_threshold;

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

// POST /courses/:id/syllabus — Upload syllabus text + timetable config
router.post('/:id/syllabus', requireRole('teacher'), async (req: Request, res: Response) => {
  const { syllabus_text, llm_provider, llm_model, total_sessions, session_duration_minutes } = req.body;

  if (!syllabus_text) {
    res.status(400).json({ error: 'syllabus_text is required' });
    return;
  }

  if (syllabus_text.length > 50000) {
    res.status(400).json({ error: `Syllabus too long (${syllabus_text.length} chars). Maximum is 50,000 characters. Please shorten or paste just the table of contents and key topics.` });
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

// POST /courses/:id/syllabus/upload — File upload with real text extraction
router.post('/:id/syllabus/upload', requireRole('teacher'), syllabusUpload, async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  let extractedText = '';

  try {
    if (file.mimetype === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text?.trim() || '';
      if (!extractedText) {
        // Scanned PDF — try sending to AI for OCR
        const provider = createLLMProvider();
        const base64 = file.buffer.toString('base64');
        extractedText = await provider.complete({
          systemPrompt: 'Extract ALL text content from this document image. Return only the extracted text, no commentary.',
          userMessage: [
            { type: 'text', text: 'Extract the text from this scanned document:' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
          ],
          maxTokens: 8000,
          temperature: 0.1,
        });
      }
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'application/msword') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value?.trim() || '';
    } else if (file.mimetype === 'text/plain') {
      extractedText = file.buffer.toString('utf-8').trim();
    } else if (file.mimetype.startsWith('image/')) {
      // Image file — use AI vision to extract text
      const provider = createLLMProvider();
      const base64 = file.buffer.toString('base64');
      extractedText = await provider.complete({
        systemPrompt: 'Extract ALL text content from this image of a syllabus or course document. Return only the extracted text, preserving the structure (chapters, topics, subtopics).',
        userMessage: [
          { type: 'text', text: 'Extract the syllabus text from this image:' },
          { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${base64}` } },
        ],
        maxTokens: 8000,
        temperature: 0.1,
      });
    }
  } catch (err) {
    console.error('File extraction failed:', err);
    res.status(500).json({ error: 'Failed to extract text from file. Please try pasting the text directly.' });
    return;
  }

  if (!extractedText || extractedText.length < 20) {
    res.status(400).json({ error: 'Could not extract meaningful text from the file. Please try pasting the syllabus text directly.' });
    return;
  }

  // Save extracted text to course
  await supabaseAdmin
    .from('courses')
    .update({ syllabus_text: extractedText, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('teacher_id', req.user!.id);

  res.json({
    extracted_text: extractedText,
    filename: file.originalname,
    characters: extractedText.length,
  });
});

// POST /courses/:id/process — Trigger LLM deconstruction (background)
router.post('/:id/process', requireRole('teacher'), llmLimit, async (req: Request, res: Response) => {
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

  if (course.status === 'processing') {
    res.json({ message: 'Already processing', status: 'processing' });
    return;
  }

  if (course.status === 'active') {
    res.status(400).json({ error: 'Cannot re-process an active course. This would overwrite existing content and student data.' });
    return;
  }

  // Mark as processing and respond immediately
  await supabaseAdmin
    .from('courses')
    .update({ status: 'processing', processing_started_at: new Date().toISOString(), processing_error: null })
    .eq('id', course.id);

  res.json({ message: 'Processing started', status: 'processing' });

  // Process in background (non-blocking)
  const provider = createLLMProvider(course.llm_provider || 'anthropic');
  const service = new DeconstructionService(provider, supabaseAdmin);

  service.processSyllabus(
    course.id,
    course.syllabus_text,
    () => {}, // No SSE callbacks needed
    course.total_sessions || undefined,
    course.session_duration_minutes || undefined,
    course.class_level || undefined,
  ).then(async () => {
    console.log(`Deconstruction complete for course ${course.id}`);

    // After deconstruction, detect cross-course dependencies (non-blocking)
    try {
      const edgesFound = await detectCrossCourseEdges(supabaseAdmin, provider, course.id, req.user!.id);
      if (edgesFound > 0) {
        console.log(`Cross-course detection: found ${edgesFound} new edges for course ${course.id}`);
      }
    } catch (ccErr) {
      console.error('Cross-course detection failed (non-blocking):', (ccErr as Error).message);
    }
  }).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Deconstruction failed for course ${course.id}:`, message);
    await supabaseAdmin
      .from('courses')
      .update({ status: 'draft', processing_error: message })
      .eq('id', course.id);
  });
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

  // Auto-accept all draft gates, lessons, scripts, and questions on finalize
  await supabaseAdmin.from('gates').update({ status: 'accepted' }).eq('course_id', course.id).eq('status', 'draft');
  await supabaseAdmin.from('lessons').update({ status: 'accepted' }).eq('course_id', course.id).eq('status', 'draft');
  await supabaseAdmin.from('sub_concepts').update({ status: 'accepted' }).in('gate_id',
    (await supabaseAdmin.from('gates').select('id').eq('course_id', course.id)).data?.map(g => g.id) || []);
  const lessonIds = (await supabaseAdmin.from('lessons').select('id').eq('course_id', course.id)).data?.map(l => l.id) || [];
  if (lessonIds.length > 0) {
    await supabaseAdmin.from('socratic_scripts').update({ status: 'accepted' }).in('lesson_id', lessonIds);
  }
  await supabaseAdmin.from('questions').update({ status: 'accepted' }).eq('course_id', course.id).eq('status', 'draft');

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
