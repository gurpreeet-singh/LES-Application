import { Router } from 'express';
import authRoutes from './auth.routes.js';
import courseRoutes from './course.routes.js';
import kgRoutes from './kg.routes.js';
import lessonRoutes from './lesson.routes.js';
import questionRoutes from './question.routes.js';
import progressRoutes from './progress.routes.js';
import analyticsRoutes from './analytics.routes.js';
import suggestionRoutes from './suggestion.routes.js';
import studentRoutes from './student.routes.js';
import adminRoutes from './admin.routes.js';
import programRoutes from './program.routes.js';
import presentationRoutes from './presentation.routes.js';
import chatRoutes from './chat.routes.js';
import teacherScheduleRoutes from './teacher-schedule.routes.js';
import { authenticate } from '../middleware/auth.js';
import { llmLimit } from '../middleware/rate-limit.js';
import { seedStudentsForCourses } from '../services/multi-course-seeder.service.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

// Temporary seed endpoint — POST /seed-demo with { courseIds: string[], clean: true }
router.post('/seed-demo', authenticate, async (req, res) => {
  const { courseIds, clean } = req.body;
  if (!courseIds || !Array.isArray(courseIds)) {
    res.status(400).json({ error: 'courseIds array required' });
    return;
  }
  res.json({ message: 'Seeding started — check Railway logs for progress', courseIds, clean: !!clean });

  // Run in background
  (async () => {
    try {
      if (clean) {
        console.log('Cleaning up old demo data...');
        // Delete old demo students' data for these courses
        for (const cid of courseIds) {
          // Get demo enrollments (demo students have @lmgc.demo emails)
          const { data: enrollments } = await supabaseAdmin
            .from('enrollments')
            .select('student_id, profiles:student_id(email)')
            .eq('course_id', cid);

          const demoStudentIds = (enrollments || [])
            .filter((e: any) => e.profiles?.email?.includes('@lmgc.demo'))
            .map((e: any) => e.student_id);

          if (demoStudentIds.length > 0) {
            console.log(`  Cleaning ${demoStudentIds.length} demo students from course ${cid.slice(0,8)}...`);
            // Delete in order: attempts → progress → learning_profiles → enrollments
            await supabaseAdmin.from('question_attempts').delete().in('student_id', demoStudentIds).in('gate_id',
              ((await supabaseAdmin.from('gates').select('id').eq('course_id', cid)).data || []).map((g: any) => g.id));
            await supabaseAdmin.from('student_gate_progress').delete().eq('course_id', cid).in('student_id', demoStudentIds);
            await supabaseAdmin.from('learning_profiles').delete().eq('course_id', cid).in('student_id', demoStudentIds);
            await supabaseAdmin.from('enrollments').delete().eq('course_id', cid).in('student_id', demoStudentIds);
          }

          // Delete seeder-generated questions (keep AI-generated ones)
          await supabaseAdmin.from('questions').delete().eq('course_id', cid).like('correct_answer', 'Model answer%');

          // Delete old suggestions
          await supabaseAdmin.from('ai_suggestions').delete().eq('course_id', cid);
        }
        console.log('Cleanup complete');
      }

      const result = await seedStudentsForCourses(supabaseAdmin, courseIds);
      console.log('Seeding complete:', result);
    } catch (e: any) {
      console.error('Seeding failed:', e.message);
    }
  })();
});

// Temporary: bulk update question text by ID
router.post('/update-questions', authenticate, async (req, res) => {
  const { updates } = req.body; // [{id, question_text, options, correct_answer, rubric, distractors, bloom_level, question_type, difficulty}]
  if (!updates || !Array.isArray(updates)) { res.status(400).json({ error: 'updates array required' }); return; }
  let updated = 0;
  for (const u of updates) {
    const fields: any = {};
    if (u.question_text) fields.question_text = u.question_text;
    if (u.options) fields.options = u.options;
    if (u.correct_answer) fields.correct_answer = u.correct_answer;
    if (u.rubric) fields.rubric = u.rubric;
    if (u.distractors) fields.distractors = u.distractors;
    if (u.bloom_level) fields.bloom_level = u.bloom_level;
    if (u.question_type) fields.question_type = u.question_type;
    if (u.difficulty) fields.difficulty = u.difficulty;
    const { error } = await supabaseAdmin.from('questions').update(fields).eq('id', u.id);
    if (!error) updated++;
  }
  res.json({ updated, total: updates.length });
});

router.use('/auth', authRoutes);
router.use('/admin', authenticate, adminRoutes);
router.use('/programs', authenticate, programRoutes);
router.use('/teacher', authenticate, teacherScheduleRoutes);
router.use('/courses', authenticate, courseRoutes);
router.use('/courses/:courseId/kg', authenticate, kgRoutes);
router.use('/courses/:courseId/lessons', authenticate, lessonRoutes);
router.use('/courses/:courseId/questions', authenticate, questionRoutes);
router.use('/courses/:courseId/analytics', authenticate, analyticsRoutes);
router.use('/courses/:courseId/suggestions', authenticate, suggestionRoutes);
router.use('/courses/:courseId/students', authenticate, studentRoutes);
router.use('/students/:studentId/progress', authenticate, progressRoutes);
router.use('/courses/:courseId/lessons/:lessonId', authenticate, progressRoutes);
router.use('/courses/:courseId/lessons/:lessonId/chat', authenticate, chatRoutes);
router.use('/courses/:courseId/lessons/:lessonId/media', authenticate, presentationRoutes);
router.use('/courses/:courseId/media', authenticate, presentationRoutes);

export default router;
