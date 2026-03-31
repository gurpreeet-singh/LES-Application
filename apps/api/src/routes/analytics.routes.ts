import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { BLOOM_REACH_THRESHOLD, MASTERY_THRESHOLD, AT_RISK_THRESHOLD, BLOOM_LEVEL_THRESHOLDS } from '@leap/shared';
import { seedDemoQuizResponses } from '../services/demo-quiz-seeder.service.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/analytics/heatmap
router.get('/heatmap', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: gates } = await supabaseAdmin
    .from('gates')
    .select('id, gate_number, title, short_title, color')
    .eq('course_id', courseId)
    .eq('status', 'accepted')
    .order('sort_order');

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, profiles:student_id(id, full_name)')
    .eq('course_id', courseId);

  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('student_id, gate_id, mastery_pct')
    .eq('course_id', courseId);

  if (!gates || !enrollments || !progress) {
    res.json({ students: [], gates: [] });
    return;
  }

  const progressMap = new Map<string, Map<string, number>>();
  for (const p of progress) {
    if (!progressMap.has(p.student_id)) progressMap.set(p.student_id, new Map());
    progressMap.get(p.student_id)!.set(p.gate_id, p.mastery_pct);
  }

  const students = enrollments.map((e: { student_id: string; profiles: { id: string; full_name: string } | null }) => {
    const studentProgress = progressMap.get(e.student_id) || new Map();
    const gate_scores = gates.map(g => ({
      gate_id: g.id,
      gate_number: g.gate_number,
      mastery_pct: studentProgress.get(g.id) || 0,
    }));
    const nonZero = gate_scores.filter(gs => gs.mastery_pct > 0);
    const average = nonZero.length > 0
      ? Math.round(nonZero.reduce((s, gs) => s + gs.mastery_pct, 0) / nonZero.length)
      : 0;

    return {
      id: e.student_id,
      name: e.profiles?.full_name || 'Unknown',
      gate_scores,
      average,
    };
  });

  const gateAvgs = gates.map(g => {
    const scores = progress.filter(p => p.gate_id === g.id).map(p => p.mastery_pct);
    const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    return { ...g, avg };
  });

  res.json({ students, gates: gateAvgs });
});

// GET /courses/:courseId/analytics/bloom-dist/:gateId
router.get('/bloom-dist/:gateId', requireRole('teacher'), async (req: Request, res: Response) => {
  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('bloom_scores')
    .eq('gate_id', req.params.gateId)
    .eq('course_id', req.params.courseId);

  if (!progress || progress.length === 0) {
    res.json({ levels: [], gap_analysis: 'No student data available' });
    return;
  }

  const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const distribution = levels.map(level => {
    const count = progress.filter(p => {
      const scores = p.bloom_scores as Record<string, number>;
      return scores && scores[level] >= BLOOM_REACH_THRESHOLD;
    }).length;
    return { level, pct: Math.round((count / progress.length) * 100) };
  });

  // Gap analysis
  let maxDrop = 0;
  let dropIdx = 0;
  for (let i = 1; i < distribution.length; i++) {
    const drop = distribution[i - 1].pct - distribution[i].pct;
    if (drop > maxDrop) {
      maxDrop = drop;
      dropIdx = i;
    }
  }

  const gap_analysis = maxDrop > 0
    ? `${distribution[dropIdx - 1].pct}% ${distribution[dropIdx - 1].level} but only ${distribution[dropIdx].pct}% ${distribution[dropIdx].level}. Focus next lesson on bridging this gap.`
    : 'Bloom distribution is even across all levels.';

  res.json({ gate_id: req.params.gateId, levels: distribution, gap_analysis });
});

// GET /courses/:courseId/analytics/dependency-risk
router.get('/dependency-risk', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: gates } = await supabaseAdmin
    .from('gates')
    .select('id, gate_number, title, short_title')
    .eq('course_id', courseId)
    .eq('status', 'accepted');

  const { data: prereqs } = await supabaseAdmin
    .from('gate_prerequisites')
    .select('gate_id, prerequisite_gate_id')
    .in('gate_id', (gates || []).map(g => g.id));

  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('student_id, gate_id, mastery_pct')
    .eq('course_id', courseId);

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, profiles:student_id(full_name)')
    .eq('course_id', courseId);

  if (!gates || !prereqs || !progress || !enrollments) {
    res.json({ risks: [] });
    return;
  }

  const gateMap = new Map(gates.map(g => [g.id, g]));
  const nameMap = new Map(enrollments.map((e: { student_id: string; profiles: { full_name: string } | null }) => [e.student_id, e.profiles?.full_name || 'Unknown']));
  const progressMap = new Map<string, Map<string, number>>();
  for (const p of progress) {
    if (!progressMap.has(p.student_id)) progressMap.set(p.student_id, new Map());
    progressMap.get(p.student_id)!.set(p.gate_id, p.mastery_pct);
  }

  const risks = prereqs.map(pr => {
    const fromGate = gateMap.get(pr.prerequisite_gate_id);
    const toGate = gateMap.get(pr.gate_id);
    if (!fromGate || !toGate) return null;

    const affected = enrollments.filter((e: { student_id: string }) => {
      const sp = progressMap.get(e.student_id);
      if (!sp) return false;
      const fromM = sp.get(pr.prerequisite_gate_id) || 0;
      const toM = sp.get(pr.gate_id) || 0;
      return fromM < MASTERY_THRESHOLD && toM < AT_RISK_THRESHOLD;
    }).map((e: { student_id: string }) => ({
      id: e.student_id,
      name: nameMap.get(e.student_id) || 'Unknown',
      from_mastery: progressMap.get(e.student_id)?.get(pr.prerequisite_gate_id) || 0,
      to_mastery: progressMap.get(e.student_id)?.get(pr.gate_id) || 0,
    }));

    if (affected.length === 0) return null;

    return {
      from_gate: { id: fromGate.id, number: fromGate.gate_number, title: fromGate.short_title },
      to_gate: { id: toGate.id, number: toGate.gate_number, title: toGate.short_title },
      affected_students: affected,
      severity: affected.length >= 3 ? 'critical' : affected.length >= 2 ? 'high' : 'low',
      reason: `${fromGate.short_title} weakness cascading to ${toGate.short_title}`,
    };
  }).filter(Boolean);

  res.json({ risks });
});

// GET /courses/:courseId/analytics/attention
router.get('/attention', requireRole('teacher'), async (req: Request, res: Response) => {
  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('student_id, gate_id, mastery_pct, gate:gate_id(gate_number, short_title)')
    .eq('course_id', req.params.courseId)
    .gt('mastery_pct', 0)
    .lt('mastery_pct', AT_RISK_THRESHOLD);

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, profiles:student_id(full_name)')
    .eq('course_id', req.params.courseId);

  if (!progress || !enrollments) {
    res.json({ students: [] });
    return;
  }

  const nameMap = new Map(enrollments.map((e: { student_id: string; profiles: { full_name: string } | null }) => [e.student_id, e.profiles?.full_name || 'Unknown']));

  const byStudent = new Map<string, { gate_number: number; short_title: string; mastery_pct: number }[]>();
  for (const p of progress) {
    if (!byStudent.has(p.student_id)) byStudent.set(p.student_id, []);
    const gate = p.gate as unknown as { gate_number: number; short_title: string };
    byStudent.get(p.student_id)!.push({
      gate_number: gate.gate_number,
      short_title: gate.short_title,
      mastery_pct: p.mastery_pct,
    });
  }

  const students = Array.from(byStudent.entries()).map(([id, gates]) => ({
    id,
    name: nameMap.get(id) || 'Unknown',
    at_risk_gates: gates.sort((a, b) => a.mastery_pct - b.mastery_pct),
  }));

  res.json({ students });
});

// GET /courses/:courseId/analytics/sessions — Session-level analytics
router.get('/sessions', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('total_sessions, session_duration_minutes, status')
    .eq('id', courseId)
    .single();

  const { data: sessions } = await supabaseAdmin
    .from('session_plan')
    .select('*, lesson:lesson_id(id, title, gate_id, lesson_number, bloom_levels)')
    .eq('course_id', courseId)
    .order('session_number');

  const { data: gates } = await supabaseAdmin
    .from('gates')
    .select('id, gate_number, short_title, title, color, light_color')
    .eq('course_id', courseId)
    .eq('status', 'accepted')
    .order('sort_order');

  const { data: prereqs } = await supabaseAdmin
    .from('gate_prerequisites')
    .select('gate_id, prerequisite_gate_id')
    .in('gate_id', (gates || []).map(g => g.id).length > 0 ? (gates || []).map(g => g.id) : ['none']);

  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('student_id, gate_id, mastery_pct')
    .eq('course_id', courseId);

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('course_id', courseId);

  // If no session_plan exists, derive sessions from lessons
  const { data: lessons } = await supabaseAdmin
    .from('lessons')
    .select('id, title, gate_id, lesson_number')
    .eq('course_id', courseId)
    .order('sort_order');

  const sessionSource = (sessions && sessions.length > 0)
    ? sessions.map((s: any, i: number) => ({
        lesson_id: s.lesson_id,
        lesson_title: s.lesson?.title || s.topic_summary || `Session ${i + 1}`,
        gate_id: s.lesson?.gate_id || '',
      }))
    : (lessons || []).map(l => ({
        lesson_id: l.id,
        lesson_title: l.title,
        gate_id: l.gate_id,
      }));

  const totalSessions = course?.total_sessions || sessionSource.length || 0;
  const studentCount = enrollments?.length || 0;

  // ─── REAL DATA: Query all question_attempts for this course's gates ───
  // IMPORTANT: Supabase default limit is 1000 rows. Must set explicit limit for large datasets.
  const gateIds = (gates || []).map(g => g.id);
  let allAttempts: { question_id: string; gate_id: string; student_id: string; score: number; is_correct: boolean }[] = [];
  if (gateIds.length > 0) {
    // Fetch in batches per gate to avoid row limits
    for (const gid of gateIds) {
      const { data } = await supabaseAdmin
        .from('question_attempts')
        .select('question_id, gate_id, student_id, score, is_correct')
        .eq('gate_id', gid)
        .limit(10000);
      if (data) allAttempts.push(...data);
    }
  }

  // Get all questions for round-robin per-lesson distribution
  const { data: allQuestions } = await supabaseAdmin
    .from('questions').select('id, gate_id').eq('course_id', courseId).order('difficulty').limit(5000);

  // Build per-lesson question sets (round-robin distribution)
  const lessonQuestionMap = new Map<string, Set<string>>();
  for (const lesson of (lessons || [])) {
    const gateQ = (allQuestions || []).filter(q => q.gate_id === lesson.gate_id);
    const gateLessonsForGate = (lessons || []).filter(l => l.gate_id === lesson.gate_id);
    const idx = gateLessonsForGate.findIndex(l => l.id === lesson.id);
    const count = gateLessonsForGate.length || 1;
    const qIds = new Set(gateQ.filter((_: any, qi: number) => qi % count === idx).map(q => q.id));
    lessonQuestionMap.set(lesson.id, qIds);
  }

  // Per-lesson stats from actual attempts
  const lessonStats = new Map<string, { attempted: Set<string>; scores: number[]; studentScores: Map<string, number[]> }>();
  for (const lesson of (lessons || [])) {
    const qIds = lessonQuestionMap.get(lesson.id) || new Set();
    const stats = { attempted: new Set<string>(), scores: [] as number[], studentScores: new Map<string, number[]>() };
    for (const a of (allAttempts || [])) {
      if (qIds.has(a.question_id)) {
        stats.attempted.add(a.student_id);
        stats.scores.push(a.score);
        if (!stats.studentScores.has(a.student_id)) stats.studentScores.set(a.student_id, []);
        stats.studentScores.get(a.student_id)!.push(a.score);
      }
    }
    lessonStats.set(lesson.id, stats);
  }

  // Determine session completion: if the gate has sufficient attempt data, its sessions are completed
  // Build gate-level attempt stats
  const gateAttemptCounts = new Map<string, number>();
  for (const a of (allAttempts || [])) {
    gateAttemptCounts.set(a.gate_id, (gateAttemptCounts.get(a.gate_id) || 0) + 1);
  }
  // A gate is "data-complete" if it has at least (studentCount * 2) attempts (avg 2 per student)
  const gateHasData = new Map<string, boolean>();
  for (const g of (gates || [])) {
    const count = gateAttemptCounts.get(g.id) || 0;
    gateHasData.set(g.id, count >= Math.max(1, studentCount * 2));
  }

  // Mark ~70% of data-complete gate sessions as completed (realistic — not everything is done)
  let completedSessionCount = 0;
  const sessionData = sessionSource.map((s: any, i: number) => {
    const sessionNum = i + 1;
    const gate = (gates || []).find((g: any) => g.id === s.gate_id);
    const ls = lessonStats.get(s.lesson_id);
    const gateComplete = gate ? (gateHasData.get(gate.id) || false) : false;
    const hasData = gateComplete && ls && ls.scores.length > 0;

    // Compute per-lesson average score
    let avgScore = 0;
    let studentsAttempted = 0;
    let studentsPassed = 0;
    const studentScoreList: { student_id: string; student_name: string; score: number }[] = [];

    if (ls && ls.scores.length > 0) {
      avgScore = Math.round(ls.scores.reduce((a, v) => a + v, 0) / ls.scores.length);
      studentsAttempted = ls.attempted.size;
      for (const [sid, scores] of ls.studentScores) {
        const avg = Math.round(scores.reduce((a, v) => a + v, 0) / scores.length);
        if (avg >= 60) studentsPassed++;
        const enrollment = (enrollments || []).find((e: any) => e.student_id === sid);
        studentScoreList.push({
          student_id: sid,
          student_name: (enrollment as any)?.profiles?.full_name || 'Student',
          score: avg,
        });
      }
      studentScoreList.sort((a, b) => b.score - a.score);
    }

    const status = hasData ? 'completed' : (i === completedSessionCount ? 'in_progress' : 'upcoming');
    if (hasData) completedSessionCount++;

    return {
      session_number: sessionNum,
      lesson_id: s.lesson_id || '',
      lesson_title: s.lesson_title || `Session ${sessionNum}`,
      gate_id: gate?.id || '',
      gate_number: gate?.gate_number || 0,
      gate_color: gate?.color || '#6B7280',
      gate_short_title: gate?.short_title || '',
      status,
      avg_quiz_score: avgScore,
      students_attempted: studentsAttempted,
      students_passed: studentsPassed,
      student_scores: studentScoreList,
    };
  });

  // Recompute current session (first non-completed)
  const currentSession = Math.min(
    (sessionData.findIndex(s => s.status !== 'completed') + 1) || sessionData.length + 1,
    totalSessions
  );
  // Mark the current session
  const currentIdx = sessionData.findIndex(s => s.status === 'in_progress');
  if (currentIdx < 0 && completedSessionCount < sessionData.length) {
    sessionData[completedSessionCount].status = 'in_progress';
  }

  // Fill up to totalSessions if needed
  while (sessionData.length < totalSessions) {
    sessionData.push({
      session_number: sessionData.length + 1,
      lesson_id: '',
      lesson_title: `Session ${sessionData.length + 1}`,
      gate_id: '', gate_number: 0, gate_color: '#6B7280', gate_short_title: '',
      status: 'upcoming',
      avg_quiz_score: 0, students_attempted: 0, students_passed: 0, student_scores: [],
    });
  }

  // Gate status — derived from real session completion + actual question data
  const questionsPerGate = new Map<string, number>();
  for (const q of (allQuestions || [])) {
    questionsPerGate.set(q.gate_id, (questionsPerGate.get(q.gate_id) || 0) + 1);
  }

  const gatesStatus = (gates || []).map((g: any) => {
    const gateQuestionCount = questionsPerGate.get(g.id) || 0;
    const gateSessions = sessionData.filter(s => s.gate_id === g.id);
    const completedGateSessions = gateSessions.filter(s => s.status === 'completed').length;
    const inProgressGateSessions = gateSessions.filter(s => s.status === 'in_progress').length;

    // Gate with 0 questions = no content generated = upcoming (not completed)
    let status = 'upcoming';
    if (gateQuestionCount === 0 || gateSessions.length === 0) {
      status = 'upcoming';
    } else if (completedGateSessions >= gateSessions.length) {
      status = 'completed';
    } else if (inProgressGateSessions > 0 || completedGateSessions > 0) {
      status = 'in_progress';
    }

    const gateAvg = gateSessions.filter(s => s.avg_quiz_score > 0).length > 0
      ? Math.round(gateSessions.filter(s => s.avg_quiz_score > 0).reduce((a, s) => a + s.avg_quiz_score, 0) / gateSessions.filter(s => s.avg_quiz_score > 0).length)
      : 0;

    return {
      gate_id: g.id, gate_number: g.gate_number, short_title: g.short_title,
      title: g.title, color: g.color, light_color: g.light_color,
      status, sessions_in_gate: gateSessions.length, completed_sessions: completedGateSessions,
      avg_score: gateAvg,
    };
  });

  // ─── REAL course_stats from actual data ───
  const completedSessions = sessionData.filter(s => s.status === 'completed');
  const realAvgMastery = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((a, s) => a + s.avg_quiz_score, 0) / completedSessions.length)
    : 0;

  // Real quiz count: unique student × question_id attempts
  const totalQuizzesCompleted = allAttempts?.length || 0;
  const totalQuizzesPossible = (allQuestions?.length || 0) * studentCount;

  // Students on track vs at risk from actual averages
  const studentAvgMap = new Map<string, number[]>();
  for (const a of (allAttempts || [])) {
    if (!studentAvgMap.has(a.student_id)) studentAvgMap.set(a.student_id, []);
    studentAvgMap.get(a.student_id)!.push(a.score);
  }
  let studentsOnTrack = 0;
  let studentsAtRisk = 0;
  for (const [, scores] of studentAvgMap) {
    const avg = scores.reduce((a, v) => a + v, 0) / scores.length;
    if (avg >= MASTERY_THRESHOLD) studentsOnTrack++;
    else if (avg < AT_RISK_THRESHOLD) studentsAtRisk++;
  }

  res.json({
    current_session: currentSession,
    total_sessions: totalSessions,
    completed_sessions: completedSessionCount,
    sessions: sessionData,
    gates_status: gatesStatus,
    course_stats: {
      overall_completion_pct: totalSessions > 0 ? Math.round((completedSessionCount / totalSessions) * 100) : 0,
      avg_mastery: realAvgMastery,
      total_quizzes_completed: totalQuizzesCompleted,
      total_quizzes_possible: totalQuizzesPossible,
      students_on_track: studentsOnTrack,
      students_at_risk: studentsAtRisk,
    },
  });
});

// POST /courses/:courseId/analytics/seed-demo — Seed demo quiz responses
router.post('/seed-demo', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;
  try {
    const count = await seedDemoQuizResponses(supabaseAdmin, courseId);
    res.json({ message: `Seeded ${count} quiz attempts`, count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /courses/:courseId/analytics/lesson/:lessonId — Per-lesson quiz analysis
router.get('/lesson/:lessonId', requireRole('teacher'), async (req: Request, res: Response) => {
  const { courseId, lessonId } = req.params;

  // Get lesson + gate
  const { data: lesson } = await supabaseAdmin.from('lessons').select('*, gate_id').eq('id', lessonId).single();
  if (!lesson) { res.json({ analysis: null }); return; }

  // Get questions for this lesson — distribute evenly across Bloom levels per lesson
  const { data: allGateQuestions } = await supabaseAdmin
    .from('questions').select('*').eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('difficulty');
  const { data: gateLessons } = await supabaseAdmin
    .from('lessons').select('id, lesson_number').eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('lesson_number');

  let questions = allGateQuestions || [];
  if (gateLessons && gateLessons.length > 0 && questions.length > 0) {
    const idx = gateLessons.findIndex(l => l.id === lessonId);
    if (idx >= 0) {
      // Round-robin distribute questions across lessons so each gets a mix of Bloom levels
      const lessonCount = gateLessons.length;
      questions = questions.filter((_: any, qi: number) => qi % lessonCount === idx);
    }
  }

  if (questions.length === 0) { res.json({ analysis: null }); return; }

  const questionIds = questions.map(q => q.id);

  // Get all attempts for these questions (limit raised from default 1000)
  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('*, profiles:student_id(full_name)')
    .in('question_id', questionIds)
    .limit(10000);

  if (!attempts || attempts.length === 0) { res.json({ analysis: null }); return; }

  // Get enrolled students
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments').select('student_id, profiles:student_id(id, full_name)').eq('course_id', courseId);

  const studentCount = enrollments?.length || 0;
  const studentsAttempted = new Set(attempts.map(a => a.student_id)).size;

  // Score distribution (buckets of 20%)
  const studentScores = new Map<string, number[]>();
  for (const a of attempts) {
    if (!studentScores.has(a.student_id)) studentScores.set(a.student_id, []);
    studentScores.get(a.student_id)!.push(a.score);
  }
  const studentAvgs = Array.from(studentScores.entries()).map(([sid, scores]) => ({
    student_id: sid,
    name: (attempts.find(a => a.student_id === sid) as any)?.profiles?.full_name || 'Unknown',
    avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
  }));
  const classAvg = studentAvgs.length > 0 ? Math.round(studentAvgs.reduce((s, sa) => s + sa.avg, 0) / studentAvgs.length) : 0;
  const passRate = studentAvgs.length > 0 ? Math.round(studentAvgs.filter(s => s.avg >= 60).length / studentAvgs.length * 100) : 0;

  const distribution = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
  for (const s of studentAvgs) {
    const bucket = Math.min(4, Math.floor(s.avg / 20));
    distribution[bucket]++;
  }

  // Question-by-question analysis
  const questionAnalysis = questions.map((q, qi) => {
    const qAttempts = attempts.filter(a => a.question_id === q.id);
    const avgScore = qAttempts.length > 0 ? Math.round(qAttempts.reduce((s, a) => s + a.score, 0) / qAttempts.length) : 0;
    const correctCount = qAttempts.filter(a => a.is_correct).length;
    const misconceptions = qAttempts
      .filter(a => !a.is_correct && a.misconceptions)
      .flatMap(a => (Array.isArray(a.misconceptions) ? a.misconceptions : []).map((m: any) => m.misconception || m))
      .filter(Boolean);
    // Count misconceptions
    const miscCounts: Record<string, number> = {};
    for (const m of misconceptions) { miscCounts[m] = (miscCounts[m] || 0) + 1; }

    return {
      question_number: qi + 1,
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      bloom_level: q.bloom_level,
      avg_score: avgScore,
      correct_count: correctCount,
      total_attempts: qAttempts.length,
      correct_pct: qAttempts.length > 0 ? Math.round(correctCount / qAttempts.length * 100) : 0,
      top_misconceptions: Object.entries(miscCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => ({ misconception: m, count: c })),
    };
  });

  // Bloom level breakdown
  const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const bloomBreakdown = bloomLevels.map(level => {
    const levelAttempts = attempts.filter(a => {
      const q = questions.find(qq => qq.id === a.question_id);
      return q?.bloom_level === level;
    });
    const avg = levelAttempts.length > 0 ? Math.round(levelAttempts.reduce((s, a) => s + a.score, 0) / levelAttempts.length) : 0;
    const threshold = (BLOOM_LEVEL_THRESHOLDS as Record<string, number>)[level] || 50;
    return { level, avg, threshold, met: avg >= threshold, attempts: levelAttempts.length };
  }).filter(b => b.attempts > 0);

  // Student leaderboard
  const leaderboard = studentAvgs.sort((a, b) => b.avg - a.avg).map((s, i) => ({ ...s, rank: i + 1 }));

  // Question heatmap: students × questions
  const heatmap = (enrollments || []).map(e => {
    const name = (e as any).profiles?.full_name || 'Unknown';
    const scores = questions.map(q => {
      const attempt = attempts.find(a => a.student_id === e.student_id && a.question_id === q.id);
      return attempt ? attempt.score : null;
    });
    return { student_id: e.student_id, name, scores };
  });

  res.json({
    analysis: {
      lesson_id: lessonId,
      lesson_title: lesson.title,
      lesson_number: lesson.lesson_number,
      total_students: studentCount,
      students_attempted: studentsAttempted,
      class_average: classAvg,
      pass_rate: passRate,
      distribution,
      questions: questionAnalysis,
      bloom_breakdown: bloomBreakdown,
      leaderboard,
      heatmap,
    },
  });
});

// GET /courses/:courseId/analytics/class-trajectory — Scores across all lessons
router.get('/class-trajectory', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: lessons } = await supabaseAdmin
    .from('lessons').select('id, lesson_number, title, gate_id')
    .eq('course_id', courseId).order('sort_order');

  const { data: gates } = await supabaseAdmin
    .from('gates').select('id, gate_number, short_title, color')
    .eq('course_id', courseId).order('sort_order');

  // Fetch attempts per gate to avoid Supabase 1000-row limit
  let allAttemptsTraj: { student_id: string; question_id: string; gate_id: string; score: number; is_correct: boolean }[] = [];
  for (const g of (gates || [])) {
    const { data } = await supabaseAdmin
      .from('question_attempts').select('student_id, question_id, gate_id, score, is_correct')
      .eq('gate_id', g.id).limit(10000);
    if (data) allAttemptsTraj.push(...data);
  }

  const { data: questions } = await supabaseAdmin
    .from('questions').select('id, gate_id')
    .eq('course_id', courseId)
    .order('difficulty').limit(5000);

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments').select('student_id, profiles:student_id(full_name)')
    .eq('course_id', courseId);

  if (!lessons || !questions || !enrollments) {
    res.json({ trajectory: [], students: [] });
    return;
  }
  const safeAttempts = allAttemptsTraj;

  // Map question → gate
  const qGateMap = new Map(questions.map(q => [q.id, q.gate_id]));

  // For each lesson, compute class avg and per-student scores
  // Only include lessons whose gate has questions (skip empty gates like G3, G8)
  const gatesWithQuestions = new Set(questions.map(q => q.gate_id));
  const activeLessons = (lessons || []).filter(l => gatesWithQuestions.has(l.gate_id));

  const trajectory = activeLessons.map(l => {
    const gateQuestions = questions.filter(q => q.gate_id === l.gate_id);
    const gateLessonsForGate = activeLessons.filter(ll => ll.gate_id === l.gate_id);
    const idx = gateLessonsForGate.findIndex(ll => ll.id === l.id);
    const lessonCount = gateLessonsForGate.length || 1;
    const lessonQuestionIds = new Set(gateQuestions.filter((_: any, qi: number) => qi % lessonCount === idx).map(q => q.id));

    const lessonAttempts = safeAttempts.filter(a => lessonQuestionIds.has(a.question_id));

    // Per-student scores — only include students who actually have attempts
    const studentScores: Record<string, number> = {};
    for (const e of enrollments) {
      const sa = lessonAttempts.filter(a => a.student_id === e.student_id);
      if (sa.length > 0) {
        studentScores[e.student_id] = Math.round(sa.reduce((s, a) => s + a.score, 0) / sa.length);
      }
    }

    const scores = Object.values(studentScores);
    const classAvg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const gate = (gates || []).find(g => g.id === l.gate_id);

    return {
      lesson_number: l.lesson_number,
      lesson_title: l.title,
      gate_number: gate?.gate_number || 0,
      gate_color: gate?.color || '#6B7280',
      gate_title: gate?.short_title || '',
      class_average: classAvg,
      student_scores: studentScores,
      students_attempted: scores.length,
    };
  });

  // Student sparklines — only count lessons where this student has data
  const students = enrollments.map(e => {
    const myScores = trajectory.map(t => t.student_scores[e.student_id] || 0);
    const nonZero = myScores.filter(s => s > 0);
    return {
      id: e.student_id,
      name: (e as any).profiles?.full_name || 'Unknown',
      scores: myScores,
      average: nonZero.length > 0 ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length) : 0,
    };
  });

  // Rank movement (compare last 5 lessons vs previous 5)
  const rankedStudents = students.map(s => {
    const recent = s.scores.slice(-5).filter(v => v > 0);
    const prev = s.scores.slice(-10, -5).filter(v => v > 0);
    const recentAvg = recent.length > 0 ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
    const prevAvg = prev.length > 0 ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : 0;
    return { ...s, recent_avg: recentAvg, prev_avg: prevAvg, trend: recentAvg - prevAvg };
  }).sort((a, b) => b.average - a.average).map((s, i) => ({ ...s, rank: i + 1 }));

  res.json({ trajectory, students: rankedStudents });
});

// GET /courses/:courseId/analytics/student/:studentId — Student deep dive
router.get('/student/:studentId', requireRole('teacher'), async (req: Request, res: Response) => {
  const { courseId, studentId } = req.params;

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('full_name, email').eq('id', studentId).single();

  const { data: progress } = await supabaseAdmin
    .from('student_gate_progress')
    .select('*, gate:gate_id(gate_number, title, short_title, color)')
    .eq('student_id', studentId).eq('course_id', courseId);

  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('*, question:question_id(question_text, question_type, bloom_level, gate_id)')
    .eq('student_id', studentId)
    .in('gate_id', (progress || []).map(p => p.gate_id));

  // Overall stats
  const totalAttempts = attempts?.length || 0;
  const avgScore = totalAttempts > 0 ? Math.round((attempts || []).reduce((s, a) => s + a.score, 0) / totalAttempts) : 0;
  const correctCount = (attempts || []).filter(a => a.is_correct).length;

  // Bloom scores across all gates
  const overallBloom: Record<string, number[]> = {};
  for (const a of (attempts || [])) {
    const bl = a.bloom_level_demonstrated || 'remember';
    if (!overallBloom[bl]) overallBloom[bl] = [];
    overallBloom[bl].push(a.score);
  }
  const bloomProfile: Record<string, number> = {};
  for (const [level, scores] of Object.entries(overallBloom)) {
    bloomProfile[level] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }

  // Misconceptions
  const misconceptions: { misconception: string; count: number; gate: string; bloom: string }[] = [];
  const miscMap: Record<string, { count: number; gate: string; bloom: string }> = {};
  for (const a of (attempts || [])) {
    if (!a.is_correct && a.misconceptions) {
      const q = a.question as any;
      for (const m of (Array.isArray(a.misconceptions) ? a.misconceptions : [])) {
        const key = m.misconception || m;
        if (key) {
          if (!miscMap[key]) miscMap[key] = { count: 0, gate: q?.gate_id?.slice(0, 8) || '?', bloom: q?.bloom_level || '?' };
          miscMap[key].count++;
        }
      }
    }
  }
  for (const [m, data] of Object.entries(miscMap)) {
    misconceptions.push({ misconception: m, ...data });
  }
  misconceptions.sort((a, b) => b.count - a.count);

  // Gate-by-gate
  const gateProgress = (progress || []).map(p => ({
    gate_number: (p.gate as any)?.gate_number || 0,
    gate_title: (p.gate as any)?.short_title || (p.gate as any)?.title || '?',
    gate_color: (p.gate as any)?.color || '#6B7280',
    mastery_pct: p.mastery_pct,
    bloom_scores: p.bloom_scores,
  })).sort((a, b) => a.gate_number - b.gate_number);

  // AI recommendation
  const weakestBloom = Object.entries(bloomProfile).sort((a, b) => a[1] - b[1])[0];
  const strongestBloom = Object.entries(bloomProfile).sort((a, b) => b[1] - a[1])[0];
  const topMisc = misconceptions[0];
  const recommendation = `${profile?.full_name || 'This student'} is strongest at ${strongestBloom?.[0] || 'remember'} (${strongestBloom?.[1] || 0}%) but needs support at ${weakestBloom?.[0] || 'create'} (${weakestBloom?.[1] || 0}%).${topMisc ? ` Most common issue: "${topMisc.misconception}" (seen ${topMisc.count} times).` : ''} Recommended: focus on ${weakestBloom?.[0] || 'higher-order'}-level practice problems.`;

  res.json({
    student: {
      id: studentId,
      name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      overall_score: avgScore,
      total_attempts: totalAttempts,
      correct_count: correctCount,
      accuracy: totalAttempts > 0 ? Math.round(correctCount / totalAttempts * 100) : 0,
      bloom_profile: bloomProfile,
      gate_progress: gateProgress,
      misconceptions: misconceptions.slice(0, 10),
      recommendation,
    },
  });
});

export default router;
