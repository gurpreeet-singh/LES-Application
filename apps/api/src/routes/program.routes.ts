import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AT_RISK_THRESHOLD } from '@leap/shared';
import { detectCrossCourseEdges } from '../services/cross-course-detection.service.js';
import { createLLMProvider } from '../services/llm/provider.js';

const router = Router();

// GET /programs — list programs for the current teacher (courses grouped by shared teacher)
router.get('/', async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.id;
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, title, subject, class_level, status')
      .eq('teacher_id', teacherId)
      .eq('status', 'active');

    // Group courses into "programs" — for college teachers with 3+ courses, treat as a program
    const activeCourses = courses || [];
    if (activeCourses.length >= 2) {
      res.json({
        programs: [{
          id: `prog-${teacherId}`,
          title: 'Computer Science Program',
          description: 'Cross-course AI/ML learning pathway',
          courses: activeCourses,
        }],
      });
    } else {
      res.json({ programs: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /programs/:programId/kg — Cross-course knowledge graph
router.get('/:programId/kg', async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.id;

    // Get all active courses for this teacher
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, title, subject, class_level, section, status')
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .order('class_level');

    if (!courses || courses.length === 0) {
      res.json({ courses: [], gates: [], edges: [], cross_edges: [] });
      return;
    }

    const courseIds = courses.map(c => c.id);

    // Get ALL gates across all courses
    const { data: gates } = await supabaseAdmin
      .from('gates')
      .select('id, course_id, gate_number, title, short_title, color, light_color, status, sort_order')
      .in('course_id', courseIds)
      .neq('status', 'rejected')
      .order('sort_order');

    const allGateIds = (gates || []).map(g => g.id);

    // Get ALL prerequisite edges (including cross-course!)
    const { data: edges } = await supabaseAdmin
      .from('gate_prerequisites')
      .select('gate_id, prerequisite_gate_id')
      .in('gate_id', allGateIds.length > 0 ? allGateIds : ['none']);

    // Also get edges where prerequisite_gate_id is in our gates (for incoming cross-course)
    const { data: incomingEdges } = await supabaseAdmin
      .from('gate_prerequisites')
      .select('gate_id, prerequisite_gate_id')
      .in('prerequisite_gate_id', allGateIds.length > 0 ? allGateIds : ['none']);

    // Merge and deduplicate edges
    const allEdges = [...(edges || []), ...(incomingEdges || [])];
    const edgeSet = new Set(allEdges.map(e => `${e.gate_id}|${e.prerequisite_gate_id}`));
    const uniqueEdges = [...edgeSet].map(key => {
      const [gateId, prereqId] = key.split('|');
      return { gate_id: gateId, prerequisite_gate_id: prereqId };
    });

    // Classify edges
    const gateToCourseLookup = new Map((gates || []).map(g => [g.id, g.course_id]));
    const withinCourseEdges = uniqueEdges.filter(e =>
      gateToCourseLookup.get(e.gate_id) === gateToCourseLookup.get(e.prerequisite_gate_id)
    );
    const crossCourseEdges = uniqueEdges.filter(e =>
      gateToCourseLookup.has(e.gate_id) && gateToCourseLookup.has(e.prerequisite_gate_id) &&
      gateToCourseLookup.get(e.gate_id) !== gateToCourseLookup.get(e.prerequisite_gate_id)
    );

    // Get student progress across all courses
    const { data: progress } = await supabaseAdmin
      .from('student_gate_progress')
      .select('student_id, gate_id, course_id, mastery_pct')
      .in('course_id', courseIds);

    // Get enrolled students
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, course_id')
      .in('course_id', courseIds);

    const studentIds = [...new Set((enrollments || []).map(e => e.student_id))];
    const { data: students } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds.length > 0 ? studentIds : ['none']);

    // Per-gate mastery averages
    const gateMasteryMap: Record<string, number[]> = {};
    (progress || []).forEach(p => {
      if (!gateMasteryMap[p.gate_id]) gateMasteryMap[p.gate_id] = [];
      gateMasteryMap[p.gate_id].push(p.mastery_pct || 0);
    });

    const gatesWithMastery = (gates || []).map(g => {
      const scores = gateMasteryMap[g.id] || [];
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { ...g, avg_mastery: avg, student_count: scores.length };
    });

    // Bottleneck analysis: for cross-course edges, find students blocked
    const bottlenecks = crossCourseEdges.map(edge => {
      const prereqScores = (progress || []).filter(p => p.gate_id === edge.prerequisite_gate_id);
      const blocked = prereqScores.filter(p => (p.mastery_pct || 0) < 60).length;
      const prereqGate = (gates || []).find(g => g.id === edge.prerequisite_gate_id);
      const targetGate = (gates || []).find(g => g.id === edge.gate_id);
      return {
        from_gate: prereqGate ? `${prereqGate.short_title}` : '?',
        from_course: courses.find(c => c.id === prereqGate?.course_id)?.title || '?',
        to_gate: targetGate ? `${targetGate.short_title}` : '?',
        to_course: courses.find(c => c.id === targetGate?.course_id)?.title || '?',
        blocked_students: blocked,
        total_students: prereqScores.length,
      };
    }).filter(b => b.blocked_students > 0).sort((a, b) => b.blocked_students - a.blocked_students);

    // Student cross-course summary
    const studentSummaries = (students || []).map(student => {
      const studentProgress = (progress || []).filter(p => p.student_id === student.id);
      const byCourse = courses.map(c => {
        const courseProgress = studentProgress.filter(p => p.course_id === c.id);
        const avg = courseProgress.length > 0 ? Math.round(courseProgress.reduce((s, p) => s + (p.mastery_pct || 0), 0) / courseProgress.length) : 0;
        return { course_id: c.id, course_title: c.title, avg_mastery: avg };
      });
      const overall = byCourse.filter(c => c.avg_mastery > 0);
      const avgAll = overall.length > 0 ? Math.round(overall.reduce((s, c) => s + c.avg_mastery, 0) / overall.length) : 0;
      return { id: student.id, name: student.full_name, overall_mastery: avgAll, at_risk: avgAll < AT_RISK_THRESHOLD, courses: byCourse };
    }).sort((a, b) => a.overall_mastery - b.overall_mastery);

    res.json({
      courses,
      gates: gatesWithMastery,
      within_edges: withinCourseEdges,
      cross_edges: crossCourseEdges,
      bottlenecks,
      students: studentSummaries,
    });
  } catch (err: any) {
    console.error('Program KG error:', err.message);
    res.status(500).json({ error: 'Failed to fetch program knowledge graph' });
  }
});

// POST /programs/:programId/detect-edges — manually trigger cross-course dependency detection
router.post('/:programId/detect-edges', async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.id;
    const provider = createLLMProvider('anthropic');
    const edgesFound = await detectCrossCourseEdges(supabaseAdmin, provider, '', teacherId);
    res.json({ edges_found: edgesFound, message: edgesFound > 0 ? `Detected ${edgesFound} new cross-course dependencies` : 'No new dependencies found' });
  } catch (err: any) {
    console.error('Manual cross-course detection error:', err.message);
    res.status(500).json({ error: 'Failed to detect cross-course dependencies' });
  }
});

export default router;
