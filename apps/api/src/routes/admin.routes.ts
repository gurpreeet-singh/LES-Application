import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/role.js';
import { supabaseAdmin } from '../config/supabase.js';
import { MASTERY_THRESHOLD, AT_RISK_THRESHOLD } from '@leap/shared';

const router = Router();

// All admin routes require admin role
router.use(requireRole('admin'));

// GET /admin/overview — school-wide summary stats
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const { data: teachers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'teacher');

    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, status, teacher_id');

    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, course_id');

    const { data: progress } = await supabaseAdmin
      .from('student_gate_progress')
      .select('student_id, mastery_pct');

    const activeCourses = courses?.filter(c => c.status === 'active') || [];
    const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []);

    // At-risk: students whose average mastery across all gates < AT_RISK_THRESHOLD
    const studentMasteries: Record<string, number[]> = {};
    (progress || []).forEach(p => {
      if (!studentMasteries[p.student_id]) studentMasteries[p.student_id] = [];
      studentMasteries[p.student_id].push(p.mastery_pct || 0);
    });
    const atRiskStudents = Object.entries(studentMasteries).filter(
      ([, scores]) => scores.reduce((a, b) => a + b, 0) / scores.length < AT_RISK_THRESHOLD
    ).length;

    // Average mastery across all progress records
    const allScores = (progress || []).map(p => p.mastery_pct || 0);
    const avgMastery = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    res.json({
      total_teachers: teachers?.length || 0,
      total_courses: courses?.length || 0,
      active_courses: activeCourses.length,
      total_students: uniqueStudents.size,
      at_risk_students: atRiskStudents,
      avg_mastery: avgMastery,
    });
  } catch (err: any) {
    console.error('Admin overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /admin/teachers — all teachers with course summaries
router.get('/teachers', async (_req: Request, res: Response) => {
  try {
    const { data: teachers } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name');

    if (!teachers || teachers.length === 0) {
      res.json({ teachers: [] });
      return;
    }

    const teacherIds = teachers.map(t => t.id);

    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('*')
      .in('teacher_id', teacherIds);

    const courseIds = (courses || []).map(c => c.id);

    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, course_id')
      .in('course_id', courseIds);

    const { data: progress } = await supabaseAdmin
      .from('student_gate_progress')
      .select('student_id, course_id, mastery_pct, bloom_scores')
      .in('course_id', courseIds);

    const { data: gates } = await supabaseAdmin
      .from('gates')
      .select('id, course_id, gate_number, short_title, status')
      .in('course_id', courseIds);

    const { data: lessons } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, status')
      .in('course_id', courseIds);

    // Build teacher summaries
    const teacherSummaries = teachers.map(teacher => {
      const teacherCourses = (courses || []).filter(c => c.teacher_id === teacher.id);
      const teacherCourseIds = teacherCourses.map(c => c.id);

      const courseDetails = teacherCourses.map(course => {
        const courseEnrollments = (enrollments || []).filter(e => e.course_id === course.id);
        const courseProgress = (progress || []).filter(p => p.course_id === course.id);
        const courseGates = (gates || []).filter(g => g.course_id === course.id);
        const courseLessons = (lessons || []).filter(l => l.course_id === course.id);

        const studentIds = [...new Set(courseEnrollments.map(e => e.student_id))];

        // Per-student average mastery
        const studentAvgs: Record<string, number[]> = {};
        courseProgress.forEach(p => {
          if (!studentAvgs[p.student_id]) studentAvgs[p.student_id] = [];
          studentAvgs[p.student_id].push(p.mastery_pct || 0);
        });

        const studentsOnTrack = Object.entries(studentAvgs).filter(
          ([, scores]) => scores.reduce((a, b) => a + b, 0) / scores.length >= MASTERY_THRESHOLD
        ).length;

        const studentsAtRisk = Object.entries(studentAvgs).filter(
          ([, scores]) => scores.reduce((a, b) => a + b, 0) / scores.length < AT_RISK_THRESHOLD
        ).length;

        const allMasteries = courseProgress.map(p => p.mastery_pct || 0);
        const avgMastery = allMasteries.length > 0
          ? Math.round(allMasteries.reduce((a, b) => a + b, 0) / allMasteries.length)
          : 0;

        // Completion: accepted gates / total gates
        const acceptedGates = courseGates.filter(g => g.status === 'accepted').length;
        const completionPct = courseGates.length > 0
          ? Math.round((acceptedGates / courseGates.length) * 100)
          : 0;

        // Accepted lessons / total lessons
        const acceptedLessons = courseLessons.filter(l => l.status === 'accepted').length;

        return {
          id: course.id,
          title: course.title,
          subject: course.subject,
          class_level: course.class_level,
          section: course.section,
          academic_year: course.academic_year,
          status: course.status,
          total_students: studentIds.length,
          students_on_track: studentsOnTrack,
          students_at_risk: studentsAtRisk,
          avg_mastery: avgMastery,
          total_gates: courseGates.length,
          accepted_gates: acceptedGates,
          total_lessons: courseLessons.length,
          accepted_lessons: acceptedLessons,
          completion_pct: completionPct,
        };
      });

      // Aggregate teacher-level stats
      const totalStudents = courseDetails.reduce((s, c) => s + c.total_students, 0);
      const totalAtRisk = courseDetails.reduce((s, c) => s + c.students_at_risk, 0);
      const activeCourses = courseDetails.filter(c => c.status === 'active').length;
      const allMasteries = courseDetails.filter(c => c.avg_mastery > 0).map(c => c.avg_mastery);
      const teacherAvgMastery = allMasteries.length > 0
        ? Math.round(allMasteries.reduce((a, b) => a + b, 0) / allMasteries.length)
        : 0;

      return {
        ...teacher,
        stats: {
          total_courses: teacherCourses.length,
          active_courses: activeCourses,
          total_students: totalStudents,
          students_at_risk: totalAtRisk,
          avg_mastery: teacherAvgMastery,
        },
        courses: courseDetails,
      };
    });

    res.json({ teachers: teacherSummaries });
  } catch (err: any) {
    console.error('Admin teachers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// GET /admin/teachers/:teacherId — detailed teacher view with per-course analytics
router.get('/teachers/:teacherId', async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params;

    const { data: teacher } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single();

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('teacher_id', teacherId);

    const courseIds = (courses || []).map(c => c.id);

    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, course_id')
      .in('course_id', courseIds);

    const { data: progress } = await supabaseAdmin
      .from('student_gate_progress')
      .select('*')
      .in('course_id', courseIds);

    const { data: gates } = await supabaseAdmin
      .from('gates')
      .select('*')
      .in('course_id', courseIds)
      .order('gate_number');

    const { data: students } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [...new Set((enrollments || []).map(e => e.student_id))]);

    const { data: suggestions } = await supabaseAdmin
      .from('ai_suggestions')
      .select('*')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });

    // Build detailed course analytics
    const courseDetails = (courses || []).map(course => {
      const courseEnrollments = (enrollments || []).filter(e => e.course_id === course.id);
      const courseProgress = (progress || []).filter(p => p.course_id === course.id);
      const courseGates = (gates || []).filter(g => g.course_id === course.id);
      const courseSuggestions = (suggestions || []).filter(s => s.course_id === course.id);
      const courseStudentIds = [...new Set(courseEnrollments.map(e => e.student_id))];
      const courseStudents = (students || []).filter(s => courseStudentIds.includes(s.id));

      // Build student performance table
      const studentPerformance = courseStudents.map(student => {
        const studentProgress = courseProgress.filter(p => p.student_id === student.id);
        const gateScores = courseGates.map(gate => {
          const gp = studentProgress.find(p => p.gate_id === gate.id);
          return {
            gate_id: gate.id,
            gate_number: gate.gate_number,
            short_title: gate.short_title,
            mastery_pct: gp?.mastery_pct || 0,
            bloom_ceiling: gp?.bloom_ceiling || null,
          };
        });
        const avg = gateScores.length > 0
          ? Math.round(gateScores.reduce((s, g) => s + g.mastery_pct, 0) / gateScores.length)
          : 0;

        return {
          id: student.id,
          name: student.full_name,
          avg_mastery: avg,
          at_risk: avg < AT_RISK_THRESHOLD,
          gate_scores: gateScores,
        };
      });

      const avgMastery = studentPerformance.length > 0
        ? Math.round(studentPerformance.reduce((s, sp) => s + sp.avg_mastery, 0) / studentPerformance.length)
        : 0;

      return {
        ...course,
        gates: courseGates.map(g => ({ id: g.id, gate_number: g.gate_number, short_title: g.short_title, color: g.color })),
        students: studentPerformance,
        avg_mastery: avgMastery,
        total_students: courseStudents.length,
        students_at_risk: studentPerformance.filter(s => s.at_risk).length,
        suggestions: courseSuggestions.slice(0, 5),
      };
    });

    // Generate principal-level suggestions
    const principalSuggestions = generatePrincipalSuggestions(teacher, courseDetails);

    res.json({
      teacher,
      courses: courseDetails,
      suggestions: principalSuggestions,
    });
  } catch (err: any) {
    console.error('Admin teacher detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch teacher details' });
  }
});

// Generate high-level suggestions for the principal about a teacher
function generatePrincipalSuggestions(teacher: any, courses: any[]): any[] {
  const suggestions: any[] = [];

  for (const course of courses) {
    if (course.status !== 'active') continue;

    // High at-risk ratio
    if (course.total_students > 0) {
      const riskRatio = course.students_at_risk / course.total_students;
      if (riskRatio >= 0.4) {
        suggestions.push({
          type: 'high_risk',
          severity: 'critical',
          teacher: teacher.full_name,
          course: course.title,
          message: `${course.students_at_risk} of ${course.total_students} students (${Math.round(riskRatio * 100)}%) are at risk in ${course.title}. Consider scheduling a review meeting with ${teacher.full_name}.`,
        });
      }
    }

    // Low average mastery
    if (course.avg_mastery > 0 && course.avg_mastery < 50) {
      suggestions.push({
        type: 'low_mastery',
        severity: 'warning',
        teacher: teacher.full_name,
        course: course.title,
        message: `Average class mastery in ${course.title} is ${course.avg_mastery}% — well below the ${MASTERY_THRESHOLD}% target. ${teacher.full_name} may benefit from pedagogical support or pacing adjustment.`,
      });
    }

    // Unreviewed AI suggestions
    const pendingSuggestions = (course.suggestions || []).filter((s: any) => s.status === 'pending');
    if (pendingSuggestions.length >= 3) {
      suggestions.push({
        type: 'unreviewed_suggestions',
        severity: 'info',
        teacher: teacher.full_name,
        course: course.title,
        message: `${teacher.full_name} has ${pendingSuggestions.length} unreviewed AI suggestions for ${course.title}. A gentle reminder may help.`,
      });
    }

    // Students excelling — positive note
    const excellingStudents = (course.students || []).filter((s: any) => s.avg_mastery >= 90);
    if (excellingStudents.length >= 3) {
      suggestions.push({
        type: 'excellence',
        severity: 'success',
        teacher: teacher.full_name,
        course: course.title,
        message: `${excellingStudents.length} students are excelling (90%+ mastery) in ${course.title}. ${teacher.full_name}'s teaching approach is yielding strong results.`,
      });
    }

    // Specific gate struggles
    for (const gate of course.gates || []) {
      const gateScores = (course.students || [])
        .map((s: any) => s.gate_scores?.find((g: any) => g.gate_id === gate.id)?.mastery_pct || 0)
        .filter((s: number) => s > 0);
      if (gateScores.length > 0) {
        const gateAvg = gateScores.reduce((a: number, b: number) => a + b, 0) / gateScores.length;
        if (gateAvg < 45) {
          suggestions.push({
            type: 'gate_struggle',
            severity: 'warning',
            teacher: teacher.full_name,
            course: course.title,
            message: `Gate ${gate.gate_number} (${gate.short_title}) in ${course.title} has a class average of only ${Math.round(gateAvg)}%. This topic may need additional sessions or a different approach.`,
          });
        }
      }
    }
  }

  // Sort: critical first, then warning, then info, then success
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  suggestions.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

  return suggestions;
}

// ─── NEW SPRINT 1 ENDPOINTS ──────────────────────────────────────────────────

// GET /admin/briefing — morning briefing with prioritized alerts and actions
router.get('/briefing', async (_req: Request, res: Response) => {
  try {
    // Fetch all data in parallel
    const [
      { data: teachers },
      { data: courses },
      { data: progress },
      { data: enrollments },
      { data: suggestions },
      { data: gates },
      { data: lessons },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email').eq('role', 'teacher'),
      supabaseAdmin.from('courses').select('id, title, subject, class_level, section, status, teacher_id, updated_at'),
      supabaseAdmin.from('student_gate_progress').select('student_id, course_id, gate_id, mastery_pct'),
      supabaseAdmin.from('enrollments').select('student_id, course_id'),
      supabaseAdmin.from('ai_suggestions').select('id, course_id, status, generated_at'),
      supabaseAdmin.from('gates').select('id, course_id, gate_number, short_title'),
      supabaseAdmin.from('lessons').select('id, course_id, status'),
    ]);

    const alerts: any[] = [];
    const positives: any[] = [];
    const teacherMap = new Map((teachers || []).map(t => [t.id, t]));

    // Group data by course
    const activeCourses = (courses || []).filter(c => c.status === 'active');

    for (const course of activeCourses) {
      const teacher = teacherMap.get(course.teacher_id);
      if (!teacher) continue;

      const courseEnrollments = (enrollments || []).filter(e => e.course_id === course.id);
      const courseProgress = (progress || []).filter(p => p.course_id === course.id);
      const courseSuggestions = (suggestions || []).filter(s => s.course_id === course.id);
      const courseGates = (gates || []).filter(g => g.course_id === course.id);
      const studentCount = new Set(courseEnrollments.map(e => e.student_id)).size;

      if (studentCount === 0) continue;

      // Compute per-student averages
      const studentAvgs: Record<string, number[]> = {};
      courseProgress.forEach(p => {
        if (!studentAvgs[p.student_id]) studentAvgs[p.student_id] = [];
        studentAvgs[p.student_id].push(p.mastery_pct || 0);
      });

      const atRiskCount = Object.values(studentAvgs).filter(
        scores => scores.reduce((a, b) => a + b, 0) / scores.length < AT_RISK_THRESHOLD
      ).length;

      const avgMastery = courseProgress.length > 0
        ? Math.round(courseProgress.reduce((s, p) => s + (p.mastery_pct || 0), 0) / courseProgress.length)
        : 0;

      const riskRatio = atRiskCount / studentCount;
      const label = `${course.title} (${teacher.full_name})`;

      // CRITICAL: High at-risk ratio
      if (riskRatio >= 0.4) {
        alerts.push({
          id: `risk-${course.id}`,
          severity: 'critical',
          title: `${Math.round(riskRatio * 100)}% students at risk`,
          message: `${atRiskCount} of ${studentCount} students are below 60% mastery in ${label}.`,
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
          course_id: course.id,
          course_title: course.title,
          actions: [
            { type: 'schedule_meeting', label: 'Schedule Review Meeting' },
            { type: 'nudge_teacher', label: 'Send Nudge' },
          ],
        });
      }

      // WARNING: Low mastery
      if (avgMastery > 0 && avgMastery < 50) {
        alerts.push({
          id: `mastery-${course.id}`,
          severity: 'warning',
          title: `Low class mastery: ${avgMastery}%`,
          message: `Average mastery in ${label} is well below the ${MASTERY_THRESHOLD}% target.`,
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
          course_id: course.id,
          course_title: course.title,
          actions: [
            { type: 'assign_mentor', label: 'Assign Mentor' },
            { type: 'schedule_meeting', label: 'Discuss Approach' },
          ],
        });
      }

      // WARNING: Gate-specific struggles
      for (const gate of courseGates) {
        const gateScores = courseProgress
          .filter(p => p.gate_id === gate.id && p.mastery_pct > 0)
          .map(p => p.mastery_pct);
        if (gateScores.length >= 3) {
          const gateAvg = Math.round(gateScores.reduce((a, b) => a + b, 0) / gateScores.length);
          if (gateAvg < 40) {
            alerts.push({
              id: `gate-${gate.id}`,
              severity: 'warning',
              title: `Topic struggling: ${gate.short_title}`,
              message: `Gate ${gate.gate_number} (${gate.short_title}) in ${label} averages only ${gateAvg}%. Consider a workshop or teaching strategy change.`,
              teacher_id: teacher.id,
              teacher_name: teacher.full_name,
              course_id: course.id,
              course_title: course.title,
              actions: [
                { type: 'request_workshop', label: 'Request Workshop' },
                { type: 'nudge_teacher', label: 'Suggest Review' },
              ],
            });
          }
        }
      }

      // INFO: Unreviewed AI suggestions
      const pendingCount = courseSuggestions.filter(s => s.status === 'pending').length;
      if (pendingCount >= 3) {
        alerts.push({
          id: `suggestions-${course.id}`,
          severity: 'info',
          title: `${pendingCount} unreviewed AI suggestions`,
          message: `${teacher.full_name} has ${pendingCount} pending AI suggestions for ${course.title}.`,
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
          course_id: course.id,
          course_title: course.title,
          actions: [
            { type: 'nudge_teacher', label: 'Send Reminder' },
          ],
        });
      }

      // POSITIVE: High-performing class
      const excellingStudents = Object.values(studentAvgs).filter(
        scores => scores.reduce((a, b) => a + b, 0) / scores.length >= 85
      ).length;
      if (excellingStudents >= 3 && avgMastery >= 75) {
        positives.push({
          id: `excel-${course.id}`,
          title: `Strong results in ${course.title}`,
          message: `${excellingStudents} students excelling with ${avgMastery}% avg mastery. ${teacher.full_name}'s approach is working well.`,
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
        });
      }
    }

    // Check for stale courses (in draft/review for > 14 days)
    const now = new Date();
    const staleCourses = (courses || []).filter(c => {
      if (c.status !== 'draft' && c.status !== 'review') return false;
      const updated = new Date(c.updated_at);
      return (now.getTime() - updated.getTime()) > 14 * 24 * 60 * 60 * 1000;
    });
    if (staleCourses.length > 0) {
      const staleTeachers = [...new Set(staleCourses.map(c => teacherMap.get(c.teacher_id)?.full_name).filter(Boolean))];
      alerts.push({
        id: 'stale-courses',
        severity: 'info',
        title: `${staleCourses.length} courses inactive for 2+ weeks`,
        message: `Courses from ${staleTeachers.join(', ')} haven't progressed. They may need help completing setup.`,
        actions: [
          { type: 'schedule_training', label: 'Schedule Training' },
        ],
      });
    }

    // Sort alerts: critical > warning > info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    res.json({
      date: now.toISOString().split('T')[0],
      alerts: alerts.slice(0, 8), // Top 8 alerts
      positives: positives.slice(0, 3), // Top 3 positives
      summary: {
        critical_count: alerts.filter(a => a.severity === 'critical').length,
        warning_count: alerts.filter(a => a.severity === 'warning').length,
        info_count: alerts.filter(a => a.severity === 'info').length,
      },
    });
  } catch (err: any) {
    console.error('Admin briefing error:', err.message);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

// GET /admin/teacher-effectiveness — quadrant data with engagement scores
router.get('/teacher-effectiveness', async (_req: Request, res: Response) => {
  try {
    const { data: teachers } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'teacher');

    if (!teachers || teachers.length === 0) {
      res.json({ teachers: [] });
      return;
    }

    const teacherIds = teachers.map(t => t.id);

    const [
      { data: courses },
      { data: progress },
      { data: allSuggestions },
      { data: lessons },
    ] = await Promise.all([
      supabaseAdmin.from('courses').select('id, teacher_id, status, updated_at').in('teacher_id', teacherIds),
      supabaseAdmin.from('student_gate_progress').select('course_id, mastery_pct'),
      supabaseAdmin.from('ai_suggestions').select('course_id, status'),
      supabaseAdmin.from('lessons').select('course_id, status'),
    ]);

    const result = teachers.map(teacher => {
      const teacherCourses = (courses || []).filter(c => c.teacher_id === teacher.id);
      const courseIds = teacherCourses.map(c => c.id);
      const activeCourses = teacherCourses.filter(c => c.status === 'active');

      // Mastery score (0-100)
      const teacherProgress = (progress || []).filter(p => courseIds.includes(p.course_id));
      const avgMastery = teacherProgress.length > 0
        ? Math.round(teacherProgress.reduce((s, p) => s + (p.mastery_pct || 0), 0) / teacherProgress.length)
        : 0;

      // Engagement score (0-100) — composite of multiple signals
      const teacherSuggestions = (allSuggestions || []).filter(s => courseIds.includes(s.course_id));
      const teacherLessons = (lessons || []).filter(l => courseIds.includes(l.course_id));

      // Signal 1: Suggestion review rate (0-40 points)
      const totalSuggestions = teacherSuggestions.length;
      const reviewedSuggestions = teacherSuggestions.filter(s => s.status !== 'pending').length;
      const suggestionScore = totalSuggestions > 0
        ? Math.round((reviewedSuggestions / totalSuggestions) * 40)
        : 20; // Neutral if no suggestions

      // Signal 2: Course activation rate (0-30 points)
      const activationScore = teacherCourses.length > 0
        ? Math.round((activeCourses.length / teacherCourses.length) * 30)
        : 0;

      // Signal 3: Content review completion (0-30 points)
      const acceptedLessons = teacherLessons.filter(l => l.status === 'accepted').length;
      const reviewScore = teacherLessons.length > 0
        ? Math.round((acceptedLessons / teacherLessons.length) * 30)
        : 0;

      const engagementScore = Math.min(100, suggestionScore + activationScore + reviewScore);

      // Quadrant classification
      let quadrant: 'star' | 'traditionalist' | 'striver' | 'needs_attention';
      if (avgMastery >= 65 && engagementScore >= 50) quadrant = 'star';
      else if (avgMastery >= 65 && engagementScore < 50) quadrant = 'traditionalist';
      else if (avgMastery < 65 && engagementScore >= 50) quadrant = 'striver';
      else quadrant = 'needs_attention';

      return {
        id: teacher.id,
        full_name: teacher.full_name,
        email: teacher.email,
        avg_mastery: avgMastery,
        engagement_score: engagementScore,
        quadrant,
        total_courses: teacherCourses.length,
        active_courses: activeCourses.length,
      };
    }).filter(t => t.total_courses > 0); // Only teachers with courses

    // Sort by quadrant priority: needs_attention first, then strivers, traditionalists, stars
    const quadrantOrder: Record<string, number> = { needs_attention: 0, striver: 1, traditionalist: 2, star: 3 };
    result.sort((a, b) => (quadrantOrder[a.quadrant] ?? 4) - (quadrantOrder[b.quadrant] ?? 4));

    res.json({ teachers: result });
  } catch (err: any) {
    console.error('Admin teacher effectiveness error:', err.message);
    res.status(500).json({ error: 'Failed to compute teacher effectiveness' });
  }
});

// POST /admin/actions — record a principal action (graceful if table doesn't exist)
router.post('/actions', async (req: Request, res: Response) => {
  try {
    const { action_type, target_teacher_id, target_student_id, target_course_id, note } = req.body;

    if (!action_type) {
      res.status(400).json({ error: 'action_type is required' });
      return;
    }

    const { data, error } = await supabaseAdmin.from('principal_actions').insert({
      principal_id: req.user!.id,
      action_type,
      target_teacher_id: target_teacher_id || null,
      target_student_id: target_student_id || null,
      target_course_id: target_course_id || null,
      note: note || null,
      status: 'completed',
    }).select().single();

    if (error) {
      // Table might not exist yet — log but don't fail the UX
      console.warn('Principal action log failed (table may not exist):', error.message);
      res.json({ logged: false, message: 'Action noted (logging table pending migration)' });
      return;
    }

    res.json({ logged: true, action: data });
  } catch (err: any) {
    console.warn('Principal action error:', err.message);
    res.json({ logged: false, message: 'Action noted' });
  }
});

// ─── TIMETABLE & SUBSTITUTE SYSTEM ───────────────────────────────────────────

const PERIOD_TIMINGS = [
  { period: 1, start: '07:50', end: '08:30' },
  { period: 2, start: '08:30', end: '09:10' },
  { period: 3, start: '09:10', end: '09:50' },
  { period: 4, start: '10:10', end: '10:50' },
  { period: 5, start: '10:50', end: '11:30' },
  { period: 6, start: '11:30', end: '12:10' },
  { period: 7, start: '12:50', end: '13:30' },
  { period: 8, start: '13:30', end: '14:10' },
];

// Deterministic hash for consistent timetable generation from teacher+day
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// GET /admin/timetable/today — generate today's timetable from existing course data
router.get('/timetable/today', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...6=Sat
    if (dayOfWeek === 0) {
      res.json({ date: today.toISOString().split('T')[0], day_of_week: 0, periods: [], stats: { total_periods: 0, covered: 0, uncovered: 0, teachers_present: 0, teachers_absent: 0 }, period_timings: PERIOD_TIMINGS, absent_teachers: [] });
      return;
    }

    const [{ data: teachers }, { data: courses }, { data: progress }, { data: lessons }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email').eq('role', 'teacher'),
      supabaseAdmin.from('courses').select('id, teacher_id, title, subject, class_level, section, status, total_sessions'),
      supabaseAdmin.from('student_gate_progress').select('course_id, mastery_pct'),
      supabaseAdmin.from('lessons').select('id, course_id, title, lesson_number, objective').order('lesson_number'),
    ]);

    const activeCourses = (courses || []).filter(c => c.status === 'active');
    const teacherMap = new Map((teachers || []).map(t => [t.id, t]));
    const teacherArr = teachers || [];

    // Subjects for each class level (realistic Indian school curriculum)
    const CLASS_SUBJECTS: Record<string, string[]> = {
      '1': ['English', 'Hindi', 'Mathematics', 'EVS', 'Art'],
      '2': ['English', 'Hindi', 'Mathematics', 'EVS', 'Art'],
      '3': ['English', 'Hindi', 'Mathematics', 'EVS', 'Computer', 'Art'],
      '4': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Computer'],
      '5': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Computer'],
      '6': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Sanskrit', 'Computer'],
      '7': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Sanskrit', 'Computer'],
      '8': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies', 'Sanskrit', 'Computer'],
      '9': ['English', 'Hindi', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Social Studies'],
      '10': ['English', 'Hindi', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Social Studies'],
      '11': ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics'],
      '12': ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics'],
    };
    const SECTIONS = ['A', 'B', 'C'];

    // Generate full school timetable for classes 1-12
    const schedule: any[] = [];
    const teacherPeriods: Record<string, number[]> = {};
    let teacherIdx = 0;

    for (let classNum = 1; classNum <= 12; classNum++) {
      const subjects = CLASS_SUBJECTS[String(classNum)] || ['English', 'Mathematics', 'Science'];
      const numSections = classNum <= 5 ? 3 : classNum <= 8 ? 2 : 2;

      for (let secIdx = 0; secIdx < numSections; secIdx++) {
        const section = SECTIONS[secIdx] || 'A';

        for (let period = 1; period <= 8; period++) {
          // Pick a subject for this period (rotate through subjects)
          const subjectIdx = (period - 1 + classNum + secIdx) % subjects.length;
          const subject = subjects[subjectIdx];

          // Assign a teacher deterministically
          const seed = simpleHash(`${classNum}-${section}-${period}-${dayOfWeek}`);
          const tIdx = seed % teacherArr.length;
          const teacher = teacherArr[tIdx];
          if (!teacher) continue;

          if (!teacherPeriods[teacher.id]) teacherPeriods[teacher.id] = [];
          teacherPeriods[teacher.id].push(period);

          // Find matching course + lesson if available
          const matchingCourse = activeCourses.find(c => c.teacher_id === teacher.id);
          const courseLessons = matchingCourse ? (lessons || []).filter(l => l.course_id === matchingCourse.id) : [];
          const lessonIdx = Math.min((seed + period) % Math.max(courseLessons.length, 1), courseLessons.length - 1);
          const currentLesson = courseLessons[lessonIdx];

          // Generate realistic lesson titles per subject
          const LESSON_BANK: Record<string, string[]> = {
            'English': ['Reading Comprehension', 'Creative Writing', 'Grammar — Tenses', 'Poetry Analysis', 'Essay Writing', 'Vocabulary Building', 'Speaking & Listening', 'Literature Circle'],
            'Hindi': ['Gadya Path', 'Kavita', 'Vyakaran — Sandhi', 'Nibandh Lekhan', 'Swar Vyanjan', 'Kahani Lekhan', 'Anuchhed Lekhan', 'Patra Lekhan'],
            'Mathematics': ['Number Systems', 'Algebra — Linear Equations', 'Geometry — Triangles', 'Mensuration', 'Statistics', 'Fractions & Decimals', 'Ratio & Proportion', 'Data Handling'],
            'Science': ['Living Things', 'Force & Motion', 'Light & Sound', 'Chemical Reactions', 'Human Body Systems', 'Ecosystems', 'Electricity', 'Matter & Materials'],
            'Physics': ['Laws of Motion', 'Work & Energy', 'Optics', 'Electrostatics', 'Current Electricity', 'Magnetism', 'Waves', 'Thermodynamics'],
            'Chemistry': ['Atomic Structure', 'Chemical Bonding', 'Acids & Bases', 'Periodic Table', 'Organic Chemistry', 'Redox Reactions', 'Solutions', 'Electrochemistry'],
            'Biology': ['Cell Structure', 'Plant Physiology', 'Human Reproduction', 'Genetics', 'Ecology', 'Evolution', 'Biotechnology', 'Animal Tissues'],
            'Social Studies': ['Indian History', 'Geography — Maps', 'Civics — Democracy', 'Economics — Resources', 'World History', 'Climate & Weather', 'Indian Constitution', 'Globalisation'],
            'EVS': ['Our Environment', 'Plants Around Us', 'Water Cycle', 'Seasons & Weather', 'Animals & Habitats', 'Food & Nutrition', 'Our Body', 'Travel & Transport'],
            'Computer': ['Introduction to Coding', 'MS Office', 'Internet Safety', 'Scratch Programming', 'HTML Basics', 'Python Fundamentals', 'Data Types', 'Algorithms'],
            'Computer Science': ['Python Programming', 'Data Structures', 'SQL & Databases', 'Networking', 'Boolean Algebra', 'Computer Architecture', 'Algorithms', 'Web Development'],
            'Sanskrit': ['Shabda Roop', 'Dhatu Roop', 'Sandhi', 'Subhashitani', 'Patra Lekhanam', 'Gadyam Pathah', 'Kavya Pathah', 'Anuvad'],
            'Art': ['Sketch & Drawing', 'Water Colors', 'Origami', 'Clay Modelling', 'Collage Making', 'Still Life', 'Abstract Art', 'Folk Art'],
            'Economics': ['Microeconomics', 'Macroeconomics', 'Indian Economy', 'Money & Banking', 'National Income', 'Demand & Supply', 'Market Structures', 'Budget & Fiscal Policy'],
          };
          const lessonBank = LESSON_BANK[subject] || ['Lesson'];
          const lessonTitle = currentLesson?.title || lessonBank[(seed + period) % lessonBank.length];
          const lessonObjective = currentLesson?.objective || '';

          schedule.push({
            period_number: period,
            teacher_id: teacher.id,
            teacher_name: teacher.full_name,
            course_id: matchingCourse?.id || `gen-${classNum}-${section}`,
            subject,
            class_level: String(classNum),
            section,
            status: 'normal',
            lesson_title: lessonTitle,
            lesson_objective: lessonObjective,
          });
        }
      }
    }

    // Mark 2-3 teachers as "absent" for demo (deterministic based on date)
    const dateSeed = simpleHash(today.toISOString().split('T')[0]);
    const teacherList = [...new Set(schedule.map(s => s.teacher_id))];
    const absentCount = Math.min(2 + (dateSeed % 2), Math.floor(teacherList.length / 3));
    const absentTeacherIds = new Set<string>();
    for (let i = 0; i < absentCount; i++) {
      const idx = (dateSeed + i * 7) % teacherList.length;
      absentTeacherIds.add(teacherList[idx]);
    }

    // Update schedule statuses
    schedule.forEach(s => {
      if (absentTeacherIds.has(s.teacher_id)) s.status = 'absent';
    });

    // Build absent teacher details with affected periods
    const absentTeachers = [...absentTeacherIds].map(tid => {
      const teacher = teacherMap.get(tid);
      const affectedPeriods = schedule.filter(s => s.teacher_id === tid);
      const reasons = ['Personal leave', 'Medical leave', 'Training workshop', 'Family emergency'];
      return {
        id: tid,
        name: teacher?.full_name || 'Unknown',
        email: teacher?.email || '',
        reason: reasons[simpleHash(tid + today.toISOString().split('T')[0]) % reasons.length],
        affected_periods: affectedPeriods.map(p => ({
          period_number: p.period_number,
          subject: p.subject,
          class_level: p.class_level,
          section: p.section,
          course_id: p.course_id,
          lesson_title: p.lesson_title,
          lesson_objective: p.lesson_objective,
        })),
      };
    });

    // Generate substitute suggestions for each absent teacher
    for (const absent of absentTeachers) {
      const absentPeriodsSet = new Set(absent.affected_periods.map(p => p.period_number));

      // Find teachers who are free during these periods AND not absent
      const candidates: any[] = [];
      for (const [tid, teacher] of teacherMap) {
        if (absentTeacherIds.has(tid)) continue;
        const busyPeriods = new Set((teacherPeriods[tid] || []).filter(p => !absentPeriodsSet.has(p)));
        const freeDuringAbsent = [...absentPeriodsSet].filter(p => !(teacherPeriods[tid] || []).includes(p));
        if (freeDuringAbsent.length === 0) continue;

        // Score the candidate
        const teacherCourses = activeCourses.filter(c => c.teacher_id === tid);
        const sameSubject = teacherCourses.some(c =>
          absent.affected_periods.some(p => c.subject === p.subject)
        );
        const teacherProgress = (progress || []).filter(p =>
          teacherCourses.map(c => c.id).includes(p.course_id)
        );
        const avgMastery = teacherProgress.length > 0
          ? Math.round(teacherProgress.reduce((s, p) => s + (p.mastery_pct || 0), 0) / teacherProgress.length)
          : 50;

        let score = 0;
        const reasons: string[] = [];
        if (sameSubject) { score += 40; reasons.push('Same subject expertise'); }
        score += Math.round((avgMastery / 100) * 25);
        reasons.push(`${avgMastery}% student mastery`);
        if (freeDuringAbsent.length >= 2) { score += 10; reasons.push(`Free for ${freeDuringAbsent.length} periods`); }
        else reasons.push(`Free for period ${freeDuringAbsent[0]}`);

        candidates.push({
          teacher_id: tid,
          teacher_name: teacher.full_name,
          score,
          confidence: Math.min(score / 80, 1.0),
          reasons,
          free_periods: freeDuringAbsent,
          same_subject: sameSubject,
          avg_mastery: avgMastery,
        });
      }

      candidates.sort((a, b) => b.score - a.score);
      (absent as any).suggestions = candidates.slice(0, 3);
    }

    // Build period grid
    const periodGrid = PERIOD_TIMINGS.map(pt => ({
      ...pt,
      slots: schedule.filter(s => s.period_number === pt.period).map(s => ({
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        subject: s.subject,
        class_level: s.class_level,
        section: s.section,
        status: s.status,
        course_id: s.course_id,
        lesson_title: s.lesson_title,
      })),
    }));

    const totalPeriods = schedule.length;
    const uncovered = schedule.filter(s => s.status === 'absent').length;

    res.json({
      date: today.toISOString().split('T')[0],
      day_of_week: dayOfWeek,
      day_name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      period_timings: PERIOD_TIMINGS,
      periods: periodGrid,
      absent_teachers: absentTeachers,
      stats: {
        total_periods: totalPeriods,
        covered: totalPeriods - uncovered,
        uncovered,
        teachers_present: teacherList.length - absentTeacherIds.size,
        teachers_absent: absentTeacherIds.size,
        total_teachers: teacherList.length,
      },
    });
  } catch (err: any) {
    console.error('Timetable error:', err.message);
    res.status(500).json({ error: 'Failed to generate timetable' });
  }
});

export default router;
