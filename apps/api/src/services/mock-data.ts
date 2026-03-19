// Mock data for local demo mode (no Supabase needed)
import type { Profile, Course, Gate, SubConcept, Lesson, SocraticScript, Question } from '@les/shared';

export const MOCK_TEACHER: Profile = {
  id: 'teacher-001',
  email: 'anita@lmgc.edu',
  full_name: 'Mrs. Anita Verma',
  role: 'teacher',
  school: 'La Martiniere College',
  class_section: '5B',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const MOCK_STUDENTS: Profile[] = [
  { id: 'student-001', email: 'aarav@lmgc.edu', full_name: 'Aarav M.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-002', email: 'priya@lmgc.edu', full_name: 'Priya S.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-003', email: 'kabir@lmgc.edu', full_name: 'Kabir R.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-004', email: 'sia@lmgc.edu', full_name: 'Sia P.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-005', email: 'aryan@lmgc.edu', full_name: 'Aryan S.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-006', email: 'meera@lmgc.edu', full_name: 'Meera T.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-007', email: 'rohan@lmgc.edu', full_name: 'Rohan K.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'student-008', email: 'anaya@lmgc.edu', full_name: 'Anaya D.', role: 'student', school: 'La Martiniere College', class_section: '5B', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

export const MOCK_COURSE: Course = {
  id: 'course-001',
  teacher_id: 'teacher-001',
  title: 'Class 5 Mathematics',
  subject: 'Mathematics',
  class_level: '5',
  section: 'B',
  academic_year: '2026-27',
  status: 'active',
  llm_provider: 'anthropic',
  llm_model: 'claude-sonnet-4-20250514',
  mastery_threshold: 75,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const MOCK_GATES: (Gate & { sub_concepts: SubConcept[] })[] = [
  {
    id: 'gate-1', course_id: 'course-001', gate_number: 1, title: 'Large Numbers & Place Value', short_title: 'Numbers',
    color: '#2E75B6', light_color: '#D5E8F0', period: 'Mar-May', status: 'accepted', sort_order: 1,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-1-1', gate_id: 'gate-1', title: 'Place Value (8-9 digit)', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-1-2', gate_id: 'gate-1', title: 'Expanded Form', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-1-3', gate_id: 'gate-1', title: 'Comparison & Ordering', sort_order: 3, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-1-4', gate_id: 'gate-1', title: 'Indian vs International System', sort_order: 4, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'gate-2', course_id: 'course-001', gate_number: 2, title: 'Factors, HCF & LCM', short_title: 'HCF / LCM',
    color: '#1E7E34', light_color: '#D4EDDA', period: 'Jul Wk 1-2', status: 'accepted', sort_order: 2,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-2-1', gate_id: 'gate-2', title: 'Prime Factorisation', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-2-2', gate_id: 'gate-2', title: 'HCF by Division', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-2-3', gate_id: 'gate-2', title: 'LCM by Multiples', sort_order: 3, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'gate-3', course_id: 'course-001', gate_number: 3, title: 'Fractions (All Operations)', short_title: 'Fractions',
    color: '#7C3AED', light_color: '#EDE9FE', period: 'Jul-Aug', status: 'accepted', sort_order: 3,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-3-1', gate_id: 'gate-3', title: 'Equivalent Fractions', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-3-2', gate_id: 'gate-3', title: 'Add/Subtract Unlike', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-3-3', gate_id: 'gate-3', title: 'Multiply Fractions', sort_order: 3, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-3-4', gate_id: 'gate-3', title: 'Word Problems', sort_order: 4, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'gate-4', course_id: 'course-001', gate_number: 4, title: 'Decimals & Measurement', short_title: 'Decimals',
    color: '#B45309', light_color: '#FEF3C7', period: 'Oct-Dec', status: 'accepted', sort_order: 4,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-4-1', gate_id: 'gate-4', title: 'Decimal Place Value', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-4-2', gate_id: 'gate-4', title: 'Fraction-Decimal Conversion', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-4-3', gate_id: 'gate-4', title: 'Measurement Units', sort_order: 3, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'gate-5', course_id: 'course-001', gate_number: 5, title: 'Geometry & Mensuration', short_title: 'Geometry',
    color: '#DC2626', light_color: '#FEE2E2', period: 'Jul-Sep + Dec', status: 'accepted', sort_order: 5,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-5-1', gate_id: 'gate-5', title: 'Angles & Types', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-5-2', gate_id: 'gate-5', title: 'Perimeter & Area', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-5-3', gate_id: 'gate-5', title: 'Volume Basics', sort_order: 3, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
  {
    id: 'gate-6', course_id: 'course-001', gate_number: 6, title: 'Percentage & Data Handling', short_title: 'Percentage',
    color: '#1B3A6B', light_color: '#DBEAFE', period: 'Jan-Feb', status: 'accepted', sort_order: 6,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    sub_concepts: [
      { id: 'sc-6-1', gate_id: 'gate-6', title: 'Fraction to Percentage', sort_order: 1, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sc-6-2', gate_id: 'gate-6', title: 'Bar & Pie Charts', sort_order: 2, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
    ],
  },
];

// Student progress: [G1, G2, G3, G4, G5, G6]
const STUDENT_SCORES = [
  [92, 85, 72, 60, 78, 55],  // Aarav
  [92, 78, 54, 0, 81, 0],    // Priya
  [88, 70, 60, 45, 75, 0],   // Kabir
  [95, 88, 80, 72, 82, 68],  // Sia
  [78, 65, 48, 0, 60, 0],    // Aryan
  [82, 60, 40, 0, 55, 0],    // Meera
  [90, 82, 75, 68, 88, 52],  // Rohan
  [85, 72, 58, 0, 70, 0],    // Anaya
];

const BLOOM_DATA: Record<string, Record<string, number>>[] = [
  // Aarav
  { 'gate-1': { remember: 100, understand: 95, apply: 90, analyze: 72, evaluate: 45, create: 30 }, 'gate-2': { remember: 95, understand: 88, apply: 82, analyze: 60, evaluate: 35, create: 20 }, 'gate-3': { remember: 88, understand: 75, apply: 62, analyze: 40, evaluate: 20, create: 10 }, 'gate-4': { remember: 75, understand: 60, apply: 45, analyze: 25, evaluate: 10, create: 5 }, 'gate-5': { remember: 92, understand: 82, apply: 70, analyze: 50, evaluate: 30, create: 15 }, 'gate-6': { remember: 70, understand: 55, apply: 40, analyze: 20, evaluate: 8, create: 3 } },
  // Priya
  { 'gate-1': { remember: 100, understand: 95, apply: 88, analyze: 68, evaluate: 40, create: 25 }, 'gate-2': { remember: 90, understand: 80, apply: 68, analyze: 45, evaluate: 25, create: 12 }, 'gate-3': { remember: 72, understand: 55, apply: 38, analyze: 20, evaluate: 8, create: 3 }, 'gate-4': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 }, 'gate-5': { remember: 95, understand: 85, apply: 72, analyze: 55, evaluate: 32, create: 18 }, 'gate-6': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
  // Kabir
  { 'gate-1': { remember: 95, understand: 90, apply: 85, analyze: 65, evaluate: 38, create: 22 }, 'gate-2': { remember: 85, understand: 72, apply: 58, analyze: 35, evaluate: 18, create: 8 }, 'gate-3': { remember: 78, understand: 60, apply: 42, analyze: 22, evaluate: 10, create: 4 }, 'gate-4': { remember: 60, understand: 45, apply: 30, analyze: 15, evaluate: 5, create: 2 }, 'gate-5': { remember: 88, understand: 78, apply: 65, analyze: 45, evaluate: 25, create: 12 }, 'gate-6': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
  // Sia
  { 'gate-1': { remember: 100, understand: 98, apply: 92, analyze: 78, evaluate: 55, create: 38 }, 'gate-2': { remember: 98, understand: 92, apply: 85, analyze: 65, evaluate: 42, create: 28 }, 'gate-3': { remember: 92, understand: 82, apply: 72, analyze: 55, evaluate: 35, create: 20 }, 'gate-4': { remember: 85, understand: 72, apply: 60, analyze: 42, evaluate: 25, create: 12 }, 'gate-5': { remember: 95, understand: 88, apply: 78, analyze: 60, evaluate: 38, create: 22 }, 'gate-6': { remember: 82, understand: 68, apply: 55, analyze: 35, evaluate: 18, create: 8 } },
  // Aryan
  { 'gate-1': { remember: 90, understand: 80, apply: 68, analyze: 45, evaluate: 22, create: 10 }, 'gate-2': { remember: 80, understand: 65, apply: 50, analyze: 28, evaluate: 12, create: 5 }, 'gate-3': { remember: 65, understand: 48, apply: 30, analyze: 15, evaluate: 5, create: 2 }, 'gate-4': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 }, 'gate-5': { remember: 78, understand: 62, apply: 45, analyze: 28, evaluate: 12, create: 5 }, 'gate-6': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
  // Meera
  { 'gate-1': { remember: 92, understand: 85, apply: 75, analyze: 52, evaluate: 28, create: 15 }, 'gate-2': { remember: 75, understand: 60, apply: 42, analyze: 22, evaluate: 8, create: 3 }, 'gate-3': { remember: 55, understand: 38, apply: 25, analyze: 10, evaluate: 3, create: 1 }, 'gate-4': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 }, 'gate-5': { remember: 72, understand: 55, apply: 40, analyze: 22, evaluate: 8, create: 3 }, 'gate-6': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
  // Rohan
  { 'gate-1': { remember: 98, understand: 92, apply: 88, analyze: 70, evaluate: 48, create: 32 }, 'gate-2': { remember: 95, understand: 85, apply: 75, analyze: 58, evaluate: 35, create: 22 }, 'gate-3': { remember: 88, understand: 78, apply: 65, analyze: 48, evaluate: 28, create: 15 }, 'gate-4': { remember: 82, understand: 70, apply: 55, analyze: 38, evaluate: 20, create: 10 }, 'gate-5': { remember: 95, understand: 90, apply: 82, analyze: 65, evaluate: 42, create: 25 }, 'gate-6': { remember: 68, understand: 52, apply: 38, analyze: 20, evaluate: 8, create: 3 } },
  // Anaya
  { 'gate-1': { remember: 95, understand: 88, apply: 78, analyze: 55, evaluate: 30, create: 18 }, 'gate-2': { remember: 85, understand: 72, apply: 60, analyze: 40, evaluate: 20, create: 10 }, 'gate-3': { remember: 72, understand: 58, apply: 42, analyze: 22, evaluate: 8, create: 3 }, 'gate-4': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 }, 'gate-5': { remember: 82, understand: 72, apply: 58, analyze: 38, evaluate: 18, create: 8 }, 'gate-6': { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
];

function bloomCeiling(scores: Record<string, number>): string {
  const levels = ['create', 'evaluate', 'analyze', 'apply', 'understand', 'remember'];
  return levels.find(l => (scores[l] || 0) >= 60) || 'remember';
}

export function getMockProgress(studentIdx: number) {
  const scores = STUDENT_SCORES[studentIdx];
  const bloom = BLOOM_DATA[studentIdx];
  return MOCK_GATES.map((g, gi) => ({
    id: `progress-${studentIdx}-${gi}`,
    student_id: MOCK_STUDENTS[studentIdx].id,
    gate_id: g.id,
    course_id: 'course-001',
    mastery_pct: scores[gi],
    bloom_ceiling: bloomCeiling(bloom[g.id] || {}),
    bloom_scores: bloom[g.id] || { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 },
    velocity: Array.from({ length: 6 }, (_, w) => Math.min(100, Math.round(scores[gi] * (0.4 + w * 0.12)))),
    time_spent_minutes: Math.round(scores[gi] * 0.8),
    is_unlocked: scores[gi] > 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    gate: { id: g.id, gate_number: g.gate_number, title: g.title, short_title: g.short_title, color: g.color },
  }));
}

export const MOCK_LEARNING_PROFILE = {
  id: 'lp-001', student_id: 'student-002', course_id: 'course-001',
  logical: 88, visual: 68, reflective: 72, kinesthetic: 55, auditory: 32,
  inferred_from_attempts: 45, updated_at: '2026-03-15T00:00:00Z',
};

export const MOCK_SUGGESTIONS = [
  { id: 'sug-1', course_id: 'course-001', gate_id: 'gate-3', type: 'lesson_refine' as const, title: 'Visual fraction models', description: '44% stuck at Apply. Area models bridge to Analyze.', rationale: 'KG analysis', tag: 'G3 Apply→Analyze', status: 'pending' as const, generated_at: '2026-03-15T00:00:00Z' },
  { id: 'sug-2', course_id: 'course-001', gate_id: 'gate-3', type: 'peer_teaching' as const, title: 'Peer teaching pairs', description: 'Kabir and Sia (Analyze) pair with at-risk students.', rationale: 'KG analysis', tag: 'G3 Remediation', status: 'accepted' as const, generated_at: '2026-03-14T00:00:00Z' },
  { id: 'sug-3', course_id: 'course-001', gate_id: 'gate-4', type: 'gate_delay' as const, title: 'Delay Gate 4 by 1 week', description: '4 students below 75% on Gate 3. Moving now compounds gaps.', rationale: 'KG dependency', tag: 'G3→G4', status: 'pending' as const, generated_at: '2026-03-15T00:00:00Z' },
];
