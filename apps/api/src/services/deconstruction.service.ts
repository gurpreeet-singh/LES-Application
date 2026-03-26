import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { SYSTEM_PROMPT, GATE_COLORS } from '@leap/shared';
import { parseLLMOutput } from './llm/parser.js';
import type { DeconstructionOutput } from '@leap/shared';

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

// Phase 1 prompt: structure only (gates, concepts, bloom, sequence)
const PHASE1_OUTPUT = `
Output ONLY valid JSON (no markdown, no commentary):
{
  "step1_concepts": [{ "name": "concept name", "description": "brief description", "is_atomic": true }],
  "step2_knowledge_graph": {
    "gates": [{
      "number": 1, "title": "Gate Title", "short_title": "Short", "period": "Month range",
      "sub_concepts": ["concept1", "concept2"], "prerequisites": []
    }]
  },
  "step3_critical_gates": [{ "gate_number": 1, "prerequisite_knowledge": "what", "why_necessary": "why", "what_breaks_if_skipped": "impact" }],
  "step4_bloom_mapping": [{ "gate_number": 1, "bloom_targets": { "remember": 90, "understand": 80, "apply": 75, "analyze": 60, "evaluate": 40, "create": 30 }, "cognitive_jump_warnings": [] }],
  "step5_learning_order": [{ "gate_number": 1, "cognitive_sequence_position": 1, "rationale": "why" }],
  "step9_visual_map": { "conceptual_spine": ["concept1", "concept2"], "description": "narrative" },
  "step10_outcomes": [{ "outcome": "what learner can do", "bloom_level": "apply", "gate_numbers": [1] }]
}`;

// Distribute totalSessions proportionally across gates based on sub_concept count
function distributeLessonsAcrossGates(gates: { number: number; sub_concepts: string[] }[], totalSessions: number): Map<number, number> {
  const totalSubConcepts = gates.reduce((sum, g) => sum + g.sub_concepts.length, 0);
  const distribution = new Map<number, number>();

  // Proportional allocation with minimum 1 lesson per gate
  let remaining = totalSessions;
  const rawShares = gates.map(g => ({
    number: g.number,
    share: totalSubConcepts > 0 ? (g.sub_concepts.length / totalSubConcepts) * totalSessions : totalSessions / gates.length,
  }));

  // First pass: assign floor values, minimum 1
  for (const g of rawShares) {
    const count = Math.max(1, Math.floor(g.share));
    distribution.set(g.number, count);
    remaining -= count;
  }

  // Second pass: distribute remainder to gates with largest fractional parts
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

// Phase 2 prompt: lessons + scripts for a SINGLE gate
function buildPhase2GatePrompt(
  gate: { number: number; title: string; sub_concepts: string[] },
  lessonCount: number,
  startLessonNumber: number,
  sessionDuration: number,
) {
  const lessonNumbers = Array.from({ length: lessonCount }, (_, i) => startLessonNumber + i);

  return `Generate detailed lessons and Socratic teaching scripts for this single knowledge gate.

GATE ${gate.number}: ${gate.title}
Sub-concepts: ${gate.sub_concepts.join(', ')}

CONSTRAINTS:
- Generate EXACTLY ${lessonCount} lessons for this gate.
- Lesson numbers must be: ${lessonNumbers.join(', ')} (globally sequential across the full course).
- Each lesson is ${sessionDuration} minutes.
- Generate a 4-stage Socratic script for EVERY lesson.

Output ONLY valid JSON:
{
  "step6_lessons": [{
    "gate_number": ${gate.number}, "lesson_number": ${startLessonNumber}, "title": "Lesson Title",
    "objective": "learning objective", "key_idea": "core insight",
    "conceptual_breakthrough": "aha moment", "examples": ["example1", "example2"],
    "exercises": ["exercise1", "exercise2"], "bloom_levels": ["remember", "understand"],
    "duration_minutes": ${sessionDuration}
  }],
  "step7_socratic_scripts": [{
    "lesson_number": ${startLessonNumber},
    "stages": [
      { "stage_number": 1, "title": "Hook", "duration_minutes": 5, "teacher_prompt": "opening question", "expected_response": "student thinking", "follow_up": "bridge to discovery" },
      { "stage_number": 2, "title": "Discovery", "duration_minutes": 15, "teacher_prompt": "guided question", "expected_response": "student discovery", "follow_up": "deepen understanding" },
      { "stage_number": 3, "title": "Concept Build", "duration_minutes": 12, "teacher_prompt": "formalize concept", "expected_response": "student articulation", "follow_up": "connect to definition" },
      { "stage_number": 4, "title": "Application", "duration_minutes": 8, "teacher_prompt": "apply to new problem", "expected_response": "student solution", "follow_up": "preview next lesson" }
    ]
  }]
}`;
}

// Phase 3 prompt: 10 questions per gate (distributed across lessons)
function buildPhase3Prompt(gates: { number: number; title: string; sub_concepts: string[] }[], lessons: { gate_number: number; lesson_number: number; title: string }[]) {
  const gateList = gates.map(g => {
    const gateLessons = lessons.filter(l => l.gate_number === g.number);
    const lessonList = gateLessons.map(l => `  Lesson ${l.lesson_number}: ${l.title}`).join('\n');
    return `Gate ${g.number}: ${g.title}\n  Sub-concepts: ${g.sub_concepts.join(', ')}\n${lessonList}`;
  }).join('\n\n');

  return `Generate 10 diagnostic quiz questions PER GATE for these knowledge gates and lessons. Each gate must have exactly 10 questions spread across Bloom's taxonomy levels:
- 2 MCQ (remember/understand)
- 2 True/False (remember/understand)
- 3 Short Answer (apply/analyze)
- 3 Open-Ended (analyze/evaluate/create)

GATES AND LESSONS:
${gateList}

Output ONLY valid JSON:
{
  "step8_diagnostic_questions": [{
    "gate_number": 1, "sub_concept": "concept name", "bloom_level": "understand",
    "question_text": "the question", "type": "mcq",
    "options": [{ "text": "option A", "is_correct": true }, { "text": "option B", "is_correct": false }, { "text": "option C", "is_correct": false }, { "text": "option D", "is_correct": false }],
    "correct_answer": "correct answer explanation", "rubric": "grading criteria",
    "distractors": [{ "answer": "common wrong answer", "misconception": "why students pick this" }]
  }]
}`;
}

export class DeconstructionService {
  constructor(private llm: LLMProvider, private db: SupabaseClient) {}

  async processSyllabus(
    courseId: string,
    syllabusText: string,
    onProgress?: (step: number, name: string, status: string) => void,
    totalSessions?: number,
    sessionDuration?: number,
  ): Promise<void> {
    const sessions = totalSessions || 20;
    const duration = sessionDuration || 40;

    // === PHASE 1: Structure (steps 1-5, 9-10) ===
    let timetableNote = '';
    if (sessions > 0) {
      timetableNote = `\nThe course has ${sessions} sessions of ${duration} minutes each. Design ${Math.min(8, Math.ceil(sessions / 3))} gates maximum, distributed to fill ${sessions} lessons total.`;
    }

    const phase1System = SYSTEM_PROMPT + timetableNote + '\n\nPerform steps 1-5, 9, and 10 ONLY. Do NOT generate lessons or scripts yet.\n' + PHASE1_OUTPUT;

    let phase1Raw: string;
    try {
      phase1Raw = await this.llm.complete({
        systemPrompt: phase1System,
        userMessage: `Deconstruct this syllabus (structure only — gates, concepts, bloom, sequence):\n\n${syllabusText}`,
        maxTokens: 8000,
        temperature: 0.3,
      });
    } catch (err) {
      throw new Error(`Phase 1 (structure) failed: ${(err as Error).message}`);
    }

    // Parse phase 1
    const phase1 = this.parseJsonResponse(phase1Raw, 'Phase 1');

    const gates = phase1.step2_knowledge_graph?.gates || [];
    if (gates.length === 0) {
      throw new Error('AI returned no knowledge gates. Please try again with more detailed syllabus text.');
    }

    // === PHASE 2: Lessons + Scripts (steps 6-7) — one LLM call per gate ===
    const lessonDistribution = distributeLessonsAcrossGates(gates, sessions);
    const allLessons: any[] = [];
    const allScripts: any[] = [];
    let nextLessonNumber = 1;

    for (const gate of gates) {
      const lessonCount = lessonDistribution.get(gate.number) || 1;
      const startLesson = nextLessonNumber;
      nextLessonNumber += lessonCount;

      const gatePrompt = buildPhase2GatePrompt(gate, lessonCount, startLesson, duration);

      let gateRaw: string;
      try {
        gateRaw = await this.llm.complete({
          systemPrompt: SYSTEM_PROMPT + '\n\nGenerate detailed lessons and Socratic teaching scripts for the specified gate.\n',
          userMessage: gatePrompt,
          maxTokens: 8000,
          temperature: 0.3,
        });
      } catch (err) {
        console.error(`Phase 2 gate ${gate.number} failed: ${(err as Error).message}`);
        continue; // Skip this gate but keep going
      }

      let gateResult: any;
      try {
        gateResult = this.parseJsonResponse(gateRaw, `Phase 2 gate ${gate.number}`);
      } catch (err) {
        console.error(`Phase 2 gate ${gate.number} parse failed: ${(err as Error).message}`);
        continue;
      }

      const gateLessons = gateResult.step6_lessons || [];
      const gateScripts = gateResult.step7_socratic_scripts || [];

      // Enforce correct gate_number and sequential lesson_number in case LLM drifts
      for (let i = 0; i < gateLessons.length; i++) {
        gateLessons[i].gate_number = gate.number;
        gateLessons[i].lesson_number = startLesson + i;
      }
      for (let i = 0; i < gateScripts.length; i++) {
        gateScripts[i].lesson_number = startLesson + i;
      }

      allLessons.push(...gateLessons);
      allScripts.push(...gateScripts);
    }

    const phase2 = {
      step6_lessons: allLessons,
      step7_socratic_scripts: allScripts,
    };

    // Questions are generated on-demand per lesson via the /questions/generate endpoint.
    // This keeps processing fast (~2 min) and generates better per-lesson questions.

    // Merge phases 1 + 2
    const merged: DeconstructionOutput = {
      step1_concepts: phase1.step1_concepts || [],
      step2_knowledge_graph: phase1.step2_knowledge_graph || { gates: [] },
      step3_critical_gates: phase1.step3_critical_gates || [],
      step4_bloom_mapping: phase1.step4_bloom_mapping || [],
      step5_learning_order: phase1.step5_learning_order || [],
      step6_lessons: phase2.step6_lessons || [],
      step7_socratic_scripts: phase2.step7_socratic_scripts || [],
      step8_diagnostic_questions: [],
      step9_visual_map: phase1.step9_visual_map || { conceptual_spine: [], description: '' },
      step10_outcomes: phase1.step10_outcomes || [],
    };

    // Write to database
    await this.writeToDatabase(courseId, merged);

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

  private parseJsonResponse(raw: string, label: string): any {
    let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const first = s.indexOf('{');
    if (first === -1) throw new Error(`${label}: No JSON object found`);

    // Try clean parse first
    const last = s.lastIndexOf('}');
    if (last > first) {
      try { return JSON.parse(s.slice(first, last + 1)); } catch { /* fall through to repair */ }
    }

    // Repair truncated JSON
    s = s.slice(first);

    // If cut mid-string, close the string
    if (s.endsWith('\\')) s = s.slice(0, -1);

    // Remove trailing incomplete values
    // Cut back to last complete value (ends with }, ], number, true, false, null, or ")
    const lastGood = s.search(/[}\]"0-9efalsnul]\s*$/);
    if (lastGood > 0) s = s.slice(0, lastGood + 1);

    // Remove trailing comma
    s = s.replace(/,\s*$/, '');

    // If we're inside an unclosed string, close it
    let inStr = false, esc = false;
    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = !inStr;
    }
    if (inStr) s += '"';

    // Count and close open brackets/braces
    inStr = false; esc = false;
    let ob = 0, oa = 0;
    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') ob++; if (ch === '}') ob--;
      if (ch === '[') oa++; if (ch === ']') oa--;
    }
    while (oa > 0) { s += ']'; oa--; }
    while (ob > 0) { s += '}'; ob--; }

    try {
      console.log(`${label} JSON repaired after truncation (${s.length} chars)`);
      return JSON.parse(s);
    } catch (e) {
      throw new Error(`${label} JSON parse failed: ${(e as Error).message}\nFirst 300 chars: ${raw.slice(0, 300)}`);
    }
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

    const gateIdMap = new Map(gates.map(g => [g.gate_number, g.id]));

    // 2. Insert prerequisites
    const gateNameToNumber = new Map(output.step2_knowledge_graph.gates.map(g => [g.title.toLowerCase(), g.number]));
    const prereqInserts: { gate_id: string; prerequisite_gate_id: string }[] = [];
    for (const g of output.step2_knowledge_graph.gates) {
      for (const prereq of g.prerequisites) {
        let prereqNumber: number;
        if (typeof prereq === 'number') {
          prereqNumber = prereq;
        } else {
          prereqNumber = parseInt(String(prereq), 10);
          if (isNaN(prereqNumber)) {
            prereqNumber = gateNameToNumber.get(String(prereq).toLowerCase()) || 0;
          }
        }
        const gateId = gateIdMap.get(g.number);
        const prereqId = gateIdMap.get(prereqNumber);
        if (gateId && prereqId && gateId !== prereqId) {
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
