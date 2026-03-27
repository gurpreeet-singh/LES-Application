import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { LLM_TIERS } from './llm/provider.js';
import { buildGradingPrompt } from '@leap/shared';

interface StudentAnswer {
  question_id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  correct_answer: string;
  rubric: string;
  max_score: number;
  student_answer: string;
  options?: { text: string; is_correct: boolean }[];
}

interface GradeResult {
  question_id: string;
  question_number: number;
  score: number;
  max_score: number;
  feedback: string;
  misconception: string | null;
  bloom_level_demonstrated: string;
}

export class GradingService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async gradeStudentAnswers(
    studentId: string,
    courseId: string,
    gateId: string,
    answers: StudentAnswer[],
  ): Promise<GradeResult[]> {
    const results: GradeResult[] = [];

    // Auto-grade MCQ and True/False
    const objectiveAnswers = answers.filter(a => a.question_type === 'mcq' || a.question_type === 'true_false');
    for (const a of objectiveAnswers) {
      let isCorrect = false;
      if (a.options && a.options.length > 0) {
        const correctOption = a.options.find(o => o.is_correct);
        isCorrect = correctOption ? a.student_answer.toLowerCase().trim() === correctOption.text.toLowerCase().trim() : false;
      } else {
        isCorrect = a.student_answer.toLowerCase().trim() === (a.correct_answer || '').toLowerCase().trim();
      }

      results.push({
        question_id: a.question_id,
        question_number: a.question_number,
        score: isCorrect ? a.max_score : 0,
        max_score: a.max_score,
        feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${a.correct_answer}`,
        misconception: null,
        bloom_level_demonstrated: isCorrect ? 'remember' : 'remember',
      });
    }

    // AI-grade subjective questions (Short Answer + Open-Ended)
    const subjectiveAnswers = answers.filter(a => a.question_type === 'short_answer' || a.question_type === 'open_ended');

    if (subjectiveAnswers.length > 0) {
      try {
        const { system, user } = buildGradingPrompt(
          subjectiveAnswers.map(a => ({
            number: a.question_number,
            question_text: a.question_text,
            question_type: a.question_type,
            correct_answer: a.correct_answer,
            rubric: a.rubric,
            max_score: a.max_score,
            student_answer: a.student_answer,
          }))
        );

        const rawResponse = await this.llm.complete({
          systemPrompt: system,
          userMessage: user,
          maxTokens: 4000,
          temperature: 0.2,
          model: LLM_TIERS.FAST, // Tier 2: Grading is structured evaluation — Haiku sufficient
        });

        const jsonStr = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        const aiResults = parsed.results || [];

        for (const aiResult of aiResults) {
          const answer = subjectiveAnswers.find(a => a.question_number === aiResult.question_number);
          if (answer) {
            results.push({
              question_id: answer.question_id,
              question_number: aiResult.question_number,
              score: Math.min(aiResult.score, answer.max_score),
              max_score: answer.max_score,
              feedback: aiResult.feedback || '',
              misconception: aiResult.misconception || null,
              bloom_level_demonstrated: aiResult.bloom_level_demonstrated || 'remember',
            });
          }
        }
      } catch (err) {
        console.error('AI grading failed, using fallback:', err);
        // Fallback: give 50% marks for subjective answers
        for (const a of subjectiveAnswers) {
          results.push({
            question_id: a.question_id,
            question_number: a.question_number,
            score: Math.round(a.max_score * 0.5),
            max_score: a.max_score,
            feedback: 'AI grading unavailable. Please review and adjust score manually.',
            misconception: null,
            bloom_level_demonstrated: 'understand',
          });
        }
      }
    }

    // Sort by question number
    results.sort((a, b) => a.question_number - b.question_number);

    // Save to question_attempts
    for (const r of results) {
      await this.db.from('question_attempts').insert({
        student_id: studentId,
        question_id: r.question_id,
        gate_id: gateId,
        answer_text: answers.find(a => a.question_id === r.question_id)?.student_answer || '',
        is_correct: r.score === r.max_score,
        score: Math.round((r.score / r.max_score) * 100),
        bloom_level_demonstrated: r.bloom_level_demonstrated,
        ai_feedback: r.feedback,
        misconceptions: r.misconception ? [{ misconception: r.misconception }] : null,
      });
    }

    // Update student_gate_progress
    const totalScore = results.reduce((a, r) => a + r.score, 0);
    const totalMax = results.reduce((a, r) => a + r.max_score, 0);
    const masteryPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    await this.db.from('student_gate_progress').upsert({
      student_id: studentId,
      gate_id: gateId,
      course_id: courseId,
      mastery_pct: masteryPct,
      last_attempt_at: new Date().toISOString(),
      is_unlocked: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,gate_id' });

    return results;
  }
}
