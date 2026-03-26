import { env } from '../../config/env.js';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface LLMProvider {
  complete(params: {
    systemPrompt: string;
    userMessage: string | ContentPart[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
}

export function createLLMProvider(provider?: string): LLMProvider {
  const p = provider || env.DEFAULT_LLM_PROVIDER;

  if (p === 'openrouter' && env.OPENROUTER_API_KEY) {
    return new OpenRouterProvider();
  }

  if (p === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }

  if (p === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider();
  }

  // Fallback: use whichever provider has a key configured
  if (env.OPENROUTER_API_KEY) return new OpenRouterProvider();
  if (env.ANTHROPIC_API_KEY) return new AnthropicProvider();
  if (env.OPENAI_API_KEY) return new OpenAIProvider();

  // Last resort — try openrouter
  return new OpenRouterProvider();
}

class AnthropicProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string | ContentPart[]; temperature?: number; maxTokens?: number }) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Convert ContentPart[] to Anthropic format
    let content: any;
    if (typeof params.userMessage === 'string') {
      content = params.userMessage;
    } else {
      content = params.userMessage.map(part => {
        if (part.type === 'text') return { type: 'text' as const, text: part.text };
        // Convert data URL to Anthropic image block
        const match = part.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          return { type: 'image' as const, source: { type: 'base64' as const, media_type: match[1] as any, data: match[2] } };
        }
        return { type: 'text' as const, text: '[Image could not be processed]' };
      });
    }

    const response = await client.messages.create({
      model: env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: params.maxTokens || 16000,
      temperature: params.temperature ?? 0.3,
      system: params.systemPrompt,
      messages: [{ role: 'user', content }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || '';
  }
}

class OpenAIProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string | ContentPart[]; temperature?: number; maxTokens?: number }) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const userContent = typeof params.userMessage === 'string'
      ? params.userMessage
      : params.userMessage as any;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: params.maxTokens || 16000,
      temperature: params.temperature ?? 0.3,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }
}

class OpenRouterProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string | ContentPart[]; temperature?: number; maxTokens?: number }) {
    const userContent = typeof params.userMessage === 'string'
      ? params.userMessage
      : params.userMessage;

    // Use fetch + SSE streaming directly to avoid OpenAI SDK timeout checks
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'LEAP Platform',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
        max_tokens: params.maxTokens || 16000,
        temperature: params.temperature ?? 0.3,
        stream: true,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${err.slice(0, 200)}`);
    }

    // Parse SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) result += delta;
        } catch { /* skip malformed chunks */ }
      }
    }

    return result;
  }
}
