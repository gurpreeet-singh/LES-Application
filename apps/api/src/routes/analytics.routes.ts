import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { BLOOM_REACH_THRESHOLD, MASTERY_THRESHOLD, AT_RISK_THRESHOLD } from '@les/shared';

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

export default router;
