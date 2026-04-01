import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { LLM_TIERS } from './llm/provider.js';
import { buildProgressiveSessionPrompt, getDIKWLevelByPosition } from '@leap/shared';
import type { ProgressiveSessionParams } from '@leap/shared';

// Distribute total sessions across gates proportionally by sub_concept count
function distributeLessonsAcrossGates(gates: { number: number; sub_concepts: string[] }[], totalSessions: number): Map<number, number> {
  const totalSubConcepts = gates.reduce((sum, g) => sum + g.sub_concepts.length, 0);
  const distribution = new Map<number, number>();
  let remaining = totalSessions;

  const rawShares = gates.map(g => ({
    number: g.number,
    share: totalSubConcepts > 0 ? (g.sub_concepts.length / totalSubConcepts) * totalSessions : totalSessions / gates.length,
  }));

  // Floor allocation (minimum 1 per gate)
  for (const g of rawShares) {
    const lessons = Math.max(1, Math.floor(g.share));
    distribution.set(g.number, lessons);
    remaining -= lessons;
  }

  // Distribute remainder by fractional parts
  const fractionals = rawShares
    .map(g => ({ number: g.number, frac: g.share - Math.floor(g.share) }))
    .sort((a, b) => b.frac - a.frac);
  for (const g of fractionals) {
    if (remaining <= 0) break;
    distribution.set(g.number, distribution.get(g.number)! + 1);
    remaining--;
  }

  return distribution;
}

export class ProgressiveGenerationService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async generateNextSession(courseId: string, teacherFeedback?: string): Promise<any> {
    // 1. Get course info
    const { data: course } = await this.db.from('courses')
      .select('title, total_sessions, session_duration_minutes, class_level, current_session_number, generation_mode')
      .eq('id', courseId).single();

    if (!course) throw new Error('Course not found');

    // For batch courses, use existing lesson count as current position
    const { count: existingLessonCount } = await this.db.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', courseId);
    const currentSession = course.generation_mode === 'progressive'
      ? (course.current_session_number || 0)
      : (existingLessonCount || 0);
    const nextLessonNumber = currentSession + 1;
    if (nextLessonNumber > (course.total_sessions || 30)) throw new Error('All sessions have been generated');

    // 2. Get gate structure
    const { data: gates } = await this.db.from('gates')
      .select('id, gate_number, title, short_title, color, light_color, sort_order')
      .eq('course_id', courseId).eq('status', 'accepted').order('sort_order');
    if (!gates || gates.length === 0) throw new Error('No gates found — run structure generation first');

    // Get sub-concepts per gate
    const gateSubConcepts = new Map<string, string[]>();
    for (const g of gates) {
      const { data: subs } = await this.db.from('sub_concepts').select('title').eq('gate_id', g.id);
      gateSubConcepts.set(g.id, (subs || []).map(s => s.title));
    }

    // 3. Determine which gate this lesson belongs to
    const lessonDist = distributeLessonsAcrossGates(
      gates.map(g => ({ number: g.gate_number, sub_concepts: gateSubConcepts.get(g.id) || [] })),
      course.total_sessions || 30
    );

    let targetGate = gates[0];
    let lessonsBeforeThisGate = 0;
    for (const g of gates) {
      const lessonsInGate = lessonDist.get(g.gate_number) || 1;
      if (nextLessonNumber <= lessonsBeforeThisGate + lessonsInGate) {
        targetGate = g;
        break;
      }
      lessonsBeforeThisGate += lessonsInGate;
    }

    const lessonsInTargetGate = lessonDist.get(targetGate.gate_number) || 1;
    const lessonIndexInGate = nextLessonNumber - lessonsBeforeThisGate;
    const lessonsRemainingInGate = lessonsInTargetGate - lessonIndexInGate;

    // 4. Get previous session data
    const { data: existingLessons } = await this.db.from('lessons')
      .select('id, lesson_number, title, objective, key_idea, bloom_levels, gate_id')
      .eq('course_id', courseId).order('lesson_number', { ascending: false }).limit(1);

    const prevLesson = existingLessons?.[0];
    let previousSession: ProgressiveSessionParams['previousSession'] = undefined;
    let previousPerformance: ProgressiveSessionParams['previousPerformance'] = undefined;

    if (prevLesson) {
      previousSession = {
        title: prevLesson.title,
        objective: prevLesson.objective,
        keyIdea: prevLesson.key_idea || '',
        bloomLevels: prevLesson.bloom_levels || [],
      };

      // Get previous session's question attempts
      const { data: prevQuestions } = await this.db.from('questions')
        .select('id, bloom_level').eq('course_id', courseId)
        .eq('gate_id', prevLesson.gate_id).limit(5000);

      if (prevQuestions && prevQuestions.length > 0) {
        const qIds = prevQuestions.map(q => q.id);
        // Fetch attempts in batches to avoid row limit
        let allAttempts: any[] = [];
        for (let i = 0; i < qIds.length; i += 100) {
          const batch = qIds.slice(i, i + 100);
          const { data: attempts } = await this.db.from('question_attempts')
            .select('student_id, score, is_correct, bloom_level_demonstrated, misconceptions')
            .in('question_id', batch).limit(5000);
          if (attempts) allAttempts.push(...attempts);
        }

        if (allAttempts.length > 0) {
          // Class average
          const classAverage = Math.round(allAttempts.reduce((s, a) => s + a.score, 0) / allAttempts.length);

          // Bloom distribution
          const bloomDist: Record<string, number[]> = {};
          for (const a of allAttempts) {
            const bl = a.bloom_level_demonstrated || 'remember';
            if (!bloomDist[bl]) bloomDist[bl] = [];
            bloomDist[bl].push(a.score);
          }
          const bloomDistribution: Record<string, number> = {};
          for (const [bl, scores] of Object.entries(bloomDist)) {
            bloomDistribution[bl] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
          }

          // Top misconceptions
          const miscCounts: Record<string, number> = {};
          for (const a of allAttempts) {
            if (!a.is_correct && a.misconceptions) {
              for (const m of (Array.isArray(a.misconceptions) ? a.misconceptions : [])) {
                const text = m.misconception || m;
                if (text) miscCounts[text] = (miscCounts[text] || 0) + 1;
              }
            }
          }
          const topMisconceptions = Object.entries(miscCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([text, frequency]) => ({ text, frequency }));

          // At-risk students
          const studentScores = new Map<string, number[]>();
          for (const a of allAttempts) {
            if (!studentScores.has(a.student_id)) studentScores.set(a.student_id, []);
            studentScores.get(a.student_id)!.push(a.score);
          }

          const { data: enrollments } = await this.db.from('enrollments')
            .select('student_id, profiles:student_id(full_name)')
            .eq('course_id', courseId);
          const nameMap = new Map((enrollments || []).map((e: any) => [e.student_id, e.profiles?.full_name || 'Student']));

          const atRiskStudents: { name: string; score: number }[] = [];
          for (const [sid, scores] of studentScores) {
            const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
            if (avg < 60) atRiskStudents.push({ name: nameMap.get(sid) || 'Student', score: avg });
          }
          atRiskStudents.sort((a, b) => a.score - b.score);

          previousPerformance = {
            classAverage,
            bloomDistribution,
            topMisconceptions,
            atRiskStudents: atRiskStudents.slice(0, 5),
            totalStudents: studentScores.size,
          };
        }
      }

      // Save teacher feedback on previous lesson
      if (teacherFeedback && prevLesson.id) {
        await this.db.from('lessons').update({ teacher_feedback: teacherFeedback }).eq('id', prevLesson.id);
      }
    }

    // 4b. Gather class-level diagnostic profile (aggregated from individual diagnostics)
    const { data: classProfiles } = await this.db.from('learning_profiles')
      .select('strategy_profile, prior_knowledge_score, bloom_ceiling, logical, visual, reflective, kinesthetic, auditory, diagnostic_completed_at')
      .eq('course_id', courseId);

    let classProfile: any = null;
    if (classProfiles && classProfiles.length > 0) {
      const assessed = classProfiles.filter(p => p.diagnostic_completed_at);
      if (assessed.length > 0) {
        // Strategy distribution
        const strategyCounts: Record<string, number> = { surface: 0, deep: 0, competent: 0, struggling: 0 };
        for (const p of assessed) {
          if (p.strategy_profile && strategyCounts[p.strategy_profile] !== undefined) strategyCounts[p.strategy_profile]++;
        }
        const dominantStrategy = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0];

        // Average dimensions
        const avg = (field: string) => Math.round(assessed.reduce((s, p) => s + ((p as any)[field] || 50), 0) / assessed.length);
        const avgPriorKnowledge = Math.round(assessed.reduce((s, p) => s + (p.prior_knowledge_score || 0), 0) / assessed.length);

        // Dominant learning dimension
        const dimAvgs = { logical: avg('logical'), visual: avg('visual'), reflective: avg('reflective'), kinesthetic: avg('kinesthetic'), auditory: avg('auditory') };
        const dominantDim = Object.entries(dimAvgs).sort((a, b) => b[1] - a[1])[0];

        classProfile = {
          assessed_count: assessed.length,
          total_students: classProfiles.length,
          strategy_distribution: strategyCounts,
          dominant_strategy: dominantStrategy[0],
          dominant_strategy_pct: Math.round((dominantStrategy[1] / assessed.length) * 100),
          avg_prior_knowledge: avgPriorKnowledge,
          dominant_learning_dimension: dominantDim[0],
          dominant_dimension_score: dominantDim[1],
          learning_dimensions: dimAvgs,
          struggling_count: strategyCounts.struggling,
        };
      }
    }

    // 5. Determine DIKW level and remaining sub-concepts
    const totalSessions = course.total_sessions || 30;
    const dikwTarget = getDIKWLevelByPosition(nextLessonNumber, totalSessions);
    const subConcepts = gateSubConcepts.get(targetGate.id) || [];

    // Figure out which sub-concepts have been covered by previous lessons in this gate
    const { data: gateLessons } = await this.db.from('lessons')
      .select('key_idea').eq('gate_id', targetGate.id).eq('course_id', courseId);
    const coveredTopics = new Set((gateLessons || []).map(l => l.key_idea?.toLowerCase()).filter(Boolean));
    const remainingSubConcepts = subConcepts.filter(sc => !coveredTopics.has(sc.toLowerCase()));

    // 6. Build prompt
    const params: ProgressiveSessionParams = {
      gateTitle: targetGate.title,
      gateSubConcepts: subConcepts,
      gateNumber: targetGate.gate_number,
      totalGates: gates.length,
      lessonNumber: nextLessonNumber,
      totalSessions,
      sessionDuration: course.session_duration_minutes || 40,
      dikwTargetLevel: dikwTarget,
      classLevel: course.class_level || undefined,
      previousSession,
      previousPerformance,
      teacherFeedback: teacherFeedback || undefined,
      remainingSubConcepts: remainingSubConcepts.length > 0 ? remainingSubConcepts : subConcepts,
      lessonsRemainingInGate: Math.max(0, lessonsRemainingInGate),
      classProfile: classProfile || undefined,
    };

    const { system, user } = buildProgressiveSessionPrompt(params);

    // 7. Call LLM
    console.log(`Progressive: Generating Session ${nextLessonNumber} for course ${courseId} (Gate ${targetGate.gate_number}, DIKW: ${dikwTarget})`);
    const rawResponse = await this.llm.complete({
      systemPrompt: system,
      userMessage: user,
      maxTokens: 8000,
      temperature: 0.3,
      model: LLM_TIERS.FAST,
    });

    // 8. Parse response
    const jsonStr = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse LLM response as JSON');
    }

    const lessonData = parsed.lesson || parsed;
    const scriptData = parsed.socratic_script || parsed.script || {};
    const questionsData = parsed.questions || [];

    // 9. Write to DB
    const { data: lesson, error: lessonErr } = await this.db.from('lessons').insert({
      gate_id: targetGate.id,
      course_id: courseId,
      lesson_number: nextLessonNumber,
      title: lessonData.title || `Session ${nextLessonNumber}`,
      objective: lessonData.objective || '',
      key_idea: lessonData.key_idea || '',
      conceptual_breakthrough: lessonData.conceptual_breakthrough || '',
      bloom_levels: lessonData.bloom_levels || ['remember', 'understand'],
      examples: (lessonData.examples || []).map((e: any) => typeof e === 'string' ? { text: e } : e),
      exercises: (lessonData.exercises || []).map((e: any) => typeof e === 'string' ? { text: e } : e),
      duration_minutes: course.session_duration_minutes || 40,
      status: 'accepted',
      sort_order: nextLessonNumber,
      generation_context: { params, previousPerformance },
    }).select().single();

    if (lessonErr || !lesson) throw new Error(`Failed to insert lesson: ${lessonErr?.message}`);

    // Insert Socratic script stages
    const stages = scriptData.stages || [];
    if (stages.length > 0) {
      await this.db.from('socratic_scripts').insert(
        stages.map((s: any, i: number) => ({
          lesson_id: lesson.id,
          stage_number: s.stage_number || i + 1,
          stage_title: s.title || `Stage ${i + 1}`,
          duration_minutes: s.duration_minutes || 10,
          teacher_prompt: s.teacher_prompt || '',
          expected_response: s.expected_response || '',
          follow_up: s.follow_up || '',
          sort_order: i + 1,
          status: 'accepted',
        }))
      );
    }

    // Insert questions
    if (questionsData.length > 0) {
      const qInserts = questionsData.slice(0, 10).map((q: any) => ({
        gate_id: targetGate.id,
        course_id: courseId,
        question_text: q.question_text || '',
        question_type: q.question_type || 'mcq',
        bloom_level: q.bloom_level || 'remember',
        difficulty: q.difficulty || 1,
        options: q.options || null,
        correct_answer: q.correct_answer || '',
        rubric: q.rubric || '',
        distractors: q.distractors || null,
        is_diagnostic: false,
        status: 'accepted',
      }));
      await this.db.from('questions').insert(qInserts);
    }

    // Update course session counter
    await this.db.from('courses').update({
      current_session_number: nextLessonNumber,
      updated_at: new Date().toISOString(),
    }).eq('id', courseId);

    console.log(`Progressive: Session ${nextLessonNumber} generated — "${lessonData.title}" (Gate ${targetGate.gate_number})`);

    return {
      lesson: { ...lesson, socratic_scripts: stages },
      questions: questionsData,
      session_number: nextLessonNumber,
      remaining: totalSessions - nextLessonNumber,
      gate: { number: targetGate.gate_number, title: targetGate.title },
    };
  }

  async generateAllRemaining(courseId: string): Promise<any[]> {
    const results: any[] = [];
    const { data: course } = await this.db.from('courses')
      .select('total_sessions, current_session_number').eq('id', courseId).single();
    if (!course) throw new Error('Course not found');

    const total = course.total_sessions || 30;
    const current = course.current_session_number || 0;

    for (let i = current; i < total; i++) {
      try {
        const result = await this.generateNextSession(courseId);
        results.push(result);
      } catch (err) {
        console.error(`Progressive batch: failed at session ${i + 1}: ${(err as Error).message}`);
        break;
      }
    }

    return results;
  }
}
