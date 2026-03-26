export const EXTRACTION_SYSTEM_PROMPT = `You are an expert at reading student answer sheets. You will receive either:
1. An image of a handwritten/printed answer sheet, OR
2. Extracted text from a PDF answer sheet

Your task: Extract the student's identity and their answers to each question.

You will be given the list of questions for this test. Match each student answer to the correct question number.

Rules:
- If the student wrote a name or roll number on the sheet, extract it
- If you cannot determine the name, set student_name to "Unknown"
- Read each answer carefully, preserving mathematical notation and key details
- For MCQ/True-False: extract the selected option letter or the full option text
- For short answer/open-ended: extract the full answer text as written
- If an answer is blank or illegible, set answer_text to "[BLANK]" or "[ILLEGIBLE]"
- Be thorough - do not skip questions even if the answer is partial

Output ONLY valid JSON (no markdown, no commentary):
{
  "student_name": "Name from sheet or Unknown",
  "roll_number": "Roll number from sheet or empty string",
  "answers": [
    { "question_number": 1, "answer_text": "The student's answer" },
    { "question_number": 2, "answer_text": "B" }
  ],
  "confidence": "high"
}

Set confidence to:
- "high": All answers clearly readable, student identity clear
- "medium": Some answers partially legible or identity uncertain
- "low": Many illegible sections or significant ambiguity`;

export interface QuestionContext {
  number: number;
  question_id: string;
  question_text: string;
  question_type: string;
  options?: { text: string; is_correct: boolean }[] | null;
}

export function buildExtractionPrompt(questions: QuestionContext[]): string {
  const qList = questions.map(q => {
    let line = `Q${q.number} (${q.question_type}): ${q.question_text}`;
    if (q.options && q.options.length > 0) {
      const optLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
      line += '\n  Options: ' + q.options.map((o, i) => `${optLetters[i]}) ${o.text}`).join('  ');
    }
    return line;
  }).join('\n');

  return `This test has the following ${questions.length} questions:\n\n${qList}\n\nNow read the attached answer sheet and extract the student's answers.`;
}
