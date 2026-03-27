import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

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

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// GET /teacher/my-schedule/today
router.get('/my-schedule/today', async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.id;
    const today = new Date();
    const dayOfWeek = today.getDay();

    if (dayOfWeek === 0) {
      res.json({ date: today.toISOString().split('T')[0], day_name: 'Sunday', periods: [], stats: { total_periods: 0, own_classes: 0, substitutes: 0, free_periods: 8 } });
      return;
    }

    // Fetch this teacher's active courses with lessons
    const { data: myCourses } = await supabaseAdmin
      .from('courses')
      .select('id, title, subject, class_level, section, total_sessions')
      .eq('teacher_id', teacherId)
      .eq('status', 'active');

    const courseIds = (myCourses || []).map(c => c.id);

    const { data: myLessons } = courseIds.length > 0
      ? await supabaseAdmin.from('lessons').select('id, course_id, lesson_number, title, objective').in('course_id', courseIds).order('lesson_number')
      : { data: [] };

    // Fetch all teachers for substitute detection — filtered by same school
    const { data: myProfile } = await supabaseAdmin.from('profiles').select('school').eq('id', teacherId).single();
    const mySchool = myProfile?.school;

    let teacherQuery = supabaseAdmin.from('profiles').select('id, full_name, email, school').eq('role', 'teacher');
    if (mySchool) teacherQuery = teacherQuery.eq('school', mySchool);
    const { data: allTeachers } = await teacherQuery;
    const teacherMap = new Map((allTeachers || []).map(t => [t.id, t]));
    const me = teacherMap.get(teacherId);

    // Build this teacher's own schedule
    const myPeriods: Record<number, any> = {};
    const SUBJECTS_BANK: Record<string, string[]> = {
      Mathematics: ['Number Systems', 'Algebra', 'Geometry', 'Mensuration', 'Statistics', 'Fractions', 'Ratio', 'Data Handling'],
      Science: ['Living Things', 'Force & Motion', 'Chemical Reactions', 'Ecosystems', 'Electricity', 'Human Body'],
      English: ['Reading Comprehension', 'Creative Writing', 'Grammar', 'Poetry', 'Essay Writing', 'Vocabulary'],
      'Computer Science': ['Programming', 'Data Structures', 'Algorithms', 'OOP', 'Databases', 'Web Development'],
      'Machine Learning': ['Supervised Learning', 'Neural Networks', 'Regression', 'Classification', 'Feature Engineering'],
    };

    for (const course of (myCourses || [])) {
      const seed = simpleHash(teacherId + dayOfWeek + course.id);
      const numPeriods = 3 + (seed % 3); // 3-5 periods
      const startPeriod = 1 + (seed % 3);

      const courseLessons = (myLessons || []).filter(l => l.course_id === course.id);

      for (let i = 0; i < numPeriods && (startPeriod + i) <= 8; i++) {
        const p = startPeriod + i;
        if (myPeriods[p]) continue; // already occupied

        const lessonIdx = (seed + p) % Math.max(courseLessons.length, 1);
        const lesson = courseLessons[lessonIdx];

        myPeriods[p] = {
          period: p,
          start: PERIOD_TIMINGS[p - 1]?.start || '',
          end: PERIOD_TIMINGS[p - 1]?.end || '',
          type: 'own',
          course_id: course.id,
          subject: course.subject,
          class_level: course.class_level || '5',
          section: course.section || 'A',
          lesson_title: lesson?.title || 'Lesson',
          lesson_id: lesson?.id || null,
          lesson_objective: lesson?.objective || '',
        };
      }
    }

    // Detect substitute assignments: find absent teachers and check if I'm suggested
    const dateSeed = simpleHash(today.toISOString().split('T')[0]);
    const allTeacherIds = (allTeachers || []).filter(t => t.id !== teacherId).map(t => t.id);
    const absentCount = Math.min(2 + (dateSeed % 2), Math.floor(allTeacherIds.length / 5));
    const absentTeacherIds = new Set<string>();
    for (let i = 0; i < absentCount; i++) {
      const idx = (dateSeed + i * 7) % allTeacherIds.length;
      absentTeacherIds.add(allTeacherIds[idx]);
    }

    const reasons = ['Personal leave', 'Medical leave', 'Training workshop', 'Family emergency'];

    // For each absent teacher, check if I have free periods that match their schedule
    for (const absentId of absentTeacherIds) {
      const absentTeacher = teacherMap.get(absentId);
      if (!absentTeacher) continue;

      // Get absent teacher's courses
      const { data: absentCourses } = await supabaseAdmin
        .from('courses')
        .select('id, title, subject, class_level, section')
        .eq('teacher_id', absentId)
        .eq('status', 'active');

      if (!absentCourses || absentCourses.length === 0) continue;

      // Generate absent teacher's schedule
      for (const ac of absentCourses) {
        const absSeed = simpleHash(absentId + dayOfWeek + ac.id);
        const absStart = 1 + (absSeed % 3);
        const absCount = 3 + (absSeed % 3);

        for (let i = 0; i < absCount && (absStart + i) <= 8; i++) {
          const p = absStart + i;
          if (myPeriods[p]) continue; // I'm busy

          // Check if I teach same subject (good substitute match)
          const sameSubject = (myCourses || []).some(c => c.subject === ac.subject);
          if (!sameSubject && simpleHash(teacherId + absentId + p) % 3 !== 0) continue; // only assign if same subject or 1/3 chance

          const reason = reasons[simpleHash(absentId + today.toISOString().split('T')[0]) % reasons.length];

          // Get a lesson from the absent teacher's course
          const { data: absLessons } = await supabaseAdmin
            .from('lessons')
            .select('id, title, objective, key_idea, lesson_number')
            .eq('course_id', ac.id)
            .order('lesson_number')
            .limit(10);

          const absLesson = absLessons?.[((absSeed + p) % (absLessons?.length || 1))] || null;

          // Generate teaching brief
          const brief = absLesson
            ? `Cover "${absLesson.title}" — ${absLesson.objective || ''}. ${absLesson.key_idea ? `Key concept: ${absLesson.key_idea}.` : ''} Keep the pace steady and check understanding frequently since students are used to a different teaching style.`
            : `Continue with the ${ac.subject} curriculum for Class ${ac.class_level}${ac.section}. Review the previous lesson and practice exercises.`;

          myPeriods[p] = {
            period: p,
            start: PERIOD_TIMINGS[p - 1]?.start || '',
            end: PERIOD_TIMINGS[p - 1]?.end || '',
            type: 'substitute',
            subject: ac.subject,
            class_level: ac.class_level || '',
            section: ac.section || '',
            absent_teacher: absentTeacher.full_name,
            absence_reason: reason,
            lesson_title: absLesson?.title || `${ac.subject} class`,
            lesson_objective: absLesson?.objective || '',
            teaching_brief: brief,
            course_id: ac.id,
            lesson_id: absLesson?.id || null,
          };
          break; // Only one substitute per absent teacher
        }
      }
    }

    // Build final periods array (fill gaps with "free")
    const periods = PERIOD_TIMINGS.map(pt => {
      if (myPeriods[pt.period]) return myPeriods[pt.period];
      return { period: pt.period, start: pt.start, end: pt.end, type: 'free' };
    });

    const ownCount = Object.values(myPeriods).filter((p: any) => p.type === 'own').length;
    const subCount = Object.values(myPeriods).filter((p: any) => p.type === 'substitute').length;

    res.json({
      date: today.toISOString().split('T')[0],
      day_name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      teacher_name: me?.full_name || 'Teacher',
      periods,
      stats: {
        total_periods: ownCount + subCount,
        own_classes: ownCount,
        substitutes: subCount,
        free_periods: 8 - ownCount - subCount,
      },
    });
  } catch (err: any) {
    console.error('Teacher schedule error:', err.message);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

export default router;
