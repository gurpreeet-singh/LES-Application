import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from './llm/provider.js';
import { LLM_TIERS } from './llm/provider.js';

/**
 * After a course is deconstructed, detect cross-course gate dependencies
 * by comparing gate topics across all of this teacher's courses.
 */
export async function detectCrossCourseEdges(
  db: SupabaseClient,
  llm: LLMProvider,
  courseId: string,
  teacherId: string,
): Promise<number> {
  // 1. Get all active courses for this teacher (excluding the just-processed one from status check)
  const { data: allCourses } = await db
    .from('courses')
    .select('id, title, subject')
    .eq('teacher_id', teacherId)
    .in('status', ['active', 'review']); // include review since the new one is in review

  if (!allCourses || allCourses.length < 2) return 0; // need at least 2 courses

  // 2. Get all gates across all teacher's courses
  const courseIds = allCourses.map(c => c.id);
  const { data: allGates } = await db
    .from('gates')
    .select('id, course_id, gate_number, title, short_title')
    .in('course_id', courseIds)
    .order('gate_number');

  if (!allGates || allGates.length === 0) return 0;

  // 3. Get existing cross-course edges (to avoid duplicates)
  const allGateIds = allGates.map(g => g.id);
  const { data: existingEdges } = await db
    .from('gate_prerequisites')
    .select('gate_id, prerequisite_gate_id')
    .in('gate_id', allGateIds);

  const existingEdgeSet = new Set((existingEdges || []).map(e => `${e.gate_id}|${e.prerequisite_gate_id}`));

  // 4. Build context for LLM
  const courseGateMap = allCourses.map(c => ({
    course_id: c.id,
    course_title: c.title,
    subject: c.subject,
    gates: allGates.filter(g => g.course_id === c.id).map(g => ({
      gate_id: g.id,
      gate_number: g.gate_number,
      title: g.title,
      short_title: g.short_title,
    })),
  }));

  const prompt = `You are analyzing university courses to find CROSS-COURSE prerequisite dependencies.

COURSES AND THEIR KNOWLEDGE GATES:
${courseGateMap.map(c => `
${c.course_title} (${c.subject}):
${c.gates.map(g => `  Gate ${g.gate_number}: ${g.title} (${g.short_title})`).join('\n')}`).join('\n')}

Find gate-to-gate dependencies WHERE A GATE IN ONE COURSE REQUIRES KNOWLEDGE FROM A GATE IN A DIFFERENT COURSE.

Rules:
- Only cross-course edges (not within the same course)
- The prerequisite gate should be from a foundational/lower-level course
- The dependent gate should genuinely need the prerequisite knowledge
- Be conservative — only include clear, well-justified dependencies
- Maximum 8 cross-course edges

Output ONLY valid JSON array:
[
  {
    "dependent_gate_id": "gate_id of the gate that NEEDS the prerequisite",
    "prerequisite_gate_id": "gate_id of the gate that must be mastered first",
    "reason": "brief explanation of why this dependency exists"
  }
]

If no cross-course dependencies exist, output: []`;

  let response: string;
  try {
    response = await llm.complete({
      systemPrompt: 'You are a curriculum design expert. Analyze course structures to find genuine cross-course prerequisite relationships. Output only valid JSON.',
      userMessage: prompt,
      maxTokens: 2000,
      temperature: 0.2,
      model: LLM_TIERS.FAST, // Tier 2: Pattern matching task — Haiku sufficient
    });
  } catch (err) {
    console.error('Cross-course detection LLM call failed:', (err as Error).message);
    return 0;
  }

  // 5. Parse LLM response
  let edges: { dependent_gate_id: string; prerequisite_gate_id: string; reason: string }[];
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    edges = JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    console.error('Cross-course detection: failed to parse LLM response');
    return 0;
  }

  // 6. Validate and insert new edges
  const validGateIds = new Set(allGateIds);
  const gateToCourse = new Map(allGates.map(g => [g.id, g.course_id]));
  const newEdges: { gate_id: string; prerequisite_gate_id: string }[] = [];

  for (const edge of edges) {
    const depGateId = edge.dependent_gate_id;
    const prereqGateId = edge.prerequisite_gate_id;

    // Validate both gates exist
    if (!validGateIds.has(depGateId) || !validGateIds.has(prereqGateId)) continue;
    // Must be cross-course
    if (gateToCourse.get(depGateId) === gateToCourse.get(prereqGateId)) continue;
    // Must not already exist
    if (existingEdgeSet.has(`${depGateId}|${prereqGateId}`)) continue;
    // No self-reference
    if (depGateId === prereqGateId) continue;

    newEdges.push({ gate_id: depGateId, prerequisite_gate_id: prereqGateId });
  }

  if (newEdges.length > 0) {
    const { error } = await db.from('gate_prerequisites').insert(newEdges);
    if (error) {
      console.error('Failed to insert cross-course edges:', error.message);
      return 0;
    }
    console.log(`Cross-course detection: inserted ${newEdges.length} new edges for teacher ${teacherId}`);
  }

  return newEdges.length;
}
