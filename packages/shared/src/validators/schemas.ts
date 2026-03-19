import { z } from 'zod';

export const ConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  is_atomic: z.boolean().default(true),
});

export const GateGraphSchema = z.object({
  number: z.number(),
  title: z.string(),
  short_title: z.string(),
  period: z.string().default(''),
  sub_concepts: z.array(z.string()),
  prerequisites: z.array(z.number()),
});

export const CriticalGateSchema = z.object({
  gate_number: z.number(),
  prerequisite_knowledge: z.string(),
  why_necessary: z.string(),
  what_breaks_if_skipped: z.string(),
});

export const BloomMappingSchema = z.object({
  gate_number: z.number(),
  bloom_targets: z.object({
    remember: z.number(),
    understand: z.number(),
    apply: z.number(),
    analyze: z.number(),
    evaluate: z.number(),
    create: z.number(),
  }),
  cognitive_jump_warnings: z.array(z.string()).default([]),
});

export const LearningOrderSchema = z.object({
  gate_number: z.number(),
  cognitive_sequence_position: z.number(),
  rationale: z.string(),
});

export const LessonSchema = z.object({
  gate_number: z.number(),
  lesson_number: z.number(),
  title: z.string(),
  objective: z.string(),
  key_idea: z.string().default(''),
  conceptual_breakthrough: z.string().default(''),
  examples: z.array(z.string()).default([]),
  exercises: z.array(z.string()).default([]),
  bloom_levels: z.array(z.string()),
  duration_minutes: z.number().default(40),
});

export const SocraticStageSchema = z.object({
  stage_number: z.number(),
  title: z.string(),
  duration_minutes: z.number().default(5),
  teacher_prompt: z.string(),
  expected_response: z.string().default(''),
  follow_up: z.string().default(''),
});

export const SocraticScriptSchema = z.object({
  lesson_number: z.number(),
  stages: z.array(SocraticStageSchema),
});

export const QuestionOptionSchema = z.object({
  text: z.string(),
  is_correct: z.boolean(),
});

export const DistractorSchema = z.object({
  answer: z.string(),
  misconception: z.string(),
});

export const DiagnosticQuestionSchema = z.object({
  gate_number: z.number(),
  sub_concept: z.string().default(''),
  bloom_level: z.string(),
  question_text: z.string(),
  type: z.enum(['mcq', 'short_answer', 'open_ended']),
  options: z.array(QuestionOptionSchema).optional(),
  correct_answer: z.string(),
  rubric: z.string().default(''),
  distractors: z.array(DistractorSchema).default([]),
});

export const VisualMapSchema = z.object({
  conceptual_spine: z.array(z.string()),
  description: z.string(),
});

export const OutcomeSchema = z.object({
  outcome: z.string(),
  bloom_level: z.string(),
  gate_numbers: z.array(z.number()),
});

export const DeconstructionOutputSchema = z.object({
  step1_concepts: z.array(ConceptSchema),
  step2_knowledge_graph: z.object({ gates: z.array(GateGraphSchema) }),
  step3_critical_gates: z.array(CriticalGateSchema),
  step4_bloom_mapping: z.array(BloomMappingSchema),
  step5_learning_order: z.array(LearningOrderSchema),
  step6_lessons: z.array(LessonSchema),
  step7_socratic_scripts: z.array(SocraticScriptSchema),
  step8_diagnostic_questions: z.array(DiagnosticQuestionSchema),
  step9_visual_map: VisualMapSchema,
  step10_outcomes: z.array(OutcomeSchema),
});
