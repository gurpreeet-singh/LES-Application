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
import { authenticate } from '../middleware/auth.js';
import { llmLimit } from '../middleware/rate-limit.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', authenticate, adminRoutes);
router.use('/programs', authenticate, programRoutes);
router.use('/courses', authenticate, llmLimit, courseRoutes);
router.use('/courses/:courseId/kg', authenticate, kgRoutes);
router.use('/courses/:courseId/lessons', authenticate, lessonRoutes);
router.use('/courses/:courseId/questions', authenticate, llmLimit, questionRoutes);
router.use('/courses/:courseId/analytics', authenticate, analyticsRoutes);
router.use('/courses/:courseId/suggestions', authenticate, suggestionRoutes);
router.use('/courses/:courseId/students', authenticate, studentRoutes);
router.use('/students/:studentId/progress', authenticate, progressRoutes);
router.use('/courses/:courseId/lessons/:lessonId', authenticate, progressRoutes);
router.use('/courses/:courseId/lessons/:lessonId/media', authenticate, presentationRoutes);
router.use('/courses/:courseId/media', authenticate, presentationRoutes);

export default router;
