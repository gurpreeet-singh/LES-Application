/**
 * LEAP V2 Slide Renderer
 * Renders rich, LLM-generated slide content (from lessons.slide_content JSONB)
 * into PowerPoint presentations using pptxgenjs.
 *
 * Called by SlideGenerationService when slide_content is present.
 * Falls through to V1 deterministic rendering when slide_content is NULL.
 */
import PptxGenJS from 'pptxgenjs';
import type { SlideData } from './slide-generation.service.js';

// ─── Types ────────────────────────────────────────────────────────
interface V2Theme {
  background: string;
  primary_color: string;
  accent_color: string;
  text_color: string;
}

interface V2Card {
  label: string;
  content: string;
  sub_content?: string;
  emoji_icon?: string;
  color?: string;
  highlight?: boolean;
}

interface V2Slide {
  slide_number: number;
  type: string;
  bloom_level: string | null;
  section_label: string;
  title: string;
  subtitle?: string;
  layout: string;
  theme: V2Theme;
  content?: {
    heading?: string;
    body_text?: string;
    bullets?: string[];
    cards?: V2Card[];
  };
  table?: { headers: string[]; rows: string[][]; header_color?: string; alternate_row_colors?: boolean } | null;
  comparison?: { item_a: any; item_b: any; similarities: string[]; differences_a: string[]; differences_b: string[] } | null;
  buckets?: { categories: Array<{ label: string; color: string; items: string[] }> } | null;
  myths?: Array<{ myth: string; truth: string; visual_demo?: string }> | null;
  verses?: Array<{ lines: string[]; color?: string; related_visual?: string }> | null;
  chorus_cue?: string | null;
  quiz_items?: Array<{ question: string; answer: string; type?: string }> | null;
  visual_elements?: Array<{ type: string; description: string; position: string; color: string; size: string }>;
  engagement_cue?: string;
  speaker_notes?: string;
}

interface V2SlideContent {
  presentation_title: string;
  class_level?: string;
  subject?: string;
  total_slides?: number;
  color_palette?: { primary: string; secondary?: string; accent: string; dark_bg: string; light_bg: string };
  slides: V2Slide[];
}

// ─── Helpers ──────────────────────────────────────────────────────
function stripHash(hex: string): string {
  return (hex || '1B3A6B').replace('#', '');
}

function isDark(bg: string): boolean {
  return bg?.includes('dark') || false;
}

// ─── Convert V2 slides to V1 SlideData for frontend preview ─────
export function convertV2ToPreview(slideContent: V2SlideContent, accentColor: string): SlideData[] {
  const slides: SlideData[] = [];
  const ac = stripHash(accentColor);

  for (const sd of slideContent.slides) {
    const content = sd.content || {};
    const bullets = content.bullets || [];
    const cards = content.cards || [];

    // Map V2 type to extended V1 type (frontend will handle new types)
    const preview: SlideData = {
      type: sd.type as any,
      title: sd.title,
      subtitle: sd.subtitle,
      icon: cards[0]?.emoji_icon || getIconForType(sd.type),
      sectionLabel: sd.section_label || '',
      bullets: bullets.length > 0 ? bullets : cards.map(c => `${c.emoji_icon || ''} ${c.label}: ${c.content}`).filter(Boolean),
      speakerNotes: sd.speaker_notes || '',
      accentColor: stripHash(sd.theme?.primary_color || accentColor),
      // V2 extensions (frontend will use these if present)
      ...(sd.table && { table: sd.table }),
      ...(sd.comparison && { comparison: sd.comparison }),
      ...(sd.buckets && { buckets: sd.buckets }),
      ...(sd.myths && { myths: sd.myths }),
      ...(sd.verses && { verses: sd.verses }),
      ...(sd.chorus_cue && { chorusCue: sd.chorus_cue }),
      ...(sd.quiz_items && { quizItems: sd.quiz_items }),
      ...(sd.engagement_cue && { engagementCue: sd.engagement_cue }),
      ...(sd.theme && { theme: sd.theme }),
      ...(content.cards && { cards: content.cards }),
      ...(content.body_text && { bodyText: content.body_text }),
      ...(sd.bloom_level && { bloomLevel: sd.bloom_level }),
    } as any;

    slides.push(preview);
  }
  return slides;
}

function getIconForType(type: string): string {
  const icons: Record<string, string> = {
    title: '🎓', hook_riddle: '🧩', hook_story: '📖', learning_roadmap: '🗺️',
    concept_intro: '💎', detail_cards: '🃏', song_rhyme: '🎵', properties_table: '📊',
    step_by_step: '📝', vocabulary: '📚', real_world: '🌍', spot_game: '🔍',
    clue_quiz: '❓', comparison: '⚖️', sort_classify: '📂', odd_one_out: '🎯',
    pattern_find: '🔢', myth_buster: '💥', true_false_challenge: '✅', which_is_better: '🏆',
    create_activity: '✏️', design_challenge: '🛠️', quick_quiz: '⚡', summary: '📋',
  };
  return icons[type] || '📌';
}

// ─── V2 PPTX Renderer ──────────────────────────────────────────
export function renderV2Pptx(slideContent: V2SlideContent, lessonTitle: string, courseSubject: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = 'LEAP Platform';
  pptx.title = `${lessonTitle} — Teaching Slides`;
  pptx.subject = courseSubject;
  pptx.layout = 'LAYOUT_16x9';

  const palette = slideContent.color_palette || { primary: '#1B3A6B', accent: '#FFD600', dark_bg: '#1B1B2F', light_bg: '#F8F9FA' };
  const SLIDE_H = 5.63;

  for (let si = 0; si < slideContent.slides.length; si++) {
    const sd = slideContent.slides[si];
    const s = pptx.addSlide();
    const theme = sd.theme || { background: 'white', primary_color: palette.primary, accent_color: palette.accent, text_color: '#1F2937' };
    const pc = stripHash(theme.primary_color);
    const ac = stripHash(theme.accent_color);
    const dark = isDark(theme.background);
    const content = sd.content || {};
    const bullets = content.bullets || [];
    const cards = content.cards || [];
    const total = slideContent.slides.length;

    // ── Background ─────────────────────────────────────────
    if (dark) {
      s.background = { color: pc };
    } else if (theme.background === 'pastel_warm') {
      s.background = { color: 'FFF8F0' };
    } else if (theme.background === 'pastel_cool') {
      s.background = { color: 'F0F4FF' };
    } else if (theme.background === 'light_tinted') {
      s.background = { color: 'F5F3FF' };
    } else {
      s.background = { color: 'FFFFFF' };
    }

    const headColor = dark ? 'FFFFFF' : '1F2937';
    const bodyColor = dark ? 'EEEEEE' : '374151';
    const labelColor = dark ? 'FFFFFF' : pc;

    // ── Decorative shapes for dark slides ──────────────────
    if (dark) {
      s.addShape(pptx.ShapeType.ellipse, { x: 7.0, y: -1.0, w: 4.5, h: 4.5, fill: { color: ac } } as any);
      s.addShape(pptx.ShapeType.ellipse, { x: -1.0, y: 3.5, w: 3.0, h: 3.0, fill: { color: ac } } as any);
    }

    // ── Left accent bar for light slides ───────────────────
    if (!dark && sd.layout !== 'full_bleed_hero' && sd.layout !== 'song_layout') {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.2, h: SLIDE_H, fill: { color: pc } });
    }

    // ── Section label ──────────────────────────────────────
    if (sd.section_label) {
      const bloomTag = sd.bloom_level ? `  [${sd.bloom_level.toUpperCase()}]` : '';
      s.addText(`${getIconForType(sd.type)}  ${sd.section_label}${bloomTag}`, { x: 0.5, y: 0.15, w: 5, h: 0.3, fontSize: 8, bold: true, color: labelColor, fontFace: 'Arial' });
    }

    // ── Slide number ───────────────────────────────────────
    s.addText(`${sd.slide_number} / ${total}`, { x: 8.5, y: 0.15, w: 1.2, h: 0.3, fontSize: 7, color: dark ? 'DDDDDD' : 'AAAAAA', fontFace: 'Arial', align: 'right' });

    // ════════════════════════════════════════════════════════
    // RENDER BY TYPE
    // ════════════════════════════════════════════════════════

    if (sd.type === 'title') {
      s.addText(sd.title, { x: 0.6, y: 1.2, w: 8, h: 1.4, fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Trebuchet MS' });
      if (sd.subtitle) s.addText(sd.subtitle, { x: 0.6, y: 2.8, w: 8, h: 0.8, fontSize: 14, color: 'DDDDDD', fontFace: 'Arial' });

    } else if (sd.type === 'hook_riddle' || sd.type === 'hook_story') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const body = content.body_text || bullets.join('\n');
      if (body) {
        s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.2, w: 9, h: 2.2, fill: { color: 'FFFFFF' }, rectRadius: 0.12, line: { color: stripHash(theme.accent_color), width: 2 } });
        s.addText(`"${body}"`, { x: 0.8, y: 1.3, w: 8.4, h: 2.0, fontSize: 17, italic: true, color: '4C1D95', fontFace: 'Georgia', valign: 'middle' });
      }
      // Riddle answer cards
      cards.slice(0, 3).forEach((cd, ci) => {
        const y = 3.7;
        const x = 0.5 + ci * 3.2;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.9, h: 1.3, fill: { color: stripHash(cd.color || pc) }, rectRadius: 0.1 });
        s.addText(`${cd.emoji_icon || ''} ${cd.content || ''}`, { x: x + 0.15, y: y + 0.1, w: 2.6, h: 0.5, fontSize: 11, color: 'FFFFFF', bold: true, fontFace: 'Arial' });
        if (cd.sub_content) {
          s.addShape(pptx.ShapeType.roundRect, { x: x + 0.3, y: y + 0.7, w: 2.3, h: 0.35, fill: { color: 'FFFFFF' }, rectRadius: 0.06 });
          s.addText(cd.sub_content, { x: x + 0.4, y: y + 0.7, w: 2.1, h: 0.35, fontSize: 10, bold: true, color: stripHash(cd.color || pc), fontFace: 'Arial', align: 'center', valign: 'middle' });
        }
      });

    } else if (sd.type === 'learning_roadmap') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      cards.slice(0, 6).forEach((cd, ci) => {
        const row = Math.floor(ci / 3);
        const col = ci % 3;
        const cw = 2.8;
        const x = 0.5 + col * (cw + 0.25);
        const y = 1.3 + row * 2.2;
        // Number circle
        s.addShape(pptx.ShapeType.ellipse, { x: x + cw / 2 - 0.22, y: y, w: 0.44, h: 0.44, fill: { color: stripHash(cd.color || pc) } });
        s.addText(`${ci + 1}`, { x: x + cw / 2 - 0.22, y: y, w: 0.44, h: 0.44, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
        // Card
        s.addShape(pptx.ShapeType.roundRect, { x, y: y + 0.55, w: cw, h: 1.3, fill: { color: 'F8FAFC' }, rectRadius: 0.08, line: { color: 'E2E8F0', width: 0.5 } });
        s.addShape(pptx.ShapeType.rect, { x, y: y + 0.55, w: cw, h: 0.06, fill: { color: stripHash(cd.color || pc) } });
        s.addText(`${cd.emoji_icon || ''} ${cd.label || ''}`, { x: x + 0.1, y: y + 0.7, w: cw - 0.2, h: 0.35, fontSize: 10, bold: true, color: '1F2937', fontFace: 'Arial' });
        s.addText(cd.content || '', { x: x + 0.1, y: y + 1.05, w: cw - 0.2, h: 0.6, fontSize: 9, color: '6B7280', fontFace: 'Arial' });
      });

    } else if (sd.type === 'detail_cards') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const cols = Math.min(cards.length, 3);
      const cw = Math.min(3.0, 9 / Math.max(cols, 1));
      cards.slice(0, 6).forEach((cd, ci) => {
        const row = Math.floor(ci / cols);
        const col = ci % cols;
        const x = 0.5 + col * (cw + 0.15);
        const y = 1.2 + row * 2.2;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: 1.9, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: stripHash(cd.color || 'E2E8F0'), width: 1 } });
        s.addShape(pptx.ShapeType.rect, { x, y, w: cw, h: 0.07, fill: { color: stripHash(cd.color || pc) } });
        s.addText(cd.emoji_icon || '', { x: x + 0.1, y: y + 0.15, w: 0.5, h: 0.4, fontSize: 22 });
        s.addText(cd.label || '', { x: x + 0.6, y: y + 0.18, w: cw - 0.8, h: 0.3, fontSize: 12, bold: true, color: stripHash(cd.color || '1F2937'), fontFace: 'Arial' });
        s.addText(cd.content || '', { x: x + 0.1, y: y + 0.55, w: cw - 0.2, h: 0.5, fontSize: 10, color: '374151', fontFace: 'Arial' });
        if (cd.sub_content) {
          s.addText(cd.sub_content, { x: x + 0.1, y: y + 1.1, w: cw - 0.2, h: 0.6, fontSize: 9, italic: true, color: '6B7280', fontFace: 'Arial' });
        }
      });

    } else if (sd.type === 'song_rhyme') {
      s.addText(`♪ ♫  ${sd.title}  ♫ ♪`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS', align: 'center' });
      const verses = sd.verses || [];
      let y = 1.0;
      verses.forEach((verse) => {
        const lines = verse.lines || [];
        const vc = stripHash(verse.color || pc);
        const ch = 0.35 + lines.length * 0.3;
        s.addShape(pptx.ShapeType.roundRect, { x: 1.0, y, w: 7.8, h: ch, fill: { color: dark ? '333344' : 'FFFFFF' }, rectRadius: 0.08, line: { color: vc, width: 1.5 } });
        s.addShape(pptx.ShapeType.rect, { x: 1.0, y, w: 0.08, h: ch, fill: { color: vc } });
        s.addText('♪', { x: 1.15, y: y + 0.05, w: 0.3, h: 0.25, fontSize: 12, color: vc });
        s.addText(lines.join('\n'), { x: 1.5, y: y + 0.1, w: 7.0, h: ch - 0.2, fontSize: 13, italic: true, color: vc, fontFace: 'Georgia' });
        y += ch + 0.15;
      });
      if (sd.chorus_cue) {
        s.addShape(pptx.ShapeType.ellipse, { x: 2.5, y: y + 0.1, w: 5, h: 0.5, fill: { color: ac } });
        s.addText(sd.chorus_cue, { x: 2.5, y: y + 0.1, w: 5, h: 0.5, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
      }

    } else if (sd.type === 'properties_table') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const tbl = sd.table;
      if (tbl && tbl.headers && tbl.rows) {
        const nRows = tbl.rows.length + 1;
        const nCols = tbl.headers.length;
        const tblShape = s.addTable(
          [
            tbl.headers.map(h => ({ text: h, options: { fontSize: 11, bold: true, color: 'FFFFFF', fill: { color: stripHash(tbl.header_color || pc) }, fontFace: 'Arial' } })),
            ...tbl.rows.map((row, ri) =>
              row.map(cell => ({
                text: String(cell),
                options: {
                  fontSize: 10, color: '374151', fontFace: 'Arial',
                  ...(tbl.alternate_row_colors && ri % 2 === 1 ? { fill: { color: 'F3F4F6' } } : {}),
                },
              })),
            ),
          ],
          { x: 0.5, y: 1.2, w: 9, colW: Array(nCols).fill(9 / nCols), border: { type: 'solid', pt: 0.5, color: 'E2E8F0' } },
        );
      }

    } else if (sd.type === 'real_world') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const cols = Math.min(cards.length, 4);
      const cw = Math.min(2.2, 9 / Math.max(cols, 1));
      cards.slice(0, 4).forEach((cd, ci) => {
        const x = 0.5 + ci * (cw + 0.15);
        s.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: cw, h: 4.0, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: stripHash(cd.color || 'E2E8F0'), width: 1 } });
        s.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: cw, h: 0.06, fill: { color: stripHash(cd.color || pc) } });
        s.addText(cd.emoji_icon || '', { x: x + cw / 2 - 0.35, y: 1.5, w: 0.7, h: 0.6, fontSize: 36, align: 'center' });
        s.addText(cd.label || '', { x: x + 0.1, y: 2.3, w: cw - 0.2, h: 0.3, fontSize: 13, bold: true, color: stripHash(cd.color || '1F2937'), fontFace: 'Arial', align: 'center' });
        s.addText(cd.content || '', { x: x + 0.1, y: 2.7, w: cw - 0.2, h: 2.0, fontSize: 10, color: '374151', fontFace: 'Arial', align: 'center' });
      });

    } else if (sd.type === 'comparison') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const comp = sd.comparison;
      if (comp) {
        const ia = comp.item_a || {};
        const ib = comp.item_b || {};
        // Left card
        s.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.1, w: 4.0, h: 4.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: stripHash(ia.color || '2E86DE'), width: 2 } });
        s.addText(`${ia.emoji || ''} ${ia.label || ''}`, { x: 0.6, y: 1.2, w: 3.6, h: 0.4, fontSize: 16, bold: true, color: stripHash(ia.color || '2E86DE'), fontFace: 'Arial', align: 'center' });
        // Right card
        s.addShape(pptx.ShapeType.roundRect, { x: 5.4, y: 1.1, w: 4.0, h: 4.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: stripHash(ib.color || '8E44AD'), width: 2 } });
        s.addText(`${ib.emoji || ''} ${ib.label || ''}`, { x: 5.6, y: 1.2, w: 3.6, h: 0.4, fontSize: 16, bold: true, color: stripHash(ib.color || '8E44AD'), fontFace: 'Arial', align: 'center' });
        // VS badge
        s.addShape(pptx.ShapeType.ellipse, { x: 4.2, y: 2.5, w: 1.0, h: 0.7, fill: { color: ac } });
        s.addText('VS', { x: 4.2, y: 2.5, w: 1.0, h: 0.7, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
        // Similarities
        const sims = comp.similarities || [];
        s.addText('SAME:', { x: 0.6, y: 1.8, w: 3.6, h: 0.25, fontSize: 9, bold: true, color: '16A34A', fontFace: 'Arial' });
        sims.slice(0, 3).forEach((sim: string, si2: number) => {
          s.addText(`✓ ${sim}`, { x: 0.6, y: 2.1 + si2 * 0.3, w: 3.6, h: 0.25, fontSize: 10, color: '374151', fontFace: 'Arial' });
        });
        s.addText('SAME:', { x: 5.6, y: 1.8, w: 3.6, h: 0.25, fontSize: 9, bold: true, color: '16A34A', fontFace: 'Arial' });
        sims.slice(0, 3).forEach((sim: string, si2: number) => {
          s.addText(`✓ ${sim}`, { x: 5.6, y: 2.1 + si2 * 0.3, w: 3.6, h: 0.25, fontSize: 10, color: '374151', fontFace: 'Arial' });
        });
        // Differences
        const dy = 2.1 + sims.length * 0.3 + 0.2;
        s.addText('DIFFERENT:', { x: 0.6, y: dy, w: 3.6, h: 0.25, fontSize: 9, bold: true, color: 'DC2626', fontFace: 'Arial' });
        (comp.differences_a || []).slice(0, 3).forEach((d: string, di: number) => {
          s.addText(`• ${d}`, { x: 0.6, y: dy + 0.3 + di * 0.3, w: 3.6, h: 0.25, fontSize: 10, color: '374151', fontFace: 'Arial' });
        });
        s.addText('DIFFERENT:', { x: 5.6, y: dy, w: 3.6, h: 0.25, fontSize: 9, bold: true, color: 'DC2626', fontFace: 'Arial' });
        (comp.differences_b || []).slice(0, 3).forEach((d: string, di: number) => {
          s.addText(`• ${d}`, { x: 5.6, y: dy + 0.3 + di * 0.3, w: 3.6, h: 0.25, fontSize: 10, color: '374151', fontFace: 'Arial' });
        });
      }

    } else if (sd.type === 'sort_classify') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const cats = sd.buckets?.categories || [];
      const nCats = cats.length;
      const bw = Math.min(4.2, 9 / Math.max(nCats, 1));
      cats.slice(0, 3).forEach((cat, bi) => {
        const x = 0.5 + bi * (bw + 0.2);
        // Bucket header
        s.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: bw, h: 0.5, fill: { color: stripHash(cat.color || pc) }, rectRadius: 0.06 });
        s.addText(cat.label, { x: x + 0.1, y: 1.1, w: bw - 0.2, h: 0.5, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
        // Items
        (cat.items || []).slice(0, 6).forEach((item, ii) => {
          const iy = 1.75 + ii * 0.5;
          s.addShape(pptx.ShapeType.roundRect, { x: x + 0.15, y: iy, w: bw - 0.3, h: 0.4, fill: { color: 'FFFFFF' }, rectRadius: 0.06, line: { color: stripHash(cat.color || 'E2E8F0'), width: 0.5 } });
          s.addText(`• ${item}`, { x: x + 0.3, y: iy, w: bw - 0.6, h: 0.4, fontSize: 11, color: '374151', fontFace: 'Arial', valign: 'middle' });
        });
      });

    } else if (sd.type === 'myth_buster') {
      s.addText('Wait... Is That True? 🤔', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const myths = sd.myths || [];
      myths.slice(0, 2).forEach((myth, mi) => {
        const y = 1.0 + mi * 2.3;
        // Myth (red)
        s.addShape(pptx.ShapeType.roundRect, { x: 0.4, y, w: 4.3, h: 2.0, fill: { color: 'FEF2F2' }, rectRadius: 0.1, line: { color: 'DC2626', width: 1.5 } });
        s.addText('✗', { x: 0.55, y: y + 0.05, w: 0.35, h: 0.35, fontSize: 22, bold: true, color: 'DC2626' });
        s.addText(`"${myth.myth}"`, { x: 0.95, y: y + 0.1, w: 3.5, h: 0.7, fontSize: 11, italic: true, color: '991B1B', fontFace: 'Arial' });
        // Truth (green)
        s.addShape(pptx.ShapeType.roundRect, { x: 5.0, y, w: 4.5, h: 2.0, fill: { color: 'F0FFF4' }, rectRadius: 0.1, line: { color: '16A34A', width: 1.5 } });
        s.addText('✓', { x: 5.15, y: y + 0.05, w: 0.35, h: 0.35, fontSize: 22, bold: true, color: '16A34A' });
        s.addText(myth.truth, { x: 5.55, y: y + 0.1, w: 3.7, h: 1.2, fontSize: 11, color: '166534', fontFace: 'Arial' });
        if (myth.visual_demo) {
          s.addText(`👁 ${myth.visual_demo}`, { x: 5.15, y: y + 1.4, w: 4.0, h: 0.4, fontSize: 9, italic: true, color: '6B7280', fontFace: 'Arial' });
        }
      });

    } else if (sd.type === 'quick_quiz') {
      s.addText(sd.title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const quiz = sd.quiz_items || [];
      quiz.slice(0, 5).forEach((q, qi) => {
        const y = 1.0 + qi * 0.85;
        s.addShape(pptx.ShapeType.roundRect, { x: 0.4, y, w: 6.5, h: 0.65, fill: { color: qi % 2 === 0 ? 'F8FAFC' : 'FFFFFF' }, rectRadius: 0.06, line: { color: 'E2E8F0', width: 0.5 } });
        // Number circle
        s.addShape(pptx.ShapeType.ellipse, { x: 0.55, y: y + 0.1, w: 0.42, h: 0.42, fill: { color: pc } });
        s.addText(`${qi + 1}`, { x: 0.55, y: y + 0.1, w: 0.42, h: 0.42, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
        s.addText(q.question, { x: 1.1, y: y + 0.1, w: 5.5, h: 0.45, fontSize: 11, color: '1F2937', fontFace: 'Arial', valign: 'middle' });
        // Answer pill
        s.addShape(pptx.ShapeType.roundRect, { x: 7.1, y: y + 0.1, w: 2.5, h: 0.42, fill: { color: ac }, rectRadius: 0.06 });
        s.addText(q.answer, { x: 7.1, y: y + 0.1, w: 2.5, h: 0.42, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: 'Arial', align: 'center', valign: 'middle' });
      });

    } else if (sd.type === 'summary') {
      s.addText(sd.title, { x: 0.6, y: 0.6, w: 8, h: 0.6, fontSize: 24, bold: true, color: 'FFFFFF', fontFace: 'Trebuchet MS' });
      bullets.slice(0, 5).forEach((b, bi) => {
        const y = 1.5 + bi * 0.75;
        s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y, w: 9, h: 0.55, fill: { color: 'FFFFFF' }, rectRadius: 0.08 } as any);
        s.addText(`✓  ${b}`, { x: 0.7, y, w: 8.6, h: 0.55, fontSize: 12, bold: true, color: '1F2937', fontFace: 'Arial', valign: 'middle' });
      });

    } else if (sd.type === 'create_activity') {
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      cards.slice(0, 3).forEach((cd, ci) => {
        const x = 0.5 + ci * 3.1;
        s.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 2.9, h: 4.0, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: stripHash(cd.color || pc), width: 1.5 } });
        // Header
        s.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 2.9, h: 0.45, fill: { color: stripHash(cd.color || pc) } });
        s.addText(`${cd.emoji_icon || ''} ${cd.label || ''}`, { x: x + 0.1, y: 1.22, w: 2.7, h: 0.4, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
        s.addText(cd.content || '', { x: x + 0.1, y: 1.8, w: 2.7, h: 3.0, fontSize: 10, color: '374151', fontFace: 'Arial' });
      });

    } else {
      // Fallback: concept_intro, vocabulary, step_by_step, spot_game, clue_quiz, true_false_challenge, etc.
      s.addText(sd.title, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 22, bold: true, color: headColor, fontFace: 'Trebuchet MS' });
      const body = content.body_text;
      if (body) {
        s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.1, w: 9, h: 1.5, fill: { color: 'F0F9FF' }, rectRadius: 0.1, line: { color: pc, width: 1.5 } });
        s.addText(body, { x: 0.7, y: 1.2, w: 8.6, h: 1.3, fontSize: 14, color: '1E3A5F', fontFace: 'Georgia' });
      }
      let y = body ? 2.8 : 1.1;
      if (cards.length > 0 && bullets.length === 0) {
        const cols = Math.min(cards.length, 3);
        const cw = Math.min(3.0, 9 / Math.max(cols, 1));
        cards.slice(0, 6).forEach((cd, ci) => {
          const row = Math.floor(ci / cols);
          const col = ci % cols;
          const cx = 0.5 + col * (cw + 0.15);
          const cy = y + row * 2.0;
          s.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: 1.7, fill: { color: 'FFFFFF' }, rectRadius: 0.08, line: { color: stripHash(cd.color || 'E2E8F0'), width: 0.5 } });
          s.addText(`${cd.emoji_icon || ''} ${cd.label || ''}`, { x: cx + 0.1, y: cy + 0.1, w: cw - 0.2, h: 0.3, fontSize: 11, bold: true, color: '1F2937', fontFace: 'Arial' });
          s.addText(cd.content || '', { x: cx + 0.1, y: cy + 0.45, w: cw - 0.2, h: 1.0, fontSize: 10, color: '374151', fontFace: 'Arial' });
        });
      } else {
        bullets.forEach((b, bi) => {
          const prefix = sd.type === 'step_by_step' ? `${bi + 1}.` : '•';
          s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: 'F8FAFC' }, rectRadius: 0.06, line: { color: 'E2E8F0', width: 0.5 } });
          s.addText(`  ${prefix}  ${b}`, { x: 0.6, y, w: 8.8, h: 0.5, fontSize: 12, color: '374151', fontFace: 'Arial', valign: 'middle' });
          y += 0.6;
        });
      }
    }

    // ── Engagement cue footer ──────────────────────────────
    if (sd.engagement_cue && sd.type !== 'title') {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: SLIDE_H - 0.4, w: 10, h: 0.4, fill: { color: pc } });
      s.addText(`🎯 ${sd.engagement_cue}`, { x: 0.3, y: SLIDE_H - 0.38, w: 9.4, h: 0.35, fontSize: 8, color: 'FFFFFF', italic: true, fontFace: 'Arial' });
    }

    // ── Speaker notes ──────────────────────────────────────
    if (sd.speaker_notes) s.addNotes(sd.speaker_notes);
  }

  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}
