import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { buildSuggestionPrompt } from '@leap/shared';
import { AT_RISK_THRESHOLD, BLOOM_REACH_THRESHOLD } from '@leap/shared';

export class AdaptiveSuggestionService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async generateSuggestions(courseId: string): Promise<any[]> {
    // Gather all the data the AI needs
    const { data: course } = await this.db.from('courses').select('title, total_sessions').eq('id', courseId).single();
    const { data: gates } = await this.db.from('gates').select('id, gate_number, title, short_title').eq('course_id', courseId).eq('status', 'accepted').order('sort_order');
    const { data: lessons } = await this.db.from('lessons').select('id, lesson_number, title, gate_id, bloom_levels').eq('course_id', courseId).order('lesson_number');
    const { data: prereqs } = await this.db.from('gate_prerequisites').select('gate_id, prerequisite_gate_id').in('gate_id', (gates || []).map(g => g.id));
    const { data: progress } = await this.db.from('student_gate_progress').select('student_id, gate_id, mastery_pct, bloom_scores').eq('course_id', courseId);
    const { data: enrollments } = await this.db.from('enrollments').select('student_id, profiles:student_id(full_name)').eq('course_id', courseId);
    const { data: attempts } = await this.db.from('question_attempts').select('student_id, question_id, is_correct, score, ai_feedback, misconceptions, questions:question_id(question_text, gate_id)').eq('gate_id', (gates || [])[0]?.id || ''); // Sample from first gate

    if (!course || !gates || gates.length === 0 || !lessons || lessons.length === 0) {
      return [];
    }

    const nameMap = new Map((enrollments || []).map((e: any) => [e.student_id, e.profiles?.full_name || 'Unknown']));

    // Build gate structure
    const gateStructure = gates.map(g => ({
      gate_number: g.gate_number,
      title: g.title,
      sessions: (lessons || []).filter((l: any) => l.gate_id === g.id).map((l: any) => l.lesson_number),
    }));

    // Dependencies
    const dependencies = (prereqs || []).map((p: any) => {
      const from = gates.find(g => g.id === p.prerequisite_gate_id);
      const to = gates.find(g => g.id === p.gate_id);
      return { from: from?.title || '', to: to?.title || '' };
    });

    // Determine current session (first session without full completion)
    const completedCount = Math.min(Math.floor((lessons?.length || 0) * 0.6), lessons?.length || 0);
    const currentSession = completedCount + 1;

    // Session scores from attempts
    const completedSessionScores: any[] = [];
    for (let i = 0; i < Math.min(completedCount, 5); i++) {
      const lesson = lessons[completedCount - 1 - i];
      if (!lesson) continue;
      const gate = gates.find(g => g.id === lesson.gate_id);
      const studentScores = (enrollments || []).map((e: any) => {
        const p = (progress || []).find((pr: any) => pr.student_id === e.student_id && pr.gate_id === lesson.gate_id);
        return { name: nameMap.get(e.student_id) || 'Unknown', score: p?.mastery_pct || 0, total: 100 };
      });
      completedSessionScores.push({
        session: lesson.lesson_number,
        lesson_title: lesson.title,
        gate_number: gate?.gate_number || 0,
        avg_score: studentScores.length > 0 ? Math.round(studentScores.reduce((a: number, s: any) => a + s.score, 0) / studentScores.length) : 0,
        student_scores: studentScores,
      });
    }

    // Bloom distribution per gate
    const bloomDistribution = gates.map(g => {
      const gateProgress = (progress || []).filter((p: any) => p.gate_id === g.id);
      const levels = ['remember', 'understand', 'apply', 'analyze'];
      const dist: any = { gate: g.title };
      levels.forEach(level => {
        const count = gateProgress.filter((p: any) => p.bloom_scores && (p.bloom_scores as any)[level] >= BLOOM_REACH_THRESHOLD).length;
        dist[`${level}_pct`] = gateProgress.length > 0 ? Math.round((count / gateProgress.length) * 100) : 0;
      });
      return dist;
    });

    // At-risk students
    const atRiskStudents: any[] = [];
    (enrollments || []).forEach((e: any) => {
      const weakGates = gates.map(g => {
        const p = (progress || []).find((pr: any) => pr.student_id === e.student_id && pr.gate_id === g.id);
        return { gate: g.title, mastery: p?.mastery_pct || 0 };
      }).filter(g => g.mastery > 0 && g.mastery < AT_RISK_THRESHOLD);
      if (weakGates.length > 0) {
        atRiskStudents.push({ name: nameMap.get(e.student_id) || 'Unknown', weak_gates: weakGates });
      }
    });

    // Common misconceptions from attempts
    const commonMisconceptions = (attempts || []).filter((a: any) => !a.is_correct && a.misconceptions).map((a: any) => ({
      question: (a.questions as any)?.question_text || '',
      wrong_answer: a.answer_text || '',
      misconception: Array.isArray(a.misconceptions) ? a.misconceptions[0]?.misconception || '' : '',
      frequency: 1,
    })).slice(0, 10);

    // Upcoming sessions
    const upcomingSessions = lessons.slice(currentSession - 1, currentSession + 4).map((l: any) => ({
      session: l.lesson_number,
      lesson_title: l.title,
      gate_number: gates.find(g => g.id === l.gate_id)?.gate_number || 0,
      bloom_levels: l.bloom_levels || ['remember'],
    }));

    // If no student data yet, return placeholder
    if (!progress || progress.length === 0) {
      return [{
        type: 'lesson_refine',
        priority: 'medium',
        affects_sessions: [],
        title: 'AI suggestions will appear after student assessments are graded',
        reason: 'The AI needs real student performance data to generate meaningful suggestions. Grade at least one session\'s quiz to get started.',
        affected_students: [],
        proposed_changes: ['Complete and grade Session 1 quiz', 'Upload student scores via CSV or manual entry'],
        expected_outcome: 'After grading, AI will analyze scores and generate specific, data-driven suggestions',
      }];
    }

    // Make the LLM call
    try {
      const { system, user } = buildSuggestionPrompt({
        courseName: course.title,
        currentSession,
        totalSessions: course.total_sessions || lessons.length,
        gateStructure,
        dependencies,
        completedSessionScores,
        bloomDistribution,
        atRiskStudents,
        commonMisconceptions,
        upcomingSessions,
      });

      const rawResponse = await this.llm.complete({
        systemPrompt: system,
        userMessage: user,
        maxTokens: 4000,
        temperature: 0.4,
      });

      const jsonStr = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      const suggestions = parsed.suggestions || [];

      // Store in database
      for (const s of suggestions) {
        await this.db.from('ai_suggestions').insert({
          course_id: courseId,
          type: s.type === 'topic_shift' ? 'lesson_refine' : s.type === 'bloom_focus' ? 'lesson_refine' : s.type === 'quiz_adjust' ? 'lesson_refine' : s.type === 'add_remediation' ? 'remediation' : s.type === 'pace_change' ? 'pace_change' : s.type === 'peer_teaching' ? 'peer_teaching' : 'lesson_refine',
          title: s.title,
          description: s.reason,
          rationale: s.expected_outcome,
          tag: s.affects_sessions?.join(',') || '',
          status: 'pending',
        });
      }

      return suggestions;
    } catch (err) {
      console.error('Adaptive suggestion generation failed:', err);
      return [{
        type: 'lesson_refine',
        priority: 'low',
        title: 'AI suggestion generation encountered an error',
        reason: `Error: ${err instanceof Error ? err.message : 'Unknown'}. Please try again later.`,
        affected_students: [],
        proposed_changes: [],
        expected_outcome: '',
      }];
    }
  }
}
