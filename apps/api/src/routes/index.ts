import { Router } from 'express';
import authRoutes from './auth.routes.js';
import courseRoutes from './course.routes.js';
import kgRoutes from './kg.routes.js';
import lessonRoutes from './lesson.routes.js';
import questionRoutes from './question.routes.js';
import progressRoutes from './progress.routes.js';
import analyticsRoutes from './analytics.routes.js';
import suggestionRoutes from './suggestion.routes.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', authenticate, courseRoutes);
router.use('/courses/:courseId/kg', authenticate, kgRoutes);
router.use('/courses/:courseId/lessons', authenticate, lessonRoutes);
router.use('/courses/:courseId/questions', authenticate, questionRoutes);
router.use('/courses/:courseId/analytics', authenticate, analyticsRoutes);
router.use('/courses/:courseId/suggestions', authenticate, suggestionRoutes);
router.use('/students/:studentId/progress', authenticate, progressRoutes);

export default router;
