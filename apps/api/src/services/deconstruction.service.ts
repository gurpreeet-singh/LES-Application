import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { buildDeconstructionPrompt, GATE_COLORS } from '@les/shared';
import { parseLLMOutput } from './llm/parser.js';
import type { DeconstructionOutput } from '@les/shared';

const STEP_NAMES = [
  'Extract Core Concepts',
  'Build Knowledge Graph',
  'Define Critical Gates',
  "Bloom's Taxonomy Mapping",
  'Reorder to Cognitive Sequence',
  'Lesson Architecture',
  'Socratic Teaching Scripts',
  'Diagnostic Questions',
  'Visual Master Map',
  'Learning Outcomes',
];

export class DeconstructionService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async processSyllabus(
    courseId: string,
    syllabusText: string,
    onProgress?: (step: number, name: string, status: string) => void,
  ): Promise<void> {
    // Emit all steps as pending
    for (let i = 0; i < STEP_NAMES.length; i++) {
      onProgress?.(i + 1, STEP_NAMES[i], 'pending');
    }

    // Single LLM call for all 10 steps
    onProgress?.(1, STEP_NAMES[0], 'processing');

    const { system, user } = buildDeconstructionPrompt(syllabusText);

    let rawResponse: string;
    try {
      rawResponse = await this.llm.complete({
        systemPrompt: system,
        userMessage: user,
        maxTokens: 16000,
        temperature: 0.3,
      });
    } catch (err) {
      throw new Error(`LLM call failed: ${(err as Error).message}`);
    }

    // Mark steps as complete as we parse
    for (let i = 0; i < 5; i++) {
      onProgress?.(i + 1, STEP_NAMES[i], 'complete');
    }

    // Parse and validate
    onProgress?.(6, STEP_NAMES[5], 'processing');
    const output = parseLLMOutput(rawResponse);

    for (let i = 5; i < STEP_NAMES.length; i++) {
      onProgress?.(i + 1, STEP_NAMES[i], 'complete');
    }

    // Write to database
    await this.writeToDatabase(courseId, output);

    // Update course status
    await this.db
      .from('courses')
      .update({
        status: 'review',
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId);
  }

  private async writeToDatabase(courseId: string, output: DeconstructionOutput): Promise<void> {
    // 1. Insert gates
    const gateInserts = output.step2_knowledge_graph.gates.map((g, i) => ({
      course_id: courseId,
      gate_number: g.number,
      title: g.title,
      short_title: g.short_title,
      color: GATE_COLORS[i % GATE_COLORS.length].color,
      light_color: GATE_COLORS[i % GATE_COLORS.length].light,
      period: g.period,
      sort_order: output.step5_learning_order.find(o => o.gate_number === g.number)?.cognitive_sequence_position || i + 1,
      status: 'draft',
    }));

    const { data: gates, error: gateErr } = await this.db
      .from('gates')
      .insert(gateInserts)
      .select();

    if (gateErr || !gates) {
      throw new Error(`Failed to insert gates: ${gateErr?.message}`);
    }

    // Build gate number -> id map
    const gateIdMap = new Map(gates.map(g => [g.gate_number, g.id]));

    // 2. Insert prerequisites
    const prereqInserts: { gate_id: string; prerequisite_gate_id: string }[] = [];
    for (const g of output.step2_knowledge_graph.gates) {
      for (const prereq of g.prerequisites) {
        const gateId = gateIdMap.get(g.number);
        const prereqId = gateIdMap.get(prereq);
        if (gateId && prereqId) {
          prereqInserts.push({ gate_id: gateId, prerequisite_gate_id: prereqId });
        }
      }
    }

    if (prereqInserts.length > 0) {
      await this.db.from('gate_prerequisites').insert(prereqInserts);
    }

    // 3. Insert sub-concepts
    const subConceptInserts = output.step2_knowledge_graph.gates.flatMap(g =>
      g.sub_concepts.map((sc, i) => ({
        gate_id: gateIdMap.get(g.number)!,
        title: sc,
        sort_order: i + 1,
        status: 'draft',
      }))
    ).filter(sc => sc.gate_id);

    if (subConceptInserts.length > 0) {
      await this.db.from('sub_concepts').insert(subConceptInserts);
    }

    // 4. Insert bloom targets
    const bloomInserts = output.step4_bloom_mapping.map(bm => ({
      gate_id: gateIdMap.get(bm.gate_number)!,
      remember: bm.bloom_targets.remember,
      understand: bm.bloom_targets.understand,
      apply: bm.bloom_targets.apply,
      analyze: bm.bloom_targets.analyze,
      evaluate: bm.bloom_targets.evaluate,
      create_level: bm.bloom_targets.create,
    })).filter(b => b.gate_id);

    if (bloomInserts.length > 0) {
      await this.db.from('gate_bloom_targets').insert(bloomInserts);
    }

    // 5. Insert lessons
    const lessonInserts = output.step6_lessons.map(l => ({
      gate_id: gateIdMap.get(l.gate_number)!,
      course_id: courseId,
      lesson_number: l.lesson_number,
      title: l.title,
      objective: l.objective,
      key_idea: l.key_idea,
      conceptual_breakthrough: l.conceptual_breakthrough,
      bloom_levels: l.bloom_levels,
      examples: l.examples.map(e => ({ text: e })),
      exercises: l.exercises.map(e => ({ text: e })),
      duration_minutes: l.duration_minutes,
      sort_order: l.lesson_number,
      status: 'draft',
    })).filter(l => l.gate_id);

    const { data: lessons } = await this.db.from('lessons').insert(lessonInserts).select();

    // Build lesson number -> id map
    const lessonIdMap = new Map((lessons || []).map(l => [l.lesson_number, l.id]));

    // 6. Insert Socratic scripts
    const scriptInserts = output.step7_socratic_scripts.flatMap(s =>
      s.stages.map(stage => ({
        lesson_id: lessonIdMap.get(s.lesson_number)!,
        stage_number: stage.stage_number,
        stage_title: stage.title,
        duration_minutes: stage.duration_minutes,
        teacher_prompt: stage.teacher_prompt,
        expected_response: stage.expected_response,
        follow_up: stage.follow_up,
        sort_order: stage.stage_number,
        status: 'draft',
      }))
    ).filter(s => s.lesson_id);

    if (scriptInserts.length > 0) {
      await this.db.from('socratic_scripts').insert(scriptInserts);
    }

    // 7. Insert diagnostic questions
    const questionInserts = output.step8_diagnostic_questions.map(q => ({
      gate_id: gateIdMap.get(q.gate_number)!,
      course_id: courseId,
      question_text: q.question_text,
      question_type: q.type,
      bloom_level: q.bloom_level,
      options: q.options || null,
      correct_answer: q.correct_answer,
      rubric: q.rubric,
      distractors: q.distractors,
      is_diagnostic: true,
      status: 'draft',
    })).filter(q => q.gate_id);

    if (questionInserts.length > 0) {
      await this.db.from('questions').insert(questionInserts);
    }
  }
}
