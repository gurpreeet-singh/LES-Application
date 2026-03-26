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

  // Query real attempt data per gate from question_attempts
  const gateIds = (gates || []).map(g => g.id);
  const { data: allGateAttempts } = gateIds.length > 0
    ? await supabaseAdmin
        .from('question_attempts')
        .select('gate_id, student_id, score')
        .in('gate_id', gateIds)
    : { data: [] as { gate_id: string; student_id: string; score: number }[] };

  // Build per-gate real counts: students_attempted and students_passed (avg score >= 60)
  const gateAttemptStats = new Map<string, { attempted: number; passed: number }>();
  if (allGateAttempts && allGateAttempts.length > 0) {
    const byGate = new Map<string, Map<string, number[]>>();
    for (const a of allGateAttempts) {
      if (!byGate.has(a.gate_id)) byGate.set(a.gate_id, new Map());
      const studentMap = byGate.get(a.gate_id)!;
      if (!studentMap.has(a.student_id)) studentMap.set(a.student_id, []);
      studentMap.get(a.student_id)!.push(a.score);
    }
    for (const [gateId, studentMap] of byGate) {
      let passed = 0;
      for (const [, scores] of studentMap) {
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        if (avg >= 60) passed++;
      }
      gateAttemptStats.set(gateId, { attempted: studentMap.size, passed });
    }
  }

  // Estimate completion: if students have progress data, mark proportional sessions as completed
  const totalProgress = (progress || []).filter(p => p.mastery_pct > 0).length;
  const totalPossible = studentCount * (gates || []).length;
  const completionRatio = totalPossible > 0 ? totalProgress / totalPossible : 0;
  const completedSessionCount = Math.max(0, Math.floor(sessionSource.length * completionRatio));
  const currentSession = Math.min(completedSessionCount + 1, totalSessions);

  // Build session data
  const sessionData = sessionSource.map((s: any, i: number) => {
    const sessionNum = i + 1;
    const status = sessionNum < currentSession ? 'completed' : sessionNum === currentSession ? 'in_progress' : 'upcoming';
    const gate = (gates || []).find((g: any) => g.id === s.gate_id);

    // For completed sessions, derive scores from actual student_gate_progress
    let avgScore = 0;
    if (status === 'completed' && gate && progress) {
      const gateProgress = progress.filter(p => p.gate_id === gate.id && p.mastery_pct > 0);
      avgScore = gateProgress.length > 0
        ? Math.round(gateProgress.reduce((a, p) => a + p.mastery_pct, 0) / gateProgress.length)
        : 0;
    }

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
      students_attempted: gate ? (gateAttemptStats.get(gate.id)?.attempted || 0) : 0,
      students_passed: gate ? (gateAttemptStats.get(gate.id)?.passed || 0) : 0,
      student_scores: [],
    };
  });

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

  // Gate status
  const gatesStatus = (gates || []).map((g: any) => {
    const gateSessions = sessionData.filter(s => s.gate_id === g.id);
    const completedSessions = gateSessions.filter(s => s.status === 'completed').length;
    const inProgressSessions = gateSessions.filter(s => s.status === 'in_progress').length;
    const prereqsForGate = (prereqs || []).filter((p: any) => p.gate_id === g.id);
    const prereqsMet = prereqsForGate.every((p: any) => {
      const prereqGateSessions = sessionData.filter(s => {
        const pg = (gates || []).find((gg: any) => gg.id === p.prerequisite_gate_id);
        return pg && s.gate_id === pg.id;
      });
      return prereqGateSessions.length > 0 && prereqGateSessions.every(s => s.status === 'completed');
    });

    let status = 'locked';
    if (completedSessions >= gateSessions.length && gateSessions.length > 0) status = 'completed';
    else if (inProgressSessions > 0 || completedSessions > 0) status = 'in_progress';
    else if (prereqsMet || prereqsForGate.length === 0) status = 'unlocked';

    return {
      gate_id: g.id, gate_number: g.gate_number, short_title: g.short_title,
      title: g.title, color: g.color, light_color: g.light_color,
      status, sessions_in_gate: gateSessions.length, completed_sessions: completedSessions,
    };
  });

  const avgMastery = sessionData.filter(s => s.status === 'completed' && s.avg_quiz_score > 0).length > 0
    ? Math.round(sessionData.filter(s => s.status === 'completed').reduce((a, s) => a + s.avg_quiz_score, 0) / sessionData.filter(s => s.status === 'completed').length)
    : 0;

  const progressData = progress || [];
  const atRiskCount = new Set(progressData.filter(p => p.mastery_pct > 0 && p.mastery_pct < AT_RISK_THRESHOLD).map(p => p.student_id)).size;

  res.json({
    current_session: currentSession,
    total_sessions: totalSessions,
    completed_sessions: completedSessionCount,
    sessions: sessionData,
    gates_status: gatesStatus,
    course_stats: {
      overall_completion_pct: totalSessions > 0 ? Math.round((completedSessionCount / totalSessions) * 100) : 0,
      avg_mastery: avgMastery,
      total_quizzes_completed: completedSessionCount * studentCount,
      total_quizzes_possible: totalSessions * studentCount,
      students_on_track: Math.max(0, studentCount - atRiskCount),
      students_at_risk: atRiskCount,
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

  // Get questions for this lesson (same distribution logic as lesson.routes.ts)
  const { data: allGateQuestions } = await supabaseAdmin
    .from('questions').select('*').eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('bloom_level').order('difficulty');
  const { data: gateLessons } = await supabaseAdmin
    .from('lessons').select('id, lesson_number').eq('gate_id', lesson.gate_id).eq('course_id', courseId)
    .order('lesson_number');

  let questions = allGateQuestions || [];
  if (gateLessons && gateLessons.length > 0 && questions.length > 0) {
    const idx = gateLessons.findIndex(l => l.id === lessonId);
    if (idx >= 0) {
      const perLesson = Math.ceil(questions.length / gateLessons.length);
      questions = questions.slice(idx * perLesson, (idx + 1) * perLesson);
    }
  }

  if (questions.length === 0) { res.json({ analysis: null }); return; }

  const questionIds = questions.map(q => q.id);

  // Get all attempts for these questions
  const { data: attempts } = await supabaseAdmin
    .from('question_attempts')
    .select('*, profiles:student_id(full_name)')
    .in('question_id', questionIds);

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

  const { data: allAttempts } = await supabaseAdmin
    .from('question_attempts').select('student_id, question_id, gate_id, score, is_correct')
    .in('gate_id', (gates || []).map(g => g.id));

  const { data: questions } = await supabaseAdmin
    .from('questions').select('id, gate_id')
    .eq('course_id', courseId);

  const { data: enrollments } = await supabaseAdmin
    .from('enrollments').select('student_id, profiles:student_id(full_name)')
    .eq('course_id', courseId);

  if (!lessons || !allAttempts || !questions || !enrollments) {
    res.json({ trajectory: [] });
    return;
  }

  // Map question → gate
  const qGateMap = new Map(questions.map(q => [q.id, q.gate_id]));

  // For each lesson, compute class avg and per-student scores
  const trajectory = (lessons || []).map(l => {
    // Get questions for this lesson (same distribution logic)
    const gateQuestions = questions.filter(q => q.gate_id === l.gate_id);
    const gateLessonsForGate = (lessons || []).filter(ll => ll.gate_id === l.gate_id);
    const idx = gateLessonsForGate.findIndex(ll => ll.id === l.id);
    const perLesson = gateLessonsForGate.length > 0 ? Math.ceil(gateQuestions.length / gateLessonsForGate.length) : gateQuestions.length;
    const lessonQuestionIds = new Set(gateQuestions.slice(idx * perLesson, (idx + 1) * perLesson).map(q => q.id));

    const lessonAttempts = allAttempts.filter(a => lessonQuestionIds.has(a.question_id));

    // Per-student scores
    const studentScores: Record<string, number> = {};
    for (const e of enrollments) {
      const sa = lessonAttempts.filter(a => a.student_id === e.student_id);
      studentScores[e.student_id] = sa.length > 0 ? Math.round(sa.reduce((s, a) => s + a.score, 0) / sa.length) : 0;
    }

    const scores = Object.values(studentScores).filter(s => s > 0);
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

  // Student sparklines
  const students = enrollments.map(e => ({
    id: e.student_id,
    name: (e as any).profiles?.full_name || 'Unknown',
    scores: trajectory.map(t => t.student_scores[e.student_id] || 0),
    average: Math.round(trajectory.reduce((s, t) => s + (t.student_scores[e.student_id] || 0), 0) / Math.max(1, trajectory.length)),
  }));

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
