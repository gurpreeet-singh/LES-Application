import { DeconstructionOutputSchema } from '@les/shared';
import type { DeconstructionOutput } from '@les/shared';

export function parseLLMOutput(raw: string): DeconstructionOutput {
  // Try to extract JSON from potential markdown code blocks
  let jsonStr = raw.trim();

  // Remove markdown code block wrapper if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find JSON object boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse LLM output as JSON: ${(e as Error).message}\nFirst 500 chars: ${raw.slice(0, 500)}`);
  }

  const result = DeconstructionOutputSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`LLM output validation failed: ${errors}`);
  }

  return result.data;
}
