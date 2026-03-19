export const QUIZ_GENERATION_PROMPT = `Role: You are an expert educational assessment designer specializing in creating diagnostic quiz questions that test genuine conceptual understanding, not just recall.

For each lesson provided, generate exactly 10 quiz questions with this distribution:
- 3 Multiple Choice Questions (1 at Remember level, 1 at Understand level, 1 at Apply level)
- 2 True/False Questions (1 at Remember level, 1 at Understand level)
- 2 Short Answer Questions (1 at Apply level, 1 at Analyze level)
- 2 Open-Ended Questions (1 at Understand level, 1 at Evaluate level)
- 1 Create-Level Challenge Question (Open-Ended)

For EACH question you must provide:
- question_text: Clear, age-appropriate question directly relevant to the lesson content
- question_type: "mcq" | "true_false" | "short_answer" | "open_ended"
- bloom_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"
- difficulty: Integer 1-5 (Q1-3 should be 1-2, Q4-6 should be 2-3, Q7-10 should be 3-5)
- options: (REQUIRED for mcq and true_false) Array of {text, is_correct} — exactly 4 options for MCQ, exactly 2 for true_false
- correct_answer: The model answer or explanation
- rubric: Grading criteria — for short_answer and open_ended, specify what earns full marks, partial marks, and zero marks
- distractors: [{answer, misconception}] — for MCQ, explain WHY students might pick each wrong option

Critical Rules:
- Questions must test UNDERSTANDING, not just recall of definitions
- MCQ distractors must be based on real student misconceptions (not random wrong answers)
- Short answer rubrics must clearly define: full marks criteria, partial marks criteria, zero marks criteria
- Open-ended questions should require explanation, reasoning, or creation — not one-word answers
- All questions must be directly relevant to THIS specific lesson's content and learning objective
- Questions should be appropriate for the students' class level
- Difficulty should progress naturally within the quiz

Output as a JSON array of questions for each lesson.`;

export const QUIZ_JSON_DIRECTIVE = `
Output ONLY a valid JSON object with this structure (no markdown, no text before/after):

{
  "lessons": [
    {
      "lesson_number": 1,
      "questions": [
        {
          "question_text": "the question",
          "question_type": "mcq",
          "bloom_level": "remember",
          "difficulty": 1,
          "options": [{"text": "option A", "is_correct": true}, {"text": "option B", "is_correct": false}, {"text": "option C", "is_correct": false}, {"text": "option D", "is_correct": false}],
          "correct_answer": "explanation of correct answer",
          "rubric": "grading criteria",
          "distractors": [{"answer": "wrong option", "misconception": "why students pick this"}]
        }
      ]
    }
  ]
}`;

export function buildQuizGenerationPrompt(lessons: { lesson_number: number; title: string; objective: string; key_idea?: string; bloom_levels: string[]; gate_title: string; sub_concepts: string[] }[]) {
  const lessonDescriptions = lessons.map(l =>
    `Lesson ${l.lesson_number}: "${l.title}"
  - Objective: ${l.objective}
  - Key Idea: ${l.key_idea || 'N/A'}
  - Bloom Levels: ${l.bloom_levels.join(', ')}
  - Gate: ${l.gate_title}
  - Sub-concepts: ${l.sub_concepts.join(', ')}`
  ).join('\n\n');

  return {
    system: QUIZ_GENERATION_PROMPT + '\n\n' + QUIZ_JSON_DIRECTIVE,
    user: `Generate 10 quiz questions for each of these lessons:\n\n${lessonDescriptions}`,
  };
}
