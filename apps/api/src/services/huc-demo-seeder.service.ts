import type { SupabaseClient } from '@supabase/supabase-js';
import { GATE_COLORS } from '@leap/shared';

// ═══════════════════════════════════════════════════════════════
// HUC Demo Seeder — Horizon University College
// Course 1: Principles of Marketing (MKT2201) — Prof. Abhay
// Course 2: Innovation, Entrepreneurship & Sustainability (GEN2008) — Prof. Shashank
// ═══════════════════════════════════════════════════════════════

// ─── MARKETING COURSE DATA ──────────────────────────────────

const MKT_GATES = [
  { number: 1, title: 'Marketing Foundations', short: 'Foundations', period: 'Jan (W1-3)',
    subs: ['Marketing Process & Value Creation', 'Company & Marketing Strategy', 'Marketing Environment Analysis'],
    blooms: ['remember', 'understand'] },
  { number: 2, title: 'Understanding Markets & Buyer Behavior', short: 'Markets & Buyers', period: 'Feb (W4-6)',
    subs: ['External Environment (PESTLE)', 'Consumer Buyer Behavior', 'Business Buyer Behavior'],
    blooms: ['understand', 'apply'] },
  { number: 3, title: 'Marketing Strategy & Brand Building', short: 'Strategy & Brands', period: 'Feb-Mar (W7-9)',
    subs: ['Segmentation, Targeting & Positioning (STP)', 'Product & Brand Strategy', 'Services Marketing'],
    blooms: ['apply', 'analyze'] },
  { number: 4, title: 'Product Innovation & Pricing', short: 'Products & Pricing', period: 'Mar-Apr (W10-11)',
    subs: ['New Product Development & Product Life Cycle', 'Pricing Strategies & Value Capture'],
    blooms: ['apply', 'analyze'] },
  { number: 5, title: 'Distribution, Communication & Sustainability', short: 'Channels & IMC', period: 'Apr-May (W12-15)',
    subs: ['Marketing Channels & Distribution', 'Retailing & Wholesaling', 'Integrated Marketing Communication', 'Sustainable Marketing & Ethics'],
    blooms: ['analyze', 'evaluate'] },
];

const MKT_LESSONS: { gate: number; week: number; title: string; objective: string; keyIdea: string; breakthrough: string; examples: string[]; exercises: string[] }[] = [
  { gate: 1, week: 1, title: 'Introduction to Marketing & Customer Value', objective: 'Understand the core concepts of marketing and how companies create and capture customer value', keyIdea: 'Marketing is about creating value for customers and building strong customer relationships to capture value in return', breakthrough: 'Marketing is not just selling — it is the entire process of understanding needs and delivering superior value', examples: ['How Starbucks creates value through experience, not just coffee', 'Zara\'s fast fashion model as customer value creation'], exercises: ['Identify 3 brands and explain their value proposition', 'Map the marketing process for a UAE-based company'] },
  { gate: 1, week: 2, title: 'Company & Marketing Strategy', objective: 'Explain how companies design business portfolios and develop marketing strategies for growth', keyIdea: 'Marketing strategy starts with the company mission and flows through portfolio analysis to specific marketing plans', breakthrough: 'Strategy is about choosing what NOT to do as much as what to do — focus beats breadth', examples: ['Apple\'s portfolio strategy across devices, services, and content', 'Careem\'s growth strategy in the Middle East'], exercises: ['Create a BCG matrix for a company of your choice', 'Develop a growth strategy using Ansoff\'s matrix for a UAE startup'] },
  { gate: 1, week: 3, title: 'Analyzing the Marketing Environment', objective: 'Identify and analyze the internal and external forces that affect a company\'s ability to serve its customers', keyIdea: 'The marketing environment consists of micro and macro forces — companies must adapt or be disrupted', breakthrough: 'Companies don\'t just respond to the environment — the best ones shape it', examples: ['How COVID-19 changed consumer behavior in UAE retail', 'PESTLE analysis of the UAE market for new entrants'], exercises: ['Conduct a PESTLE analysis for a real UAE company', 'Identify 3 macro-environmental trends affecting marketing in the Gulf region'] },
  { gate: 2, week: 4, title: 'External Marketing Environment Deep Dive', objective: 'Apply environmental scanning techniques to identify threats and opportunities in external markets', keyIdea: 'Systematic environmental analysis using PESTLE and competitive frameworks reveals hidden market opportunities', breakthrough: 'The companies that win aren\'t the ones with the best products — they\'re the ones who read the environment best', examples: ['How Noon.com identified an e-commerce gap in the Middle East', 'Impact of sustainability regulations on UAE businesses'], exercises: ['Create a competitive landscape map for the UAE food delivery market', 'Analyze how demographic shifts affect marketing strategy in Ajman'] },
  { gate: 2, week: 5, title: 'Consumer Markets & Buyer Behavior', objective: 'Explain the factors that influence consumer buying behavior and the buyer decision process', keyIdea: 'Consumer buying behavior is shaped by cultural, social, personal, and psychological factors — marketers must understand the whole person', breakthrough: 'People don\'t buy products — they buy solutions to problems and expressions of identity', examples: ['How influencer marketing works in UAE social media', 'The role of cultural values in purchasing decisions in the Gulf'], exercises: ['Map the buyer decision process for purchasing a smartphone in the UAE', 'Analyze how social media influences impulse buying among UAE expats'] },
  { gate: 2, week: 6, title: 'Business Markets & B2B Buying', objective: 'Compare business and consumer markets and understand the business buying process', keyIdea: 'B2B buying involves more participants, larger transactions, and relationship-based decision making', breakthrough: 'In B2B, you\'re not selling to a person — you\'re selling to a buying center with different roles and motivations', examples: ['P&G treating business customers as strategic partners', 'How Emirates Airlines sources services from suppliers'], exercises: ['Design a buying center analysis for a corporate IT purchase', 'Compare B2B and B2C buying for the same product category'] },
  { gate: 3, week: 7, title: 'Customer Value-Driven Marketing Strategy (STP)', objective: 'Apply segmentation, targeting, and positioning strategies to create value for target customers', keyIdea: 'STP is the heart of marketing strategy — dividing markets, selecting targets, and positioning for competitive advantage', breakthrough: 'You can\'t be everything to everyone — the power of marketing is in choosing WHO to serve and HOW to be different', examples: ['How Emirates vs Flydubai segment the same market differently', 'Plymouth Rock Assurance positioning case study'], exercises: ['Create a positioning map for 5 smartphone brands', 'Develop an STP strategy for a new coffee chain entering the UAE market'] },
  { gate: 3, week: 8, title: 'Products & Brands: Building Customer Value', objective: 'Define product levels and explain how branding creates customer value and competitive advantage', keyIdea: 'A product is more than a physical item — it includes the augmented benefits, brand identity, and experience layer', breakthrough: 'The strongest brands don\'t compete on features — they compete on meaning and emotional connection', examples: ['Yalla Momos: targeting the UAE expatriate community', 'How Interbrand ranks global brands'], exercises: ['Analyze the 3 levels of product for a brand of your choice', 'Design a brand identity for a UAE startup targeting Gen Z'] },
  { gate: 3, week: 9, title: 'Services Marketing & Brand Experience', objective: 'Understand the unique challenges of marketing services and building brand experiences', keyIdea: 'Services are intangible, inseparable, variable, and perishable — requiring different marketing approaches than products', breakthrough: 'In services, the employee IS the brand — every interaction is a marketing moment', examples: ['How Emirates Airlines markets an intangible service experience', 'Digital marketing insights from a guest lecture perspective'], exercises: ['Apply the services marketing mix (7Ps) to a UAE hospital', 'Create a customer journey map for an online banking service'] },
  { gate: 4, week: 10, title: 'New Product Development & Product Life Cycle', objective: 'Describe the new product development process and how to manage products through their life cycle', keyIdea: 'New products are the lifeblood of a company — but most new products fail without a systematic development process', breakthrough: 'The product life cycle isn\'t just a model — it\'s a strategic roadmap that tells you when to invest, innovate, or exit', examples: ['How Tesla manages the product life cycle of electric vehicles', 'Google\'s approach to digital product development'], exercises: ['Map the PLC stages for 3 products in different phases', 'Design a new product concept using the 8-stage NPD process'] },
  { gate: 4, week: 11, title: 'Pricing: Understanding & Capturing Customer Value', objective: 'Apply major pricing strategies and explain how companies capture value through pricing decisions', keyIdea: 'Price is the only marketing mix element that produces revenue — it must balance customer value, costs, and competition', breakthrough: 'Pricing isn\'t about covering costs — it\'s about capturing the value you\'ve created in the customer\'s mind', examples: ['How Apple uses value-based pricing vs Samsung\'s competition-based pricing', 'Dynamic pricing in UAE ride-hailing apps'], exercises: ['Calculate break-even pricing for a product launch scenario', 'Compare pricing strategies for a luxury vs economy product in the UAE'] },
  { gate: 5, week: 12, title: 'Marketing Channels: Delivering Customer Value', objective: 'Explain how companies use distribution channels to deliver value to customers efficiently', keyIdea: 'Marketing channels are value delivery networks — the right channel strategy can be a powerful competitive advantage', breakthrough: 'The channel IS the experience — how and where customers access products shapes their entire perception of the brand', examples: ['How Amazon disrupted traditional retail channels', 'Omnichannel strategy in UAE retail (Carrefour, Lulu)'], exercises: ['Design a channel strategy for a new FMCG brand entering the UAE', 'Analyze the channel management decisions for an e-commerce company'] },
  { gate: 5, week: 13, title: 'Retailing, Wholesaling & Supply Chains', objective: 'Analyze the role of retailing and wholesaling in the marketing channel and current trends in retail', keyIdea: 'Retailing is the final link to the consumer — and it\'s being transformed by technology, omnichannel, and experience design', breakthrough: 'The future of retail isn\'t just online or offline — it\'s about creating seamless experiences across every touchpoint', examples: ['How Mall of the Emirates creates experiential retail', 'The rise of dark stores and quick commerce in UAE'], exercises: ['Evaluate the retail strategy of a major UAE retailer', 'Present assignment findings on channel strategies'] },
  { gate: 5, week: 14, title: 'Integrated Marketing Communication & Digital Marketing', objective: 'Design an integrated marketing communications program using both traditional and digital channels', keyIdea: 'IMC means delivering a consistent, clear, and compelling message across all customer touchpoints', breakthrough: 'The medium is the message — and in the digital age, every customer interaction is a communication opportunity', examples: ['How Dubai Tourism uses IMC across global campaigns', 'Social media IMC strategies in the UAE market'], exercises: ['Create an IMC plan for a new product launch in the UAE', 'Analyze how a UAE brand integrates online and offline communication'] },
  { gate: 5, week: 15, title: 'Sustainable Marketing: Social Responsibility & Ethics', objective: 'Evaluate the role of marketing in sustainable business practices and ethical decision making', keyIdea: 'Sustainable marketing means meeting present needs without compromising future generations — it\'s both ethical and profitable', breakthrough: 'Sustainability isn\'t a cost center — it\'s increasingly the primary driver of brand preference and customer loyalty', examples: ['Green marketing practices in UAE hypermarkets', 'How CSR communications build trust in UAE banking sector'], exercises: ['Evaluate the sustainability claims of 3 UAE brands', 'Design a sustainable marketing strategy for a new product'] },
];

// ─── IES COURSE DATA ──────────────────────────────────────────

const IES_GATES = [
  { number: 1, title: 'Innovation & Entrepreneurship Foundations', short: 'Innovation Basics', period: 'Jan (W1-3)',
    subs: ['Dimensions of Innovation', 'Entrepreneurship & Sustainability', 'Process Models & Strategy Challenges'],
    blooms: ['remember', 'understand'] },
  { number: 2, title: 'Social Innovation & Entrepreneurial Creativity', short: 'Creativity & Social', period: 'Feb (W4-6)',
    subs: ['Social Innovation & Motivation', 'Enabling Social Innovation', 'De Bono\'s Thinking Hats & Creative Process'],
    blooms: ['understand', 'apply'] },
  { number: 3, title: 'Venture Creation & Business Modeling', short: 'Ventures & Models', period: 'Feb-Mar (W7-10)',
    subs: ['Business Model Canvas', 'Creating New Ventures', 'Growing Enterprise & Funding', 'Managing Innovation'],
    blooms: ['apply', 'analyze'] },
  { number: 4, title: 'Sustainability, SDGs & Global Impact', short: 'Sustainability & SDGs', period: 'Apr-May (W11-15)',
    subs: ['Recognizing Opportunity & Resources', 'UN Sustainable Development Goals', 'Sustainable Innovation (Digital Health, E-learning)', 'Responsible Innovation', 'Globalization & Development'],
    blooms: ['analyze', 'evaluate'] },
];

const IES_LESSONS: typeof MKT_LESSONS = [
  { gate: 1, week: 1, title: 'Innovation & Entrepreneurship: Core Dimensions', objective: 'Understand the fundamental concepts of innovation, entrepreneurship and sustainability and how they interrelate', keyIdea: 'Innovation, entrepreneurship, and sustainability form a triad — each amplifies the others', breakthrough: 'Every successful business started as someone seeing a problem differently — innovation is a mindset, not just a technology', examples: ['How Uber innovated transportation without owning cars', 'UAE Innovation Strategy and government portal'], exercises: ['Define innovation vs invention with 3 examples', 'Map the relationship between innovation, entrepreneurship, and sustainability'] },
  { gate: 1, week: 2, title: 'Process Models for Innovation & Entrepreneurship', objective: 'Analyze different process models that guide innovation and entrepreneurial ventures', keyIdea: 'Innovation isn\'t random — it follows structured processes from ideation through validation to scaling', breakthrough: 'The best innovators don\'t just have ideas — they have systems for turning ideas into impact', examples: ['Steve Jobs\' approach to innovation at Apple', 'Design Thinking as a process model'], exercises: ['Compare 3 innovation process models', 'Apply a structured innovation process to a campus problem'] },
  { gate: 1, week: 3, title: 'Challenges of Innovation Strategy', objective: 'Identify the key challenges organizations face when implementing innovation strategies', keyIdea: 'Innovation strategy must balance exploration of new possibilities with exploitation of existing capabilities', breakthrough: 'The biggest barrier to innovation isn\'t technology — it\'s organizational resistance to change', examples: ['BRICS nations and innovation challenges', 'How Nokia failed to innovate despite market dominance'], exercises: ['Analyze why a specific company failed to innovate', 'Develop an innovation strategy for a UAE SME'] },
  { gate: 2, week: 4, title: 'Social Innovation: Players, Motivation & Impact', objective: 'Identify the unique players in social innovation and understand what motivates social entrepreneurs', keyIdea: 'Social innovation creates solutions that address social needs — often where markets and governments have failed', breakthrough: 'Social innovation proves that profit and purpose aren\'t opposites — the most impactful ventures do both', examples: ['Jack Ma\'s approach to social entrepreneurship', 'Social enterprises solving problems in the UAE'], exercises: ['Identify 3 social innovation examples in the Middle East', 'Analyze the motivation framework for social entrepreneurs'] },
  { gate: 2, week: 5, title: 'Enabling Social Innovation & Its Challenges', objective: 'Analyze the enablers and barriers to social innovation in different contexts', keyIdea: 'Social innovation requires an ecosystem of support — funding, policy, technology, and community engagement', breakthrough: 'The challenge of social innovation isn\'t coming up with ideas — it\'s building sustainable systems around them', examples: ['How youth and women entrepreneurs overcome framework challenges', 'Cultural inclusion in product development (New Zealand study)'], exercises: ['Map the social innovation ecosystem in the UAE', 'Design a solution for a social challenge using innovation principles'] },
  { gate: 2, week: 6, title: 'Entrepreneurial Creativity & De Bono\'s Thinking Hats', objective: 'Apply creative thinking frameworks to develop entrepreneurial ideas and solutions', keyIdea: 'Creativity is a skill that can be developed systematically — frameworks like De Bono\'s Six Thinking Hats structure creative thinking', breakthrough: 'You don\'t need to be born creative — you need to think differently on purpose', examples: ['De Bono\'s Six Thinking Hats applied to a business problem', 'How IDEO uses creative processes for product design'], exercises: ['Apply the Six Thinking Hats to evaluate a startup idea', 'Develop 3 creative business concepts using structured brainstorming'] },
  { gate: 3, week: 7, title: 'Business Model Canvas & Entrepreneurial Planning', objective: 'Build a comprehensive Business Model Canvas and assess entrepreneurial risk and resources', keyIdea: 'The Business Model Canvas is a strategic tool that captures how a venture creates, delivers, and captures value on a single page', breakthrough: 'A business plan is a guess — a Business Model Canvas is a hypothesis you can test and iterate', examples: ['Strategyzer\'s Business Model Canvas framework', 'How Airbnb\'s business model canvas evolved'], exercises: ['Create a Business Model Canvas for a UAE startup idea', 'Identify risks and uncertainties in your canvas'] },
  { gate: 3, week: 8, title: 'Creating New Ventures', objective: 'Understand the types, contexts, and stages of creating new ventures from ideation to launch', keyIdea: 'Venture creation follows predictable stages — ideation, validation, resource assembly, launch, and growth', breakthrough: 'Most ventures don\'t fail because of bad ideas — they fail because of bad timing, wrong team, or running out of runway', examples: ['Harvard Business case: Business service innovation', 'UAE startup ecosystem and support structures'], exercises: ['Design the first 90 days of a new venture launch plan', 'Analyze the obstacles in building a new venture team'] },
  { gate: 3, week: 9, title: 'Growing Enterprise: Funding, Performance & Success', objective: 'Analyze the factors that influence the success, funding, and growth of new ventures', keyIdea: 'Growth requires different skills than startup — scaling means building systems, not just chasing customers', breakthrough: 'The transition from founder-led to professionally managed is where most promising ventures stumble', examples: ['Environmental and economic sustainability through green products', 'Sustainable entrepreneurship business models'], exercises: ['Create a funding strategy for a UAE-based startup', 'Analyze factors that contributed to a startup\'s success or failure'] },
  { gate: 3, week: 10, title: 'Managing Innovation & Building Capability', objective: 'Develop frameworks for managing innovation within organizations and building innovation capability', keyIdea: 'Innovation management is about creating the organizational conditions where innovation can thrive — culture, process, and incentives', breakthrough: 'Innovation isn\'t a department — it\'s a capability that must be embedded in every function of the organization', examples: ['How emerging economy entrepreneurs manage innovation', 'UAE government initiatives for innovation management'], exercises: ['Design an innovation management framework for an organization', 'Evaluate the innovation capability of a real company'] },
  { gate: 4, week: 11, title: 'Recognizing Opportunity & Finding Resources', objective: 'Develop skills to identify entrepreneurial opportunities and mobilize necessary resources', keyIdea: 'Opportunity recognition is a learnable skill — it requires market awareness, pattern recognition, and resource mobilization', breakthrough: 'Opportunities don\'t appear — they\'re constructed by people who see connections others miss', examples: ['UAE Sustainable Development Goals portal', 'How resource-constrained entrepreneurs innovate (jugaad)'], exercises: ['Identify 3 business opportunities from current UAE trends', 'Create a resource mobilization plan for a startup'] },
  { gate: 4, week: 12, title: 'UN Sustainable Development Goals', objective: 'Analyze the UN SDGs and evaluate their implementation in the UAE context', keyIdea: 'The 17 UN SDGs provide a universal framework for addressing global challenges through innovation and entrepreneurship', breakthrough: 'SDGs aren\'t just government goals — they represent $12 trillion in market opportunities for businesses', examples: ['UAE\'s progress on SDGs', 'Digital innovation unlocking sustainable development'], exercises: ['Map a business idea to 3 specific SDGs', 'Analyze UAE\'s implementation of SDGs relevant to your field'] },
  { gate: 4, week: 13, title: 'Sustainable Innovation: Digital Health, E-Learning & Financial Inclusion', objective: 'Evaluate how digital innovation drives sustainable development across healthcare, education, and finance', keyIdea: 'Technology is the great equalizer — digital platforms can provide healthcare, education, and financial services to underserved populations at scale', breakthrough: 'Sustainability through innovation isn\'t charity — it\'s the biggest market opportunity of our generation', examples: ['Telemedicine platforms expanding healthcare access', 'E-learning bridging the digital divide', 'Mobile banking for financial inclusion'], exercises: ['Analyze a role of water in gender equality and sustainability', 'Design a sustainable digital solution for a UAE community challenge'] },
  { gate: 4, week: 14, title: 'Managing Sustainability & Responsible Innovation', objective: 'Develop frameworks for managing the innovation process with sustainability and responsibility as core principles', keyIdea: 'Responsible innovation means anticipating societal impacts and embedding ethical considerations into the innovation process', breakthrough: 'The question isn\'t just "can we build this?" but "should we build this?" — responsibility and innovation must coexist', examples: ['Financial sustainability indicators in higher education', 'How companies manage responsible innovation processes'], exercises: ['Create an ethical innovation framework for an AI product', 'Evaluate the responsible innovation practices of a tech company'] },
  { gate: 4, week: 15, title: 'Globalization, Development & INNOVATEX Showcase', objective: 'Analyze the impact of globalization on innovation and sustainable development, and present final projects', keyIdea: 'Globalization creates both opportunities and challenges — sustainable innovation must work across cultural, economic, and geographic boundaries', breakthrough: 'The future belongs to entrepreneurs who can think globally, act locally, and innovate sustainably', examples: ['How globalization affects entrepreneurship in emerging markets', 'Cross-border innovation partnerships'], exercises: ['Present INNOVATEX project: working model of innovative sustainable solution', 'Reflect on the complete innovation-entrepreneurship-sustainability journey'] },
];

// ─── STUDENT DATA ──────────────────────────────────────────────

const STUDENT_NAMES = ['Fatima Al-Rashid', 'Omar Hussain', 'Aisha Patel', 'Khalid Al-Mansoori', 'Sara Menon', 'Ahmed Tanveer', 'Layla Ibrahim', 'Rayan Sharma'];

// Scores per student: [MKT G1-5, IES G1-4]
const STUDENT_SCORES = [
  [88, 82, 75, 70, 65, 85, 78, 72, 68], // Fatima: solid all-round
  [72, 65, 58, 50, 45, 90, 85, 80, 75], // Omar: weak marketing, strong IES
  [92, 88, 82, 78, 72, 70, 62, 55, 48], // Aisha: strong marketing, weak IES
  [95, 90, 88, 85, 80, 92, 88, 85, 82], // Khalid: top performer
  [65, 55, 42, 35, 28, 60, 50, 40, 30], // Sara: struggling both
  [78, 72, 68, 62, 58, 82, 75, 70, 65], // Ahmed: steady middle
  [85, 80, 72, 65, 60, 88, 82, 78, 72], // Layla: good
  [70, 60, 50, 42, 35, 75, 68, 58, 45], // Rayan: declining
];

// ─── SEEDER FUNCTION ──────────────────────────────────────────

export async function seedHUCDemoCourses(db: SupabaseClient, teacherId: string): Promise<{ courseIds: string[] }> {
  const courseConfigs = [
    { title: 'MKT2201 — Principles of Marketing', subject: 'Marketing', level: '2201', section: 'C', gates: MKT_GATES, lessons: MKT_LESSONS, colorOffset: 0, sessions: 15, duration: 60 },
    { title: 'GEN2008 — Innovation, Entrepreneurship & Sustainability', subject: 'Innovation & Entrepreneurship', level: '2008', section: 'B', gates: IES_GATES, lessons: IES_LESSONS, colorOffset: 5, sessions: 15, duration: 60 },
  ];

  const courseIds: string[] = [];
  const allGateIdMaps: Map<number, string>[] = [];

  for (const cfg of courseConfigs) {
    const { data: course } = await db.from('courses').insert({
      teacher_id: teacherId,
      title: cfg.title,
      subject: cfg.subject,
      class_level: cfg.level,
      section: cfg.section,
      academic_year: '2025-26',
      status: 'active',
      llm_provider: 'openrouter',
      mastery_threshold: 70,
      total_sessions: cfg.sessions,
      session_duration_minutes: cfg.duration,
      syllabus_text: `${cfg.title} — Horizon University College, Spring 2026`,
    }).select().single();

    if (!course) throw new Error(`Failed to create: ${cfg.title}`);
    courseIds.push(course.id);

    // Gates
    const gateInserts = cfg.gates.map((g, i) => ({
      course_id: course.id, gate_number: g.number, title: g.title, short_title: g.short,
      color: GATE_COLORS[(cfg.colorOffset + i) % GATE_COLORS.length].color,
      light_color: GATE_COLORS[(cfg.colorOffset + i) % GATE_COLORS.length].light,
      period: g.period, status: 'accepted', sort_order: g.number,
    }));
    const { data: gates } = await db.from('gates').insert(gateInserts).select();
    if (!gates) throw new Error('Failed to create gates');
    const gateIdMap = new Map(gates.map(g => [g.gate_number, g.id]));
    allGateIdMaps.push(gateIdMap);

    // Within-course prerequisites
    const prereqs: any[] = [];
    for (let gn = 2; gn <= cfg.gates.length; gn++) {
      prereqs.push({ gate_id: gateIdMap.get(gn)!, prerequisite_gate_id: gateIdMap.get(gn - 1)! });
    }
    if (prereqs.length > 0) await db.from('gate_prerequisites').insert(prereqs);

    // Sub-concepts
    const subInserts = cfg.gates.flatMap(g =>
      g.subs.map((s, i) => ({ gate_id: gateIdMap.get(g.number)!, title: s, sort_order: i + 1, status: 'accepted' }))
    );
    await db.from('sub_concepts').insert(subInserts);

    // Lessons + Socratic scripts + Questions
    for (const lesson of cfg.lessons) {
      const gateId = gateIdMap.get(lesson.gate)!;
      const bl = cfg.gates.find(g => g.number === lesson.gate)?.blooms || ['understand', 'apply'];

      const { data: lessonRow } = await db.from('lessons').insert({
        gate_id: gateId, course_id: course.id, lesson_number: lesson.week,
        title: lesson.title, objective: lesson.objective,
        key_idea: lesson.keyIdea, conceptual_breakthrough: lesson.breakthrough,
        bloom_levels: bl,
        examples: lesson.examples.map(e => ({ text: e })),
        exercises: lesson.exercises.map(e => ({ text: e })),
        duration_minutes: cfg.duration, status: 'accepted', sort_order: lesson.week,
      }).select().single();

      if (lessonRow) {
        // Socratic scripts
        await db.from('socratic_scripts').insert([
          { lesson_id: lessonRow.id, stage_number: 1, stage_title: 'Hook', duration_minutes: 10, teacher_prompt: `Before we explore ${lesson.title.toLowerCase()}, let me ask you something...`, expected_response: 'Students share prior knowledge and initial perspectives', follow_up: 'Interesting perspectives. Let\'s dig deeper.', sort_order: 1, status: 'accepted' },
          { lesson_id: lessonRow.id, stage_number: 2, stage_title: 'Discovery', duration_minutes: 20, teacher_prompt: `Now that we\'re thinking about this — ${lesson.keyIdea.toLowerCase()} — what patterns do you notice?`, expected_response: 'Students begin identifying key concepts and relationships', follow_up: 'You\'re discovering the core principle. Let\'s formalize it.', sort_order: 2, status: 'accepted' },
          { lesson_id: lessonRow.id, stage_number: 3, stage_title: 'Concept Build', duration_minutes: 18, teacher_prompt: `Based on what we\'ve discovered, how would you define the main concept in your own words?`, expected_response: 'Students articulate the concept before seeing the formal definition', follow_up: 'Excellent. Now compare your definition with the textbook.', sort_order: 3, status: 'accepted' },
          { lesson_id: lessonRow.id, stage_number: 4, stage_title: 'Application', duration_minutes: 12, teacher_prompt: `Apply what we\'ve learned to a real case. ${lesson.exercises[0]}`, expected_response: 'Students apply concepts to practical scenarios', follow_up: 'Next week we build on this foundation.', sort_order: 4, status: 'accepted' },
        ]);

        // 10 Questions per lesson
        const qInserts = [
          { type: 'mcq', bloom: 'remember', diff: 1, text: `What is the core concept behind ${lesson.title.split(':')[0]}?` },
          { type: 'mcq', bloom: 'understand', diff: 2, text: `Which statement best explains the key idea: "${lesson.keyIdea.slice(0, 60)}..."?` },
          { type: 'mcq', bloom: 'apply', diff: 3, text: `Apply the concepts from ${lesson.title} to a real-world business scenario.` },
          { type: 'true_false', bloom: 'remember', diff: 1, text: `True or False: ${lesson.keyIdea.split('—')[0].trim()}.` },
          { type: 'true_false', bloom: 'understand', diff: 2, text: `True or False: ${lesson.breakthrough.split('—')[0].trim()}.` },
          { type: 'short_answer', bloom: 'apply', diff: 3, text: `Explain how ${lesson.title.toLowerCase()} applies to a business in the UAE market.` },
          { type: 'short_answer', bloom: 'analyze', diff: 4, text: `Compare and contrast two approaches to ${lesson.title.split(':')[0].toLowerCase()}.` },
          { type: 'open_ended', bloom: 'analyze', diff: 4, text: `Analyze the relationship between ${lesson.title.toLowerCase()} and business sustainability.` },
          { type: 'open_ended', bloom: 'evaluate', diff: 5, text: `Evaluate whether the concepts from this lesson are more applicable to startups or established companies. Justify.` },
          { type: 'open_ended', bloom: 'create', diff: 5, text: `Design an original strategy applying the principles of ${lesson.title.toLowerCase()} for a new venture in the Gulf region.` },
        ].map(q => ({
          gate_id: gateId, course_id: course.id, question_text: q.text,
          question_type: q.type, bloom_level: q.bloom, difficulty: q.diff,
          options: q.type === 'mcq' ? [{ text: 'Correct answer', is_correct: true }, { text: 'Common misconception', is_correct: false }, { text: 'Partially correct', is_correct: false }, { text: 'Unrelated concept', is_correct: false }]
            : q.type === 'true_false' ? [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] : null,
          correct_answer: `Model answer demonstrating understanding of ${lesson.keyIdea.slice(0, 80)}`,
          rubric: 'Full marks: demonstrates deep understanding with examples. Partial: correct concept but lacks depth. Zero: incorrect or off-topic.',
          status: 'accepted',
        }));
        await db.from('questions').insert(qInserts);
      }
    }
  }

  // ─── CROSS-COURSE PREREQUISITES ──────────────────────────────
  const [mktGates, iesGates] = allGateIdMaps;
  const crossPrereqs = [
    // IES G3 (Venture Creation) requires Marketing G2 (Understanding Markets) — can't build a business without knowing your market
    { gate_id: iesGates.get(3)!, prerequisite_gate_id: mktGates.get(2)! },
    // IES G3 (Venture Creation) requires Marketing G3 (STP Strategy) — positioning is essential for new ventures
    { gate_id: iesGates.get(3)!, prerequisite_gate_id: mktGates.get(3)! },
    // Marketing G4 (Product Innovation) benefits from IES G2 (Creativity) — innovation mindset for product development
    { gate_id: mktGates.get(4)!, prerequisite_gate_id: iesGates.get(2)! },
    // IES G4 (Sustainability/SDGs) connects to Marketing G5 (Sustainable Marketing) — sustainability lens from marketing
    { gate_id: iesGates.get(4)!, prerequisite_gate_id: mktGates.get(5)! },
    // Marketing G5 (IMC/Digital) connects to IES G3 (Technology & Entrepreneurship) — digital tools for ventures
    { gate_id: mktGates.get(5)!, prerequisite_gate_id: iesGates.get(3)! },
  ];
  await db.from('gate_prerequisites').insert(crossPrereqs);

  // ─── STUDENTS ──────────────────────────────────────────────────
  const studentIds: string[] = [];
  for (const name of STUDENT_NAMES) {
    const email = `huc.${name.toLowerCase().replace(/[^a-z]/g, '')}.${Date.now()}@hu.ac.ae`;
    try {
      const { data: user } = await db.auth.admin.createUser({
        email, password: 'student123', email_confirm: true,
        user_metadata: { full_name: name, role: 'student' },
      });
      if (user?.user) {
        await db.from('profiles').insert({ id: user.user.id, email, full_name: name, role: 'student', school: 'Horizon University College' });
        studentIds.push(user.user.id);
      }
    } catch { /* skip */ }
  }

  if (studentIds.length > 0) {
    const enrollments = studentIds.flatMap(sid => courseIds.map(cid => ({ course_id: cid, student_id: sid })));
    for (let i = 0; i < enrollments.length; i += 10) {
      await db.from('enrollments').insert(enrollments.slice(i, i + 10));
    }

    // Progress data
    const progressRows: any[] = [];
    for (let si = 0; si < studentIds.length; si++) {
      let scoreIdx = 0;
      // MKT: 5 gates
      for (let gn = 1; gn <= 5; gn++) {
        const sc = STUDENT_SCORES[si]?.[scoreIdx] || 0;
        scoreIdx++;
        progressRows.push({
          student_id: studentIds[si], gate_id: mktGates.get(gn)!, course_id: courseIds[0],
          mastery_pct: sc, is_unlocked: sc > 0,
          bloom_scores: { remember: Math.min(100, sc + 10), understand: sc, apply: Math.max(0, sc - 10), analyze: Math.max(0, sc - 25), evaluate: Math.max(0, sc - 40), create: Math.max(0, sc - 55) },
        });
      }
      // IES: 4 gates
      for (let gn = 1; gn <= 4; gn++) {
        const sc = STUDENT_SCORES[si]?.[scoreIdx] || 0;
        scoreIdx++;
        progressRows.push({
          student_id: studentIds[si], gate_id: iesGates.get(gn)!, course_id: courseIds[1],
          mastery_pct: sc, is_unlocked: sc > 0,
          bloom_scores: { remember: Math.min(100, sc + 10), understand: sc, apply: Math.max(0, sc - 10), analyze: Math.max(0, sc - 25), evaluate: Math.max(0, sc - 40), create: Math.max(0, sc - 55) },
        });
      }
    }
    for (let i = 0; i < progressRows.length; i += 10) {
      await db.from('student_gate_progress').insert(progressRows.slice(i, i + 10));
    }
  }

  // AI Suggestions highlighting cross-course insights
  await db.from('ai_suggestions').insert([
    { course_id: courseIds[1], gate_id: iesGates.get(3), type: 'lesson_refine', title: 'Marketing knowledge gap blocking venture planning', description: 'Omar and Sara are struggling with Business Model Canvas (IES G3) because they lack STP strategy knowledge from Marketing G3. Coordinate with Prof. Abhay for a joint session on positioning for new ventures.', status: 'pending' },
    { course_id: courseIds[0], gate_id: mktGates.get(4), type: 'remediation', title: 'Innovation mindset needed for Product Development', description: 'Aisha scores 82% in Marketing Strategy but only 62% in Entrepreneurial Creativity (IES G2). Her product innovation ideas lack creative depth. Suggest she engages more with De Bono\'s Thinking Hats from Prof. Shashank\'s course.', status: 'pending' },
    { course_id: courseIds[1], gate_id: iesGates.get(4), type: 'peer_teaching', title: 'Sustainable Marketing expertise can boost SDG projects', description: 'Khalid (80% in Sustainable Marketing, 82% in Sustainability/SDGs) can mentor Sara (28% and 30%) on connecting marketing ethics with UN SDG implementation for the INNOVATEX project.', status: 'accepted' },
  ]);

  console.log(`HUC demo seeded: ${courseIds.length} courses, ${studentIds.length} students, ${crossPrereqs.length} cross-course edges`);
  return { courseIds };
}
