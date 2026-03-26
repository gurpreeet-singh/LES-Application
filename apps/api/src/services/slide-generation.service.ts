import PptxGenJS from 'pptxgenjs';
import type { SupabaseClient } from '@supabase/supabase-js';

const BLOOM_DISPLAY: Record<string, string> = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};

function cleanText(text: string): string {
  return text
    .replace(/\bG(\d+)\b/g, 'Topic $1')
    .replace(/\bGate (\d+)/g, 'Topic $1')
    .replace(/\bBloom's\b(?!\s+Taxonomy)/g, "Bloom's Taxonomy");
}

export interface SlideData {
  type: 'title' | 'objective' | 'question' | 'concept' | 'example' | 'breakthrough' | 'activity' | 'summary' | 'context';
  title: string;
  subtitle?: string;
  icon: string;
  sectionLabel: string;
  bullets?: string[];
  numberedItems?: string[];
  speakerNotes: string;
  accentColor: string;
}

export class SlideGenerationService {
  constructor(private db: SupabaseClient) {}

  async generateSlides(lessonId: string): Promise<{ buffer: Buffer; filename: string; slideData: SlideData[] }> {
    const { data: lesson } = await this.db.from('lessons').select('*, socratic_scripts(*)').eq('id', lessonId).single();
    if (!lesson) throw new Error('Lesson not found');

    const { data: gate } = await this.db.from('gates').select('gate_number, title, short_title, color, sub_concepts(title)').eq('id', lesson.gate_id).single();
    const { data: course } = await this.db.from('courses').select('title, subject').eq('id', lesson.course_id).single();

    const ac = (gate?.color || '#1B3A6B').replace('#', '');
    const scripts = (lesson.socratic_scripts || []).sort((a: any, b: any) => a.stage_number - b.stage_number);
    const examples = (lesson.examples || []).map((e: any) => cleanText(typeof e === 'string' ? e : e.text || ''));
    const exercises = (lesson.exercises || []).map((e: any) => cleanText(typeof e === 'string' ? e : e.text || ''));
    const bloomsDisplay = (lesson.bloom_levels || []).map((b: string) => BLOOM_DISPLAY[b] || b).join(' → ');
    const topicLabel = `Topic ${gate?.gate_number || ''}: ${gate?.short_title || ''}`;

    const slides: SlideData[] = [];

    // 1. Title
    slides.push({ type: 'title', icon: '🎓', sectionLabel: course?.subject?.toUpperCase() || 'LESSON', title: lesson.title, subtitle: `${topicLabel}  |  Session ${lesson.lesson_number}  |  ${lesson.duration_minutes} min\nBloom's Taxonomy: ${bloomsDisplay}\n${course?.title || ''}`, speakerNotes: `Objective: ${lesson.objective}`, accentColor: ac });

    // 2. Learning Objective
    slides.push({ type: 'objective', icon: '🎯', sectionLabel: "TODAY'S LEARNING GOAL", title: "What You'll Learn Today", bullets: [cleanText(lesson.objective), `Bloom's Taxonomy Level: ${bloomsDisplay}`], speakerNotes: lesson.key_idea || 'Focus on the core learning objective.', accentColor: ac });

    // 3. Hook
    if (scripts[0]) {
      slides.push({ type: 'question', icon: '💡', sectionLabel: 'OPENING QUESTION', title: "Let's Start Thinking...", bullets: [cleanText(scripts[0].teacher_prompt)], subtitle: `${scripts[0].duration_minutes || 5} minutes — Think, then discuss`, speakerNotes: `Expected response: ${scripts[0].expected_response || ''}\n\nFollow-up: ${scripts[0].follow_up || ''}`, accentColor: ac });
    }

    // 4. Key Idea
    if (lesson.key_idea) {
      slides.push({ type: 'concept', icon: '💎', sectionLabel: 'KEY CONCEPT', title: 'The Core Idea', bullets: [cleanText(lesson.key_idea)], speakerNotes: cleanText(lesson.conceptual_breakthrough || ''), accentColor: ac });
    }

    // 5. Discovery
    if (scripts[1]) {
      slides.push({ type: 'question', icon: '🔍', sectionLabel: "LET'S EXPLORE", title: scripts[1].stage_title || 'Guided Discovery', bullets: [cleanText(scripts[1].teacher_prompt)], subtitle: `${scripts[1].duration_minutes || 15} minutes — Explore and discover`, speakerNotes: `Expected: ${scripts[1].expected_response || ''}\n\nFollow-up: ${scripts[1].follow_up || ''}`, accentColor: ac });
    }

    // 6. Concept Build
    if (scripts[2]) {
      slides.push({ type: 'concept', icon: '🧱', sectionLabel: 'BUILDING THE CONCEPT', title: scripts[2].stage_title || 'Formalizing Our Understanding', bullets: [cleanText(scripts[2].teacher_prompt)], subtitle: `${scripts[2].duration_minutes || 12} minutes`, speakerNotes: `Expected articulation: ${scripts[2].expected_response || ''}`, accentColor: ac });
    }

    // 7. Examples (as numbered steps)
    if (examples.length > 0) {
      slides.push({ type: 'example', icon: '📐', sectionLabel: 'WORKED EXAMPLES', title: 'Real-World Applications', numberedItems: examples, speakerNotes: 'Walk through each example. Ask students to identify the pattern.', accentColor: ac });
    }

    // 8. Breakthrough
    if (lesson.conceptual_breakthrough) {
      slides.push({ type: 'breakthrough', icon: '⚡', sectionLabel: 'THE BIG IDEA', title: 'The Breakthrough Moment', bullets: [cleanText(lesson.conceptual_breakthrough)], speakerNotes: 'This is the "aha" moment. Pause. Let students internalize this.', accentColor: ac });
    }

    // 9. Application
    if (scripts[3]) {
      slides.push({ type: 'activity', icon: '🛠️', sectionLabel: 'APPLY IT', title: scripts[3].stage_title || 'Put It Into Practice', bullets: [cleanText(scripts[3].teacher_prompt)], subtitle: `${scripts[3].duration_minutes || 8} minutes — Work individually or in pairs`, speakerNotes: `Expected: ${scripts[3].expected_response || ''}`, accentColor: ac });
    }

    // 10. Practice Exercises
    if (exercises.length > 0) {
      slides.push({ type: 'activity', icon: '✏️', sectionLabel: 'PRACTICE TIME', title: 'Your Turn — Practice Exercises', numberedItems: exercises, speakerNotes: 'Give 5-10 minutes. Walk around and support struggling students.', accentColor: ac });
    }

    // 11. Summary
    slides.push({ type: 'summary', icon: '📋', sectionLabel: 'RECAP', title: 'Key Takeaways', bullets: [cleanText(lesson.key_idea || lesson.objective), cleanText(lesson.conceptual_breakthrough || ''), `Next: continue with ${topicLabel}`].filter(Boolean), speakerNotes: 'Ask 1-2 students to summarize in their own words.', accentColor: ac });

    // 12. Topic Context
    const subs = (gate?.sub_concepts || []).map((sc: any) => sc.title);
    if (subs.length > 0) {
      slides.push({ type: 'context', icon: '🗺️', sectionLabel: 'WHERE THIS FITS', title: topicLabel, bullets: [`Key Sub-Topics: ${subs.join(', ')}`, `This session covers essential aspects of ${gate?.short_title || 'this module'}`], speakerNotes: 'Show students where this lesson fits in the learning journey.', accentColor: ac });
    }

    // ─── RENDER PPTX ──────────────────────────────────
    const pptx = new PptxGenJS();
    pptx.author = 'LEAP Platform';
    pptx.title = `${lesson.title} — Teaching Slides`;
    pptx.subject = course?.subject || '';
    pptx.layout = 'LAYOUT_16x9';

    const slideH = 5.63;

    for (let si = 0; si < slides.length; si++) {
      const sd = slides[si];
      const s = pptx.addSlide();
      const bullets = sd.bullets || [];
      const numbered = sd.numberedItems || [];

      if (sd.type === 'title') {
        // Full-bleed accent background with decorative shapes
        s.background = { color: ac };
        s.addShape(pptx.ShapeType.ellipse, { x: 7.0, y: -1.0, w: 4.5, h: 4.5, fill: { color: 'FFFFFF' }, shadow: { type: 'none' } } as any);
        s.addShape(pptx.ShapeType.ellipse, { x: -1.0, y: 3.5, w: 3.0, h: 3.0, fill: { color: 'FFFFFF' } } as any);
        s.addText(sd.icon, { x: 0.6, y: 0.3, w: 1, h: 0.6, fontSize: 28 });
        s.addText(sd.sectionLabel, { x: 1.4, y: 0.35, w: 4, h: 0.4, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        s.addText(sd.title, { x: 0.8, y: 1.4, w: 7.5, h: 1.4, fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        s.addText(sd.subtitle || '', { x: 0.8, y: 3.0, w: 7.5, h: 1.4, fontSize: 13, color: 'DDDDDD', fontFace: 'Arial' });

      } else if (sd.type === 'question') {
        s.background = { color: 'F5F3FF' };
        // Left accent bar
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: slideH, fill: { color: ac } });
        // Section label
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.25, w: 5, h: 0.35, fontSize: 9, bold: true, color: ac, fontFace: 'Arial' });
        s.addShape(pptx.ShapeType.line, { x: 0.6, y: 0.6, w: 2.5, h: 0, line: { color: ac, width: 1 } });
        // Title
        s.addText(sd.title, { x: 0.6, y: 0.8, w: 8.8, h: 0.5, fontSize: 18, bold: true, color: '1F2937', fontFace: 'Arial' });
        // Question in large italic with a card background
        s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.6, w: 8.8, h: 2.2, fill: { color: 'FFFFFF' }, rectRadius: 0.15, line: { color: 'E9D5FF', width: 1 } });
        s.addText(`"${bullets[0] || ''}"`, { x: 0.9, y: 1.7, w: 8.2, h: 2.0, fontSize: 19, italic: true, color: '4C1D95', fontFace: 'Arial', valign: 'middle' });
        // Subtitle hint
        if (sd.subtitle) s.addText(sd.subtitle, { x: 0.6, y: 4.0, w: 8.8, h: 0.4, fontSize: 11, color: '9CA3AF', fontFace: 'Arial' });
        // Footer
        s.addText(`LEAP  ·  Session ${lesson.lesson_number}`, { x: 0.6, y: 5.2, w: 5, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial' });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial', align: 'right' });

      } else if (sd.type === 'example') {
        s.background = { color: 'FFFFFF' };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: slideH, fill: { color: '16A34A' } });
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.25, w: 5, h: 0.35, fontSize: 9, bold: true, color: '16A34A', fontFace: 'Arial' });
        s.addShape(pptx.ShapeType.line, { x: 0.6, y: 0.6, w: 2.5, h: 0, line: { color: '16A34A', width: 1 } });
        s.addText(sd.title, { x: 0.6, y: 0.8, w: 8.8, h: 0.5, fontSize: 18, bold: true, color: '1F2937', fontFace: 'Arial' });
        // Numbered step cards
        numbered.forEach((item, i) => {
          const y = 1.5 + i * 0.9;
          s.addShape(pptx.ShapeType.ellipse, { x: 0.65, y: y + 0.08, w: 0.45, h: 0.45, fill: { color: '16A34A' } });
          s.addText(`${i + 1}`, { x: 0.65, y: y + 0.08, w: 0.45, h: 0.45, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
          s.addShape(pptx.ShapeType.roundRect, { x: 1.3, y: y, w: 8.1, h: 0.6, fill: { color: 'F0FFF4' }, rectRadius: 0.08, line: { color: 'C6F6D5', width: 0.5 } });
          s.addText(item, { x: 1.45, y: y, w: 7.8, h: 0.6, fontSize: 13, color: '2D3748', fontFace: 'Arial', valign: 'middle' });
        });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial', align: 'right' });

      } else if (sd.type === 'breakthrough') {
        s.background = { color: ac };
        s.addShape(pptx.ShapeType.ellipse, { x: 6.5, y: -1.5, w: 5, h: 5, fill: { color: 'FFFFFF' } } as any);
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.3, w: 5, h: 0.35, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        s.addText(sd.title, { x: 0.8, y: 1.2, w: 8, h: 0.5, fontSize: 16, bold: true, color: 'EEEEEE', fontFace: 'Arial' });
        // Large quote
        s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 2.0, w: 8.8, h: 2.0, fill: { color: 'FFFFFF' }, rectRadius: 0.15 } as any);
        s.addText(`"${bullets[0] || ''}"`, { x: 0.9, y: 2.1, w: 8.2, h: 1.8, fontSize: 18, italic: true, color: '1F2937', fontFace: 'Arial', valign: 'middle' });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'DDDDDD', fontFace: 'Arial', align: 'right' });

      } else if (sd.type === 'activity') {
        s.background = { color: 'FFFBEB' };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: slideH, fill: { color: 'F59E0B' } });
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.25, w: 5, h: 0.35, fontSize: 9, bold: true, color: 'B45309', fontFace: 'Arial' });
        s.addShape(pptx.ShapeType.line, { x: 0.6, y: 0.6, w: 2.5, h: 0, line: { color: 'F59E0B', width: 1 } });
        s.addText(sd.title, { x: 0.6, y: 0.8, w: 8.8, h: 0.5, fontSize: 18, bold: true, color: '92400E', fontFace: 'Arial' });
        if (sd.subtitle) s.addText(sd.subtitle, { x: 0.6, y: 1.25, w: 8.8, h: 0.3, fontSize: 10, color: 'B45309', fontFace: 'Arial' });
        const items = numbered.length > 0 ? numbered : bullets;
        items.forEach((item, i) => {
          const y = 1.7 + i * 0.85;
          s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 8.8, h: 0.65, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: 'FDE68A', width: 0.5 } });
          s.addText(`${numbered.length > 0 ? (i + 1) + '.' : '•'}  ${item}`, { x: 0.8, y, w: 8.4, h: 0.65, fontSize: 13, color: '374151', fontFace: 'Arial', valign: 'middle' });
        });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial', align: 'right' });

      } else if (sd.type === 'summary') {
        s.background = { color: ac };
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.3, w: 5, h: 0.35, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        s.addText(sd.title, { x: 0.8, y: 0.8, w: 8, h: 0.5, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        bullets.forEach((b, i) => {
          const y = 1.6 + i * 0.9;
          s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 8.8, h: 0.7, fill: { color: 'FFFFFF' }, rectRadius: 0.1 } as any);
          s.addText(`✓  ${b}`, { x: 0.8, y, w: 8.4, h: 0.7, fontSize: 14, bold: true, color: '1F2937', fontFace: 'Arial', valign: 'middle' });
        });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'DDDDDD', fontFace: 'Arial', align: 'right' });

      } else {
        // objective, concept, context — standard content with cards
        s.background = { color: 'FFFFFF' };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: slideH, fill: { color: ac } });
        s.addText(`${sd.icon}  ${sd.sectionLabel}`, { x: 0.6, y: 0.25, w: 5, h: 0.35, fontSize: 9, bold: true, color: ac, fontFace: 'Arial' });
        s.addShape(pptx.ShapeType.line, { x: 0.6, y: 0.6, w: 2.5, h: 0, line: { color: ac, width: 1 } });
        s.addText(sd.title, { x: 0.6, y: 0.8, w: 8.8, h: 0.5, fontSize: 18, bold: true, color: '1F2937', fontFace: 'Arial' });
        bullets.forEach((b, i) => {
          const y = 1.5 + i * 0.9;
          s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 8.8, h: 0.7, fill: { color: 'F8FAFC' }, rectRadius: 0.1, line: { color: 'E2E8F0', width: 0.5 } });
          s.addText(`  ${b}`, { x: 0.75, y, w: 8.5, h: 0.7, fontSize: 14, color: '374151', fontFace: 'Arial', valign: 'middle' });
        });
        s.addText(`LEAP  ·  Session ${lesson.lesson_number}`, { x: 0.6, y: 5.2, w: 5, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial' });
        s.addText(`${si + 1} / ${slides.length}`, { x: 8.5, y: 5.2, w: 1.2, h: 0.3, fontSize: 8, color: 'BBBBBB', fontFace: 'Arial', align: 'right' });
      }

      if (sd.speakerNotes) s.addNotes(sd.speakerNotes);
    }

    const data = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const filename = `Lesson_${lesson.lesson_number}_${lesson.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.pptx`;
    return { buffer: data, filename, slideData: slides };
  }
}
