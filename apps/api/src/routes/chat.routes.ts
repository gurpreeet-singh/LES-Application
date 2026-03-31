import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { createLLMProvider, LLM_TIERS } from '../services/llm/provider.js';

const router = Router({ mergeParams: true });

// POST /courses/:courseId/lessons/:lessonId/chat
router.post('/', async (req: Request, res: Response) => {
  const { courseId, lessonId } = req.params;
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    // Load lesson with socratic scripts
    const { data: lesson, error: lessonErr } = await supabaseAdmin
      .from('lessons')
      .select('*, socratic_scripts(*)')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .single();

    if (lessonErr || !lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    // Load gate context
    const { data: gate } = await supabaseAdmin
      .from('gates')
      .select('*, sub_concepts:sub_concepts(title)')
      .eq('id', lesson.gate_id)
      .single();

    // Build grounded system prompt
    const scripts = (lesson.socratic_scripts || [])
      .sort((a: any, b: any) => a.stage_number - b.stage_number)
      .map((s: any) => `Stage ${s.stage_number} - ${s.stage_title}: ${s.teacher_prompt}`)
      .join('\n');

    const examples = (lesson.examples || []).map((ex: any, i: number) => `${i + 1}. ${ex.text || ex}`).join('\n');
    const exercises = (lesson.exercises || []).map((ex: any, i: number) => `${i + 1}. ${ex.text || ex}`).join('\n');
    const subConcepts = (gate?.sub_concepts || []).map((sc: any) => sc.title).join(', ');

    const systemPrompt = `You are a helpful, friendly teaching assistant for the LEAP education platform. Answer questions based ONLY on the lesson content provided below. Be concise and clear. If a question is outside the scope of this lesson, politely say so and redirect to what you can help with.

LESSON: ${lesson.title} (Session ${lesson.lesson_number})
LEARNING OBJECTIVE: ${lesson.objective || 'Not specified'}
KEY IDEA: ${lesson.key_idea || 'Not specified'}
CONCEPTUAL BREAKTHROUGH: ${lesson.conceptual_breakthrough || 'Not specified'}
BLOOM LEVELS: ${(lesson.bloom_levels || []).join(', ')}
DURATION: ${lesson.duration_minutes} minutes

EXAMPLES:
${examples || 'None provided'}

EXERCISES:
${exercises || 'None provided'}

TEACHING SCRIPT:
${scripts || 'None provided'}

UNIT/GATE: ${gate?.title || 'Unknown'} (${gate?.period || ''})
SUB-CONCEPTS: ${subConcepts || 'None'}

Keep responses concise (2-4 paragraphs max). Use simple language appropriate for students. If asked to explain something, use examples from the lesson content above.`;

    // Build conversation with history
    const conversationHistory = (history || [])
      .slice(-8) // Keep last 8 messages for context
      .map((h: any) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.content}`)
      .join('\n\n');

    const userMessage = conversationHistory
      ? `Previous conversation:\n${conversationHistory}\n\nStudent's new question: ${message}`
      : message;

    // Call LLM (FAST tier = Haiku, cheap and fast for chat)
    const llm = createLLMProvider();
    const response = await llm.complete({
      systemPrompt,
      userMessage,
      temperature: 0.4,
      maxTokens: 1000,
      model: LLM_TIERS.FAST,
    });

    res.json({ response });
  } catch (err: any) {
    console.error('Chat error:', err.message || err);
    res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
});

export default router;
