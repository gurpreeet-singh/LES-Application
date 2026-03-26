import { DeconstructionOutputSchema } from '@leap/shared';
import type { DeconstructionOutput } from '@leap/shared';

/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Works for the common case where the LLM output was cut off mid-response.
 */
function repairTruncatedJson(str: string): string {
  let s = str.trim();

  // Remove trailing comma if present
  s = s.replace(/,\s*$/, '');

  // Remove incomplete key-value pair at end (e.g., `"key": "incom`)
  s = s.replace(/,?\s*"[^"]*":\s*"[^"]*$/, '');
  s = s.replace(/,?\s*"[^"]*":\s*$/, '');
  s = s.replace(/,?\s*"[^"]*$/, '');

  // Count open brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  // Close any open structures
  while (openBrackets > 0) { s += ']'; openBrackets--; }
  while (openBraces > 0) { s += '}'; openBraces--; }

  return s;
}

export function parseLLMOutput(raw: string): DeconstructionOutput {
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
  } else if (firstBrace !== -1) {
    // Truncated — extract from first brace to end
    jsonStr = jsonStr.slice(firstBrace);
  }

  let parsed: unknown;

  // First attempt: direct parse
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Second attempt: repair truncated JSON
    try {
      const repaired = repairTruncatedJson(jsonStr);
      parsed = JSON.parse(repaired);
      console.log('JSON repaired successfully after truncation');
    } catch (e2) {
      throw new Error(`Failed to parse LLM output as JSON: ${(e2 as Error).message}\nFirst 500 chars: ${raw.slice(0, 500)}`);
    }
  }

  const result = DeconstructionOutputSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`LLM output validation failed: ${errors}`);
  }

  return result.data;
}
