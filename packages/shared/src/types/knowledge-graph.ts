export type GateStatus = 'draft' | 'accepted' | 'rejected';

export interface Gate {
  id: string;
  course_id: string;
  gate_number: number;
  title: string;
  short_title: string;
  color: string;
  light_color: string;
  period?: string;
  status: GateStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Populated via joins
  sub_concepts?: SubConcept[];
  prerequisites?: GatePrerequisite[];
}

export interface GatePrerequisite {
  id: string;
  gate_id: string;
  prerequisite_gate_id: string;
}

export interface SubConcept {
  id: string;
  gate_id: string;
  title: string;
  description?: string;
  sort_order: number;
  bloom_levels?: Record<string, boolean>;
  status: GateStatus;
  created_at: string;
}

export interface KnowledgeGraph {
  course_id: string;
  gates: Gate[];
  edges: GatePrerequisite[];
}
