import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
  DEFAULT_LLM_PROVIDER: (process.env.DEFAULT_LLM_PROVIDER || 'anthropic') as 'anthropic' | 'openai' | 'openrouter',
  DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
};

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const key of required) {
  if (!env[key]) {
    console.warn(`Warning: Missing required env var ${key}`);
  }
}
