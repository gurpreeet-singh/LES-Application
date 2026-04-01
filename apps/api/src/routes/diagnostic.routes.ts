import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { DIAGNOSTIC_QUESTIONS, scoreDiagnostic } from '@leap/shared';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/diagnostic — Get 20 diagnostic questions
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  // Check if already completed
  const { data: existing } = await supabaseAdmin
    .from('learning_profiles')
    .select('diagnostic_completed_at, strategy_profile')
    .eq('student_id', req.user.id)
    .eq('course_id', req.params.courseId)
    .single();

  if (existing?.diagnostic_completed_at) {
    res.json({ completed: true, strategy_profile: existing.strategy_profile, questions: [] });
    return;
  }

  res.json({ completed: false, questions: DIAGNOSTIC_QUESTIONS });
});

// POST /courses/:courseId/diagnostic/submit — Score and save diagnostic results
router.post('/submit', async (req: Request, res: Response) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { answers } = req.body;

  if (!answers || typeof answers !== 'object') {
    res.status(400).json({ error: 'answers object required (question_id → answer_value)' });
    return;
  }

  // Score the diagnostic
  const result = scoreDiagnostic(answers);

  // Upsert learning profile with diagnostic results
  const { error } = await supabaseAdmin
    .from('learning_profiles')
    .upsert({
      student_id: req.user.id,
      course_id: req.params.courseId,
      logical: result.learning_dimensions.logical,
      visual: result.learning_dimensions.visual,
      reflective: result.learning_dimensions.reflective,
      kinesthetic: result.learning_dimensions.kinesthetic,
      auditory: result.learning_dimensions.auditory,
      strategy_profile: result.strategy_profile,
      prior_knowledge_score: result.prior_knowledge_score,
      bloom_ceiling: result.bloom_ceiling,
      diagnostic_results: result,
      diagnostic_completed_at: new Date().toISOString(),
      inferred_from_attempts: 0,
    }, { onConflict: 'student_id,course_id' });

  if (error) {
    console.error('Diagnostic save error:', error.message);
    res.status(500).json({ error: 'Failed to save diagnostic results' });
    return;
  }

  // Return friendly summary (student-facing, no strategy label)
  const strengthDim = Object.entries(result.learning_dimensions).sort((a, b) => b[1] - a[1])[0];
  res.json({
    message: 'Assessment complete!',
    summary: {
      prior_knowledge: result.prior_knowledge_score >= 70 ? 'Strong foundation' : result.prior_knowledge_score >= 40 ? 'Some background knowledge' : 'Starting fresh — that\'s okay!',
      learning_strength: `You learn best through ${strengthDim[0]} approaches`,
      readiness: result.bloom_ceiling === 'evaluate' || result.bloom_ceiling === 'analyze' ? 'Ready for advanced challenges' : result.bloom_ceiling === 'apply' ? 'Ready to apply concepts' : 'Building your foundation',
    },
    result, // Full result for debugging — remove in production if needed
  });
});

// GET /courses/:courseId/diagnostic/status — Teacher view: who has/hasn't completed
router.get('/status', async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, profiles:student_id(full_name, email)')
    .eq('course_id', courseId);

  const { data: profiles } = await supabaseAdmin
    .from('learning_profiles')
    .select('student_id, strategy_profile, diagnostic_completed_at, prior_knowledge_score, bloom_ceiling, logical, visual, reflective, kinesthetic, auditory')
    .eq('course_id', courseId);

  const profileMap = new Map((profiles || []).map(p => [p.student_id, p]));

  const students = (enrollments || []).map((e: any) => {
    const profile = profileMap.get(e.student_id);
    return {
      student_id: e.student_id,
      name: e.profiles?.full_name || 'Unknown',
      email: e.profiles?.email || '',
      diagnostic_completed: !!profile?.diagnostic_completed_at,
      strategy_profile: profile?.strategy_profile || 'not_assessed',
      prior_knowledge_score: profile?.prior_knowledge_score || 0,
      bloom_ceiling: profile?.bloom_ceiling || 'unknown',
      learning_dimensions: profile ? {
        logical: profile.logical, visual: profile.visual, reflective: profile.reflective,
        kinesthetic: profile.kinesthetic, auditory: profile.auditory,
      } : null,
    };
  });

  const completed = students.filter(s => s.diagnostic_completed).length;
  res.json({ students, completed, total: students.length });
});

export default router;
