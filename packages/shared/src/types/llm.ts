export interface DeconstructionOutput {
  step1_concepts: {
    name: string;
    description: string;
    is_atomic: boolean;
  }[];
  step2_knowledge_graph: {
    gates: {
      number: number;
      title: string;
      short_title: string;
      period: string;
      sub_concepts: string[];
      prerequisites: number[];
    }[];
  };
  step3_critical_gates: {
    gate_number: number;
    prerequisite_knowledge: string;
    why_necessary: string;
    what_breaks_if_skipped: string;
  }[];
  step4_bloom_mapping: {
    gate_number: number;
    bloom_targets: {
      remember: number;
      understand: number;
      apply: number;
      analyze: number;
      evaluate: number;
      create: number;
    };
    cognitive_jump_warnings: string[];
  }[];
  step5_learning_order: {
    gate_number: number;
    cognitive_sequence_position: number;
    rationale: string;
  }[];
  step6_lessons: {
    gate_number: number;
    lesson_number: number;
    title: string;
    objective: string;
    key_idea: string;
    conceptual_breakthrough: string;
    examples: string[];
    exercises: string[];
    bloom_levels: string[];
    duration_minutes: number;
  }[];
  step7_socratic_scripts: {
    lesson_number: number;
    stages: {
      stage_number: number;
      title: string;
      duration_minutes: number;
      teacher_prompt: string;
      expected_response: string;
      follow_up: string;
    }[];
  }[];
  step8_diagnostic_questions: {
    gate_number: number;
    sub_concept: string;
    bloom_level: string;
    question_text: string;
    type: 'mcq' | 'short_answer' | 'open_ended';
    options?: { text: string; is_correct: boolean }[];
    correct_answer: string;
    rubric: string;
    distractors: { answer: string; misconception: string }[];
  }[];
  step9_visual_map: {
    conceptual_spine: string[];
    description: string;
  };
  step10_outcomes: {
    outcome: string;
    bloom_level: string;
    gate_numbers: number[];
  }[];
}

export interface ProcessingStep {
  step: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

export interface ProcessingEvent {
  type: 'step' | 'complete' | 'error';
  step?: number;
  name?: string;
  status?: string;
  output?: DeconstructionOutput;
  error?: string;
}
