import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';
import { SlideGenerationService } from '../services/slide-generation.service.js';
import { NarrationGenerationService } from '../services/narration-generation.service.js';
import archiver from 'archiver';

const router = Router({ mergeParams: true });
const slideService = new SlideGenerationService(supabaseAdmin);
const narrationService = new NarrationGenerationService(supabaseAdmin);

// GET /courses/:courseId/lessons/:lessonId/media/slides — Download .pptx
router.get('/slides', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const { buffer, filename } = await slideService.generateSlides(req.params.lessonId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Slide generation error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate slides' });
  }
});

// GET /courses/:courseId/lessons/:lessonId/media/slides/preview — Slide data as JSON for preview
router.get('/slides/preview', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const { slideData, filename } = await slideService.generateSlides(req.params.lessonId);
    res.json({ slides: slideData, filename });
  } catch (err: any) {
    console.error('Slide preview error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate slide preview' });
  }
});

// GET /courses/:courseId/lessons/:lessonId/media/narration/script — Get narration script text
router.get('/narration/script', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const { script } = await narrationService.buildNarrationScript(req.params.lessonId);
    res.json({ script });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to build narration script' });
  }
});

// POST /courses/:courseId/lessons/:lessonId/media/narration — Generate TTS audio
router.post('/narration', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const voice = req.body.voice || 'nova';
    const { audioBuffer, script, filename } = await narrationService.generateAudio(req.params.lessonId, voice);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(audioBuffer);
  } catch (err: any) {
    console.error('Narration generation error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate narration' });
  }
});

// POST /courses/:courseId/media/slides/bulk — Download all lesson slides as zip
router.post('/bulk-slides', requireRole('teacher'), async (req: Request, res: Response) => {
  try {
    const courseId = req.params.courseId;
    const { data: lessons } = await supabaseAdmin
      .from('lessons')
      .select('id, lesson_number, title')
      .eq('course_id', courseId)
      .eq('status', 'accepted')
      .order('lesson_number');

    if (!lessons || lessons.length === 0) {
      res.status(404).json({ error: 'No accepted lessons found for this course' });
      return;
    }

    const { data: course } = await supabaseAdmin.from('courses').select('title').eq('id', courseId).single();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${(course?.title || 'Course').replace(/[^a-zA-Z0-9]/g, '_')}_Slides.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const lesson of lessons) {
      try {
        const { buffer, filename } = await slideService.generateSlides(lesson.id);
        archive.append(buffer, { name: filename });
      } catch (err) {
        console.error(`Slide generation failed for lesson ${lesson.id}:`, (err as Error).message);
      }
    }

    await archive.finalize();
  } catch (err: any) {
    console.error('Bulk slide generation error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate bulk slides' });
    }
  }
});

export default router;
