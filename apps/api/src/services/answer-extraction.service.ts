import type { LLMProvider, ContentPart } from './llm/provider.js';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from '@leap/shared';
import type { QuestionContext } from '@leap/shared';

export interface ExtractedStudentSheet {
  student_name: string;
  roll_number: string;
  answers: { question_number: number; answer_text: string }[];
  confidence: 'high' | 'medium' | 'low';
}

export class AnswerExtractionService {
  constructor(private llm: LLMProvider) {}

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    questions: QuestionContext[],
  ): Promise<ExtractedStudentSheet> {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const questionPrompt = buildExtractionPrompt(questions);

    const content: ContentPart[] = [
      { type: 'text', text: questionPrompt },
      { type: 'image_url', image_url: { url: dataUrl } },
    ];

    const raw = await this.llm.complete({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userMessage: content,
      temperature: 0.1,
      maxTokens: 4000,
    });

    return this.parseResponse(raw, questions.length);
  }

  async extractFromPDFText(
    pdfText: string,
    questions: QuestionContext[],
  ): Promise<ExtractedStudentSheet> {
    const questionPrompt = buildExtractionPrompt(questions);
    const userMessage = `${questionPrompt}\n\n--- ANSWER SHEET TEXT (extracted from PDF) ---\n\n${pdfText}`;

    const raw = await this.llm.complete({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userMessage,
      temperature: 0.1,
      maxTokens: 4000,
    });

    return this.parseResponse(raw, questions.length);
  }

  async extractFromFiles(
    files: Express.Multer.File[],
    questions: QuestionContext[],
  ): Promise<ExtractedStudentSheet[]> {
    const results: ExtractedStudentSheet[] = [];

    for (const file of files) {
      try {
        if (file.mimetype === 'application/pdf') {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(file.buffer);

          if (pdfData.text && pdfData.text.trim().length > 50) {
            const sheet = await this.extractFromPDFText(pdfData.text, questions);
            results.push(sheet);
          } else {
            // Scanned PDF with no text — send as image won't work easily
            // Return a placeholder asking for image upload instead
            results.push({
              student_name: 'Unknown (Scanned PDF)',
              roll_number: '',
              answers: questions.map((_, i) => ({
                question_number: i + 1,
                answer_text: '[ILLEGIBLE - Please upload as image instead of scanned PDF]',
              })),
              confidence: 'low',
            });
          }
        } else {
          // Image file (JPG/PNG)
          const sheet = await this.extractFromImage(file.buffer, file.mimetype, questions);
          results.push(sheet);
        }
      } catch (err) {
        console.error(`Extraction failed for ${file.originalname}:`, err);
        results.push({
          student_name: `Unknown (${file.originalname})`,
          roll_number: '',
          answers: questions.map((_, i) => ({
            question_number: i + 1,
            answer_text: '[EXTRACTION FAILED]',
          })),
          confidence: 'low',
        });
      }
    }

    return results;
  }

  private parseResponse(raw: string, questionCount: number): ExtractedStudentSheet {
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      student_name: parsed.student_name || 'Unknown',
      roll_number: parsed.roll_number || '',
      answers: (parsed.answers || []).map((a: any) => ({
        question_number: a.question_number,
        answer_text: a.answer_text || '[BLANK]',
      })),
      confidence: parsed.confidence || 'medium',
    };
  }
}
