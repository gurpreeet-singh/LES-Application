import { Router, Request, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { GradingService } from '../services/grading.service.js';
import { AnswerExtractionService } from '../services/answer-extraction.service.js';
import type { QuestionContext } from '@leap/shared';

const router = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const MARKS_PER_TYPE: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

// Helper: get questions for a specific lesson within a gate
async function getLessonQuestions(courseId: string, lessonId: string) {
  const { data: lesson } = await supabaseAdmin
    .from('lessons').select('*, gate_id').eq('id', lessonId).single();
  if (!lesson) return { lesson: null, questions: [] };

  const { data: allGateQuestions } = await supabaseAdmin
    .from('questions').select('*')
    .eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('bloom_level').order('difficulty');

  const { data: gateLessons } = await supabaseAdmin
    .from('lessons').select('id, lesson_number')
    .eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('lesson_number');

  let questions = allGateQuestions || [];
  if (gateLessons && gateLessons.length > 0 && questions.length > 0) {
    const idx = gateLessons.findIndex(l => l.id === lessonId);
    if (idx >= 0) {
      const perLesson = Math.ceil(questions.length / gateLessons.length);
      questions = questions.slice(idx * perLesson, (idx + 1) * perLesson);
    }
  }

  return { lesson, questions };
}

// GET /students/:studentId/progress?course_id=xxx
router.get('/', async (req: Request, res: Response) => {
  const { course_id } = req.query;
  const studentId = req.params.studentId;

  if (req.user!.role === 'student' && req.user!.id !== studentId) {
    res.status(403).json({ error: 'Cannot view other student progress' });
    return;
  }

  let query = supabaseAdmin
    .from('student_gate_progress')
    .select('*, gate:gate_id(id, gate_number, title, short_title, color)')
    .eq('student_id', studentId);

  if (course_id) {
    query = query.eq('course_id', course_id as string);
  }

  const { data, error } = await query.order('gate(gate_number)');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let profileQuery = supabaseAdmin
    .from('learning_profiles')
    .select('*')
    .eq('student_id', studentId);

  if (course_id) {
    profileQuery = profileQuery.eq('course_id', course_id as string);
  }

  const { data: profile } = await profileQuery.single();

  res.json({ progress: data, learning_profile: profile });
});

// POST /students/:studentId/progress/attempt — Single question attempt
router.post('/attempt', async (req: Request, res: Response) => {
  const studentId = req.params.studentId;
  const { question_id, gate_id, answer_text, time_spent_seconds } = req.body;

  if (req.user!.id !== studentId) {
    res.status(403).json({ error: 'Can only submit own attempts' });
    return;
  }

  const { data: question, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', question_id)
    .single();

  if (qErr || !question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  let is_correct = false;
  let score = 0;
  let ai_feedback = '';

  if (question.question_type === 'mcq' || question.question_type === 'true_false') {
    if (question.options) {
      const correctOption = question.options.find((o: { is_correct: boolean }) => o.is_correct);
      is_correct = correctOption?.text?.toLowerCase().trim() === answer_text?.toLowerCase().trim();
    }
    score = is_correct ? 100 : 0;
    ai_feedback = is_correct ? 'Correct!' : `Incorrect. The correct answer is: ${question.correct_answer || ''}`;
  } else {
    try {
      const provider = createLLMProvider();
      const gradingService = new GradingService(provider, supabaseAdmin);
      const results = await gradingService.gradeStudentAnswers(studentId, question.course_id, gate_id, [{
        question_id, question_number: 1, question_text: question.question_text,
        question_type: question.question_type, correct_answer: question.correct_answer || '',
        rubric: question.rubric || '', max_score: question.question_type === 'short_answer' ? 4 : 5,
        student_answer: answer_text, options: question.options,
      }]);
      if (results.length > 0) {
        score = Math.round((results[0].score / results[0].max_score) * 100);
        is_correct = results[0].score === results[0].max_score;
        ai_feedback = results[0].feedback;
      }
    } catch {
      score = 50;
      ai_feedback = 'AI grading unavailable. Score set to 50%. Please review manually.';
    }
  }

  const { data: attempt, error } = await supabaseAdmin
    .from('question_attempts')
    .insert({
      student_id: studentId, question_id, gate_id, answer_text,
      is_correct, score, bloom_level_demonstrated: question.bloom_level,
      time_spent_seconds, ai_feedback,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('score, bloom_level_demonstrated')
    .eq('student_id', studentId)
    .eq('gate_id', gate_id);

  if (attempts && attempts.length > 0) {
    const avgScore = Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length);
    await supabaseAdmin
      .from('student_gate_progress')
      .upsert({
        student_id: studentId, gate_id, course_id: question.course_id,
        mastery_pct: avgScore, last_attempt_at: new Date().toISOString(),
        is_unlocked: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,gate_id' });
  }

  res.json({ attempt: { ...attempt, ai_feedback } });
});

// POST /courses/:courseId/lessons/:lessonId/scores — Manual score entry
router.post('/scores', requireRole('teacher'), async (req: Request, res: Response) => {
  const { scores: studentScores } = req.body;
  if (!Array.isArray(studentScores)) {
    res.status(400).json({ error: 'scores array required' });
    return;
  }

  let savedCount = 0;
  for (const entry of studentScores) {
    const { student_id, question_scores } = entry;
    if (!student_id || !Array.isArray(question_scores)) continue;

    // Look up gate_id and course_id from question records
    const questionIds = question_scores.map((qs: any) => qs.question_id).filter(Boolean);
    const { data: questionMeta } = await supabaseAdmin.from('questions').select('id, gate_id, course_id, question_type').in('id', questionIds.length > 0 ? questionIds : ['none']);
    const qMetaMap = new Map((questionMeta || []).map(q => [q.id, q]));

    const MARKS_PER_TYPE: Record<string, number> = { mcq: 2, true_false: 1, short_answer: 4, open_ended: 5 };

    for (const qs of question_scores) {
      const meta = qMetaMap.get(qs.question_id);
      await supabaseAdmin.from('question_attempts').insert({
        student_id,
        question_id: qs.question_id,
        gate_id: meta?.gate_id || qs.gate_id || '',
        answer_text: `Score: ${qs.score}`,
        is_correct: qs.score > 0,
        score: qs.score,
        bloom_level_demonstrated: 'remember',
      });
      savedCount++;
    }

    if (question_scores.length > 0) {
      const firstMeta = qMetaMap.get(question_scores[0].question_id);
      const q = firstMeta || null;
      if (q) {
        const totalScore = question_scores.reduce((a: number, qs: any) => a + (qs.score || 0), 0);
        const maxPossible = question_scores.reduce((a: number, qs: any) => {
          const m = qMetaMap.get(qs.question_id);
          return a + (MARKS_PER_TYPE[m?.question_type || 'open_ended'] || 5);
        }, 0);
        const pct = Math.round((totalScore / Math.max(maxPossible, 1)) * 100);
        await supabaseAdmin.from('student_gate_progress').upsert({
          student_id, gate_id: q.gate_id, course_id: q.course_id,
          mastery_pct: Math.min(100, pct), is_unlocked: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id,gate_id' });
      }
    }
  }

  res.json({ saved: savedCount, message: `Scores saved for ${studentScores.length} students.` });
});

// GET /courses/:courseId/lessons/:lessonId/grades — Fetch previously graded results
router.get('/grades', requireRole('teacher'), async (req: Request, res: Response) => {
  const { courseId, lessonId } = req.params;
  const { lesson, questions } = await getLessonQuestions(courseId, lessonId);
  if (!lesson || questions.length === 0) {
    res.json({ grades: [] });
    return;
  }

  const questionIds = questions.map((q: any) => q.id);
  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('*, profiles:student_id(full_name)')
    .in('question_id', questionIds);

  if (!attempts || attempts.length === 0) {
    res.json({ grades: [] });
    return;
  }

  // Group by student
  const byStudent = new Map<string, any[]>();
  for (const a of attempts) {
    const list = byStudent.get(a.student_id) || [];
    list.push(a);
    byStudent.set(a.student_id, list);
  }

  const grades = Array.from(byStudent.entries()).map(([studentId, studentAttempts]) => {
    const name = (studentAttempts[0]?.profiles as any)?.full_name || 'Unknown';
    const answers = studentAttempts.map((a, i) => ({
      question_id: a.question_id,
      question_num: i + 1,
      answer: a.answer_text || '',
      is_correct: a.is_correct,
      score: a.score || 0,
      max_score: MARKS_PER_TYPE[questions.find((q: any) => q.id === a.question_id)?.question_type || 'mcq'] || 2,
      ai_feedback: a.ai_feedback || undefined,
    }));

    return {
      student_id: studentId,
      student_name: name,
      roll_number: '',
      answers,
      total_score: answers.reduce((s, a) => s + a.score, 0),
      max_score: answers.reduce((s, a) => s + a.max_score, 0),
      status: 'graded' as const,
    };
  });

  res.json({ grades });
});

// POST /courses/:courseId/lessons/:lessonId/grade — Bulk grade (file upload or JSON)
router.post('/grade', requireRole('teacher'), upload.array('answer_sheets', 50), async (req: Request, res: Response) => {
  const { courseId, lessonId } = req.params;
  const files = req.files as Express.Multer.File[] | undefined;

  const provider = createLLMProvider();
  const gradingService = new GradingService(provider, supabaseAdmin);

  if (files && files.length > 0) {
    // === FILE UPLOAD PATH: Extract answers from images/PDFs, then grade ===
    try {
      const { lesson, questions } = await getLessonQuestions(courseId, lessonId);
      if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }
      if (questions.length === 0) { res.status(400).json({ error: 'No questions found for this lesson' }); return; }

      // Get enrolled students for name matching
      const { data: enrollments } = await supabaseAdmin
        .from('enrollments')
        .select('student_id, profiles:student_id(id, full_name)')
        .eq('course_id', courseId);

      // Build question context for extraction
      const questionContext: QuestionContext[] = questions.map((q: any, i: number) => ({
        number: i + 1,
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
      }));

      // Extract answers from uploaded files
      const extractionService = new AnswerExtractionService(provider);
      const extractedSheets = await extractionService.extractFromFiles(files, questionContext);

      // Match extracted names to enrolled students
      const matchStudent = (name: string) => {
        if (!enrollments) return null;
        const normalized = name.toLowerCase().trim();
        if (normalized === 'unknown' || !normalized) return null;
        return enrollments.find(e => {
          const enrolledName = ((e as any).profiles?.full_name || '').toLowerCase().trim();
          return enrolledName === normalized ||
                 enrolledName.includes(normalized) ||
                 normalized.includes(enrolledName);
        });
      };

      // Grade each extracted sheet
      const grades: any[] = [];
      let unknownCounter = 0;

      for (const sheet of extractedSheets) {
        const enrollment = matchStudent(sheet.student_name);
        const studentId = enrollment?.student_id || `unknown-${++unknownCounter}`;
        const studentName = enrollment
          ? ((enrollment as any).profiles?.full_name || sheet.student_name)
          : sheet.student_name;

        // Map extracted answers to grading format
        const answersForGrading = sheet.answers
          .filter(a => a.answer_text !== '[BLANK]' && a.answer_text !== '[EXTRACTION FAILED]')
          .map(a => {
            const q = questions[a.question_number - 1] as any;
            if (!q) return null;
            return {
              question_id: q.id,
              question_number: a.question_number,
              question_text: q.question_text,
              question_type: q.question_type,
              correct_answer: q.correct_answer || '',
              rubric: q.rubric || '',
              max_score: MARKS_PER_TYPE[q.question_type] || 2,
              student_answer: a.answer_text,
              options: q.options,
            };
          }).filter(Boolean) as any[];

        let gradeResults: any[] = [];
        if (answersForGrading.length > 0 && enrollment) {
          gradeResults = await gradingService.gradeStudentAnswers(
            studentId, courseId, lesson.gate_id, answersForGrading
          );
        } else if (answersForGrading.length > 0) {
          // Unknown student — grade but don't persist
          gradeResults = answersForGrading.map(a => ({
            question_id: a.question_id,
            question_number: a.question_number,
            score: 0,
            max_score: a.max_score,
            feedback: 'Student not matched to enrollment. Review required.',
            misconception: null,
            bloom_level_demonstrated: 'remember',
          }));
        }

        // Build all answers including blanks
        const allAnswers = sheet.answers.map(a => {
          const q = questions[a.question_number - 1] as any;
          const graded = gradeResults.find(r => r.question_number === a.question_number);
          const maxScore = q ? (MARKS_PER_TYPE[q.question_type] || 2) : 2;
          return {
            question_id: q?.id || '',
            question_num: a.question_number,
            answer: a.answer_text,
            is_correct: graded ? graded.score === graded.max_score : false,
            score: graded?.score || 0,
            max_score: maxScore,
            ai_feedback: graded?.feedback || (a.answer_text === '[BLANK]' ? 'No answer provided' : undefined),
          };
        });

        grades.push({
          student_id: studentId,
          student_name: studentName,
          roll_number: sheet.roll_number,
          answers: allAnswers,
          total_score: allAnswers.reduce((s, a) => s + a.score, 0),
          max_score: allAnswers.reduce((s, a) => s + a.max_score, 0),
          status: sheet.confidence === 'low' ? 'needs_review' : 'graded',
        });
      }

      res.json({ grades });
    } catch (err: any) {
      console.error('Answer sheet grading failed:', err);
      res.status(500).json({ error: err.message || 'Grading failed' });
    }
  } else {
    // === JSON PATH: Existing bulk grade logic ===
    const { student_scores } = req.body;
    if (!Array.isArray(student_scores)) {
      res.status(400).json({ error: 'Upload answer sheets or provide student_scores array' });
      return;
    }

    const results: any[] = [];
    for (const student of student_scores) {
      const questionIds = student.answers.map((a: any) => a.question_id);
      const { data: questions } = await supabaseAdmin
        .from('questions').select('*').in('id', questionIds);
      if (!questions) continue;

      const answersForGrading = student.answers.map((a: any, i: number) => {
        const q = questions.find((q: any) => q.id === a.question_id);
        return {
          question_id: a.question_id,
          question_number: i + 1,
          question_text: q?.question_text || '',
          question_type: q?.question_type || 'mcq',
          correct_answer: q?.correct_answer || '',
          rubric: q?.rubric || '',
          max_score: MARKS_PER_TYPE[q?.question_type || 'mcq'] || 2,
          student_answer: a.answer_text,
          options: q?.options,
        };
      });

      const gate_id = questions[0]?.gate_id;
      const course_id = questions[0]?.course_id;

      if (gate_id && course_id) {
        const gradeResults = await gradingService.gradeStudentAnswers(
          student.student_id, course_id, gate_id, answersForGrading
        );
        results.push({
          student_id: student.student_id,
          results: gradeResults,
          total_score: gradeResults.reduce((a, r) => a + r.score, 0),
          max_score: gradeResults.reduce((a, r) => a + r.max_score, 0),
        });
      }
    }

    res.json({ grades: results });
  }
});

export default router;
