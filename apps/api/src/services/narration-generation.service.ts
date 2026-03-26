import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export class NarrationGenerationService {
  constructor(private db: SupabaseClient) {}

  async buildNarrationScript(lessonId: string): Promise<{ script: string; lesson: any; gate: any }> {
    const { data: lesson } = await this.db
      .from('lessons')
      .select('*, socratic_scripts(*)')
      .eq('id', lessonId)
      .single();

    if (!lesson) throw new Error('Lesson not found');

    const { data: gate } = await this.db
      .from('gates')
      .select('gate_number, title, short_title')
      .eq('id', lesson.gate_id)
      .single();

    const scripts = (lesson.socratic_scripts || []).sort((a: any, b: any) => a.stage_number - b.stage_number);
    const examples = (lesson.examples || []).map((e: any) => typeof e === 'string' ? e : e.text || '');
    const exercises = (lesson.exercises || []).map((e: any) => typeof e === 'string' ? e : e.text || '');

    const topicLabel = `Topic ${gate?.gate_number || ''}: ${gate?.short_title || ''}`;
    const parts: string[] = [];

    // Opening — warm and welcoming
    parts.push(`Welcome to Session ${lesson.lesson_number}... ${lesson.title}.`);
    parts.push(`This is part of ${topicLabel}.`);
    parts.push(`By the end of this session, you will be able to: ${lesson.objective}.`);
    parts.push('');

    // Hook — inviting, pause-inducing
    if (scripts[0]) {
      parts.push(`Before we dive in, I want you to think about something...`);
      parts.push('');
      parts.push(scripts[0].teacher_prompt);
      parts.push('');
      parts.push(`Take a moment... really think about this before we continue.`);
      parts.push('');
    }

    // Key Idea — slower, emphatic
    if (lesson.key_idea) {
      parts.push(`Now... here is the central idea for today's lesson.`);
      parts.push('');
      parts.push(lesson.key_idea);
      parts.push('');
      parts.push(`Let that sink in for a moment.`);
      parts.push('');
    }

    // Discovery — exploratory tone
    if (scripts[1]) {
      parts.push(`Alright, let's explore this further together.`);
      parts.push('');
      parts.push(scripts[1].teacher_prompt);
      parts.push('');
    }

    // Examples — conversational
    if (examples.length > 0) {
      parts.push(`Now I'd like to walk you through some real-world examples.`);
      parts.push('');
      examples.forEach((ex: string, i: number) => {
        parts.push(`Example ${i + 1}: ${ex}`);
        parts.push('');
      });
    }

    // Concept Build — formalizing
    if (scripts[2]) {
      parts.push(`Let's bring this all together now, and formalize what we've discovered.`);
      parts.push('');
      parts.push(scripts[2].teacher_prompt);
      parts.push('');
    }

    // Breakthrough — dramatic pause before
    if (lesson.conceptual_breakthrough) {
      parts.push(`And here is where it all comes together... the breakthrough moment.`);
      parts.push('');
      parts.push(lesson.conceptual_breakthrough);
      parts.push('');
      parts.push(`This is the key insight. Everything else builds on this.`);
      parts.push('');
    }

    // Application — energetic
    if (scripts[3]) {
      parts.push(`Now it's your turn. Let's put this knowledge into practice.`);
      parts.push('');
      parts.push(scripts[3].teacher_prompt);
      parts.push('');
    }

    // Exercises
    if (exercises.length > 0) {
      parts.push(`Here are some exercises to solidify your understanding.`);
      parts.push('');
      exercises.forEach((ex: string, i: number) => {
        parts.push(`Exercise ${i + 1}: ${ex}`);
        parts.push('');
      });
    }

    // Summary — calm, affirming
    parts.push(`Let's recap what we've covered today.`);
    parts.push('');
    parts.push(`The core concept was: ${lesson.key_idea || lesson.title}.`);
    if (lesson.conceptual_breakthrough) parts.push(`The key breakthrough: ${lesson.conceptual_breakthrough}.`);
    parts.push('');
    parts.push(`In our next session, we'll continue building on these ideas within ${topicLabel}.`);
    parts.push(`Great work today. See you next time.`);

    return { script: parts.join('\n'), lesson, gate };
  }

  async generateAudio(lessonId: string, voice: string = 'nova'): Promise<{ audioBuffer: Buffer; script: string; filename: string }> {
    const { script, lesson } = await this.buildNarrationScript(lessonId);

    // Use OpenAI TTS API
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Audio narration requires OPENAI_API_KEY.');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: script.slice(0, 4096), // TTS-1 max input is 4096 chars
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`TTS generation failed (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const filename = `Narration_Lesson_${lesson.lesson_number}_${lesson.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.mp3`;

    return { audioBuffer, script, filename };
  }
}
