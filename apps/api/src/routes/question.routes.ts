import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { createLLMProvider } from '../services/llm/provider.js';
import { QuizGenerationService } from '../services/quiz-generation.service.js';
import { llmLimit } from '../middleware/rate-limit.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/questions
router.get('/', async (req: Request, res: Response) => {
  const { gate_id, bloom_level, type, is_diagnostic } = req.query;

  let query = supabaseAdmin
    .from('questions')
    .select('*')
    .eq('course_id', req.params.courseId)
    .neq('status', 'rejected')
    .order('gate_id')
    .order('bloom_level');

  if (gate_id) query = query.eq('gate_id', gate_id as string);
  if (bloom_level) query = query.eq('bloom_level', bloom_level as string);
  if (type) query = query.eq('question_type', type as string);
  if (is_diagnostic === 'true') query = query.eq('is_diagnostic', true);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ questions: data });
});

// PUT /courses/:courseId/questions/:id
router.put('/:id', requireRole('teacher'), async (req: Request, res: Response) => {
  const { question_text, options, correct_answer, rubric, explanation, bloom_level } = req.body;

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({ question_text, options, correct_answer, rubric, explanation, bloom_level })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ question: data });
});

// PUT /courses/:courseId/questions/:id/status
router.put('/:id/status', requireRole('teacher'), async (req: Request, res: Response) => {
  const { status } = req.body;

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ question: data });
});

// POST /courses/:courseId/questions/generate/:lessonId — Generate quiz for a single lesson
router.post('/generate/:lessonId', requireRole('teacher'), llmLimit, async (req: Request, res: Response) => {
  const courseId = req.params.courseId;
  const lessonId = req.params.lessonId;

  // Get lesson
  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('*, gate:gate_id(id, title, short_title, sub_concepts(title))')
    .eq('id', lessonId)
    .single();

  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }

  // Check if questions already exist for this lesson's gate
  const { data: existing } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('gate_id', lesson.gate_id)
    .eq('course_id', courseId);

  // Return existing questions unless force regeneration requested
  if (existing && existing.length > 0 && !req.body?.force) {
    res.json({ questions: existing, generated: 0, existing: existing.length, message: 'Questions already exist for this gate. Use force:true to regenerate.' });
    return;
  }

  // If regenerating, delete old questions first
  if (existing && existing.length > 0 && req.body?.force) {
    await supabaseAdmin.from('questions').delete().eq('gate_id', lesson.gate_id).eq('course_id', courseId);
  }

  // Get past performance for context-aware generation
  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('mastery_pct, bloom_scores')
    .eq('course_id', courseId);

  const { data: pastAttempts } = await supabaseAdmin
    .from('question_attempts')
    .select('is_correct, bloom_level_demonstrated, misconceptions')
    .eq('gate_id', lesson.gate_id)
    .limit(50);

  // Build context for AI
  let pastContext = '';
  if (progress && progress.length > 0) {
    const avgMastery = Math.round(progress.reduce((a, p) => a + p.mastery_pct, 0) / progress.length);
    const bloomGaps = progress.reduce((acc, p) => {
      const bs = p.bloom_scores as Record<string, number>;
      Object.entries(bs).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
      return acc;
    }, {} as Record<string, number>);
    Object.keys(bloomGaps).forEach(k => { bloomGaps[k] = Math.round(bloomGaps[k] / progress.length); });

    pastContext = `\n\nSTUDENT PERFORMANCE CONTEXT (use this to adjust difficulty):
Average mastery: ${avgMastery}%
Bloom level averages: ${Object.entries(bloomGaps).map(([k, v]) => `${k}: ${v}%`).join(', ')}
${avgMastery > 80 ? 'Students are performing well — increase difficulty, add more Analyze/Evaluate questions.' : avgMastery < 60 ? 'Students are struggling — include more Remember/Understand questions with scaffolding.' : 'Mixed performance — balance across all Bloom levels.'}`;
  }

  if (pastAttempts && pastAttempts.length > 0) {
    const misconceptions = pastAttempts
      .filter(a => !a.is_correct && a.misconceptions)
      .flatMap(a => Array.isArray(a.misconceptions) ? a.misconceptions : [])
      .slice(0, 5);
    if (misconceptions.length > 0) {
      pastContext += `\nCommon misconceptions to target: ${misconceptions.map((m: any) => m.misconception || m).join('; ')}`;
    }
  }

  try {
    const provider = createLLMProvider();
    const gate = lesson.gate as any;
    const subConcepts = (gate?.sub_concepts || []).map((sc: any) => sc.title || sc);

    // Get course class_level and total lessons for DIKW-aware question generation
    const { data: courseData } = await supabaseAdmin.from('courses').select('class_level').eq('id', courseId).single();
    const { count: totalLessons } = await supabaseAdmin.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', courseId);

    const { buildQuizGenerationPrompt } = await import('@leap/shared');
    const { system, user } = buildQuizGenerationPrompt([{
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      objective: lesson.objective,
      key_idea: lesson.key_idea || '',
      bloom_levels: lesson.bloom_levels || ['remember', 'understand'],
      gate_title: gate?.title || gate?.short_title || '',
      sub_concepts: subConcepts,
    }], courseData?.class_level || undefined, totalLessons || undefined);

    const rawResponse = await provider.complete({
      systemPrompt: system + pastContext,
      userMessage: user,
      maxTokens: 4000,
      temperature: 0.3,
    });

    const jsonStr = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        res.status(500).json({ error: 'AI returned invalid response. Please try again.' });
        return;
      }
    }
    const questions = parsed.lessons?.[0]?.questions || parsed.questions || [];

    const inserts = questions.map((q: any) => ({
      gate_id: lesson.gate_id,
      course_id: courseId,
      question_text: q.question_text,
      question_type: q.question_type === 'multiple_choice' ? 'mcq' : q.question_type,
      bloom_level: q.bloom_level,
      difficulty: q.difficulty || 3,
      options: q.options || null,
      correct_answer: q.correct_answer || '',
      rubric: q.rubric || '',
      distractors: q.distractors || [],
      is_diagnostic: q.bloom_level === 'analyze' || q.bloom_level === 'evaluate',
      status: 'accepted',
    }));

    if (inserts.length > 0) {
      const { data: inserted } = await supabaseAdmin.from('questions').insert(inserts).select();
      res.json({ questions: inserted || [], generated: inserts.length, existing: existing?.length || 0 });
    } else {
      res.json({ questions: [], generated: 0, error: 'AI returned no questions' });
    }
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: `Quiz generation failed: ${err instanceof Error ? err.message : 'Unknown'}` });
  }
});

export default router;
