import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { buildQuizGenerationPrompt } from '@leap/shared';

export class QuizGenerationService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async generateQuizzesForCourse(courseId: string, onProgress?: (msg: string) => void): Promise<void> {
    // Get all lessons with their gate context
    const { data: lessons } = await this.db
      .from('lessons')
      .select('id, lesson_number, title, objective, key_idea, bloom_levels, gate_id')
      .eq('course_id', courseId)
      .order('lesson_number');

    if (!lessons || lessons.length === 0) return;

    // Get gates with sub-concepts
    const { data: gates } = await this.db
      .from('gates')
      .select('id, title, short_title, sub_concepts(title)')
      .eq('course_id', courseId);

    const gateMap = new Map((gates || []).map(g => [g.id, g]));

    // Process in batches of 3 lessons per LLM call (to stay within token limits)
    const batchSize = 3;
    for (let i = 0; i < lessons.length; i += batchSize) {
      const batch = lessons.slice(i, i + batchSize);
      onProgress?.(`Generating quizzes for lessons ${i + 1}-${Math.min(i + batchSize, lessons.length)}...`);

      const lessonData = batch.map(l => {
        const gate = gateMap.get(l.gate_id);
        return {
          lesson_number: l.lesson_number,
          title: l.title,
          objective: l.objective,
          key_idea: l.key_idea || '',
          bloom_levels: l.bloom_levels || ['remember', 'understand'],
          gate_title: gate?.title || gate?.short_title || '',
          sub_concepts: (gate?.sub_concepts || []).map((sc: any) => sc.title || sc),
        };
      });

      const { system, user } = buildQuizGenerationPrompt(lessonData);

      try {
        const rawResponse = await this.llm.complete({
          systemPrompt: system,
          userMessage: user,
          maxTokens: 8000,
          temperature: 0.3,
        });

        // Parse response
        const jsonStr = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        const lessonsQuiz = parsed.lessons || [parsed]; // Handle both array and single object

        // Insert questions for each lesson
        for (const lq of lessonsQuiz) {
          const lesson = batch.find(l => l.lesson_number === lq.lesson_number) || batch[0];
          const questions = lq.questions || [];

          const questionInserts = questions.map((q: any) => ({
            gate_id: lesson.gate_id,
            course_id: courseId,
            question_text: q.question_text,
            question_type: q.question_type,
            bloom_level: q.bloom_level,
            difficulty: q.difficulty || 3,
            options: q.options || null,
            correct_answer: q.correct_answer || '',
            rubric: q.rubric || '',
            distractors: q.distractors || [],
            is_diagnostic: q.bloom_level === 'analyze' || q.bloom_level === 'evaluate',
            status: 'draft',
          }));

          if (questionInserts.length > 0) {
            await this.db.from('questions').insert(questionInserts);
          }
        }
      } catch (err) {
        console.error(`Quiz generation failed for batch ${i}:`, err);
        // Continue with next batch
      }
    }

    onProgress?.('Quiz generation complete');
  }
}
