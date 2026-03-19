import { env } from '../../config/env.js';

export interface LLMProvider {
  complete(params: {
    systemPrompt: string;
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
}

export function createLLMProvider(provider?: string): LLMProvider {
  const p = provider || env.DEFAULT_LLM_PROVIDER;

  if (p === 'openrouter') {
    return new OpenRouterProvider();
  }

  if (p === 'openai') {
    return new OpenAIProvider();
  }

  return new AnthropicProvider();
}

class AnthropicProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string; temperature?: number; maxTokens?: number }) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: params.maxTokens || 16000,
      temperature: params.temperature ?? 0.3,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || '';
  }
}

class OpenAIProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string; temperature?: number; maxTokens?: number }) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: params.maxTokens || 16000,
      temperature: params.temperature ?? 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }
}

class OpenRouterProvider implements LLMProvider {
  async complete(params: { systemPrompt: string; userMessage: string; temperature?: number; maxTokens?: number }) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'LES Platform - Learning Effectiveness System',
      },
    });

    const response = await client.chat.completions.create({
      model: env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      max_tokens: params.maxTokens || 16000,
      temperature: params.temperature ?? 0.3,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }
}
