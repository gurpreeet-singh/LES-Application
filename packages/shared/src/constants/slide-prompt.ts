import { getClassLevelDirective } from './system-prompt';

export interface SlideGenerationParams {
  lessonTitle: string;
  lessonNumber: number;
  objective: string;
  keyIdea: string;
  conceptualBreakthrough?: string;
  examples: string[];
  exercises: string[];
  bloomLevels: string[];
  dikwLevel: string;
  gateTitle: string;
  gateNumber: number;
  subConcepts: string[];
  socraticStages?: { title: string; teacher_prompt: string; expected_response: string }[];
  subject: string;
  classLevel?: string;
  sessionDuration: number;
}

export function buildSlideGenerationPrompt(params: SlideGenerationParams): { system: string; user: string } {
  const classDirective = getClassLevelDirective(params.classLevel);
  const level = parseInt(params.classLevel || '8', 10);

  const system = `Role: You are an expert educational presentation designer creating ENGAGING, VISUAL, CLASS-APPROPRIATE teaching slides for Indian school classrooms.

You create presentations that are NOT boring bullet-point lectures. Every slide should make students WANT to pay attention. Use stories, riddles, songs, games, comparisons, myth-busters, and activities — not just text.

CRITICAL DESIGN PRINCIPLES:

1. HOOK FIRST — Start with a riddle, mystery, or question that makes students curious
2. BLOOM PROGRESSION — Structure slides to climb: Remember → Understand → Apply → Analyze → Evaluate → Create
3. VARIETY — Never use the same slide layout twice in a row. Mix: cards, tables, comparisons, songs, games, activities
4. REAL LIFE — Every concept must connect to objects/situations students know (Indian context)
5. INTERACTION — Include at least 3 slides that require student ACTION (discuss, sort, draw, guess, vote)
6. VISUAL LANGUAGE — Use emojis, icons, color coding. Describe visual elements the teacher should show
7. END WITH CREATION — Last content slide should be a creative activity (draw, build, design, write)
8. CELEBRATION — End with a summary + positive reinforcement

${level <= 5 ? `
PRIMARY CLASS (Class ${level}) SPECIFIC:
- Use SIMPLE words (5-8 word sentences)
- Include a SONG or RHYME slide with musical notes (♪ ♫)
- Use character names from Indian context (Riya, Aman, Priya)
- Include riddles: "I have X sides and Y corners. What am I?"
- Real-life examples: school supplies, food, playground, animals, festivals
- Activities: draw, color, cut-paste, build with blocks
- Celebrate: "Great Job!" "You're a [topic] Explorer!"
` : level <= 8 ? `
MIDDLE SCHOOL (Class ${level}) SPECIFIC:
- Include a "Did You Know?" or "Fun Fact" slide
- Include a "Compare & Contrast" slide with VS layout
- Use real-world Indian examples: cricket stats, Swiggy/Zomato, UPI, railways
- Include a "Common Mistake" or "Myth Buster" slide
- Activities: solve, calculate, design, debate with partner
- Challenge slide for advanced students
` : `
SENIOR (Class ${level}) SPECIFIC:
- Include a "Case Study" or "Real Data" slide with Indian context
- Include a "Two Perspectives" debate slide
- Use actual data: GDP figures, population stats, scientific measurements
- Include a "Critical Thinking" slide that has no single right answer
- Activities: analyze data, evaluate arguments, design solutions, write positions
`}
${classDirective}

OUTPUT FORMAT: Generate a JSON object with this EXACT structure:

{
  "presentation_title": "Engaging title for the presentation",
  "total_slides": 14,
  "color_palette": {
    "primary": "#1B3A6B",
    "accent": "#2E75B6",
    "dark_bg": "#1B3A6B",
    "light_bg": "#F0F7FF"
  },
  "slides": [
    {
      "slide_number": 1,
      "type": "hook_riddle",
      "bloom_level": null,
      "section_label": "LET'S BEGIN!",
      "title": "Can you guess?",
      "layout": "center_stage",
      "theme": { "background": "#1B3A6B", "primary_color": "#FFFFFF", "accent_color": "#FFD700", "text_color": "#FFFFFF" },
      "content": {
        "heading": "Mystery Question",
        "bullets": ["I have NO sides...", "I am perfectly round...", "What am I?"]
      },
      "speaker_notes": "Start with curiosity. Let students guess before revealing."
    }
  ]
}

SLIDE TYPES YOU MUST USE (mix at least 8 different types across 14 slides):

| Type | Layout | When to Use |
|------|--------|-------------|
| hook_riddle | center_stage | Slide 1: Opening mystery/riddle |
| bloom_ladder | grid_cards | Slide 2: Show what we'll learn at each Bloom level |
| definition | left_right | Remember: Define the concept with visual |
| properties_table | table | Understand: Show properties in organized table |
| song_rhyme | center_stage | Understand: Musical memory aid (PRIMARY ONLY) |
| real_life | grid_cards | Apply: Connect to real-world objects |
| spot_game | center_stage | Apply: Interactive "find/identify" game |
| what_am_i | grid_cards | Apply: Guessing game with clues |
| comparison | comparison | Analyze: Compare two things side by side |
| sort_classify | buckets | Analyze: Sort items into categories |
| myth_buster | myths | Evaluate: "Wait... Is That True?" |
| creative_activity | center_stage | Create: Draw, build, design activity |
| quick_quiz | quiz | Review: 5 quick questions |
| summary | center_stage | Wrap-up with celebration |

RULES:
- Generate EXACTLY 14 slides
- First slide MUST be a hook (riddle, mystery, or curiosity question)
- Slide 2 MUST show the Bloom progression ladder for this lesson
- Last 2 slides MUST be quick_quiz + summary
- Include at least 1 comparison slide
- Include at least 1 sort_classify or myth_buster slide
- Include at least 1 creative_activity slide
- Every slide needs speaker_notes (what the teacher should say/do)
- Use emojis liberally in content for younger classes
- All content must be factually accurate for the subject

Output ONLY the JSON. No markdown, no commentary.`;

  const user = `Generate a 14-slide engaging teaching presentation for:

LESSON: Session ${params.lessonNumber} — "${params.lessonTitle}"
SUBJECT: ${params.subject}
CLASS LEVEL: ${params.classLevel || '8'}
DURATION: ${params.sessionDuration} minutes

LEARNING OBJECTIVE: ${params.objective}
KEY IDEA: ${params.keyIdea}
${params.conceptualBreakthrough ? `BREAKTHROUGH: ${params.conceptualBreakthrough}` : ''}

TOPIC CONTEXT: Unit ${params.gateNumber} — ${params.gateTitle}
SUB-CONCEPTS: ${params.subConcepts.join(', ')}

BLOOM LEVELS: ${params.bloomLevels.join(' → ')}
DIKW LEVEL: ${params.dikwLevel}

EXAMPLES TO INCLUDE:
${params.examples.map((e, i) => `${i + 1}. ${e}`).join('\n')}

EXERCISES/ACTIVITIES:
${params.exercises.map((e, i) => `${i + 1}. ${e}`).join('\n')}

${params.socraticStages ? `SOCRATIC SCRIPT STAGES:
${params.socraticStages.map(s => `- ${s.title}: "${s.teacher_prompt}"`).join('\n')}` : ''}

Generate 14 rich, engaging slides that make this lesson come alive. Remember:
- Hook first (riddle/mystery)
- Bloom progression shown
- Mix of layouts (tables, comparisons, games, songs, activities)
- Real-life Indian context
- Interactive elements
- Creative activity near the end
- Quiz + celebration at the end`;

  return { system, user };
}
