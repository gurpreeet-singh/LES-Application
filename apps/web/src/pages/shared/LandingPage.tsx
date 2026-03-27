import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_PERSONAS = [
  {
    id: 'school-principal',
    institution: 'La Martiniere Girls\' College',
    instType: 'K-12 School',
    role: 'Principal',
    name: 'Dr. Meena Sharma',
    email: 'principal@lmgc.edu',
    password: 'admin1234',
    navRole: 'admin',
    color: '#1B3A6B',
    icon: '🏫',
    logos: ['ikigai', 'lmgc'],
    highlights: ['School-wide dashboard', 'Teacher effectiveness quadrant', 'Timetable & substitute AI', 'Student at-risk alerts'],
  },
  {
    id: 'school-teacher',
    institution: 'La Martiniere Girls\' College',
    instType: 'K-12 School',
    role: 'Teacher',
    name: 'Mrs. Anita Verma',
    email: 'anita@lmgc.edu',
    password: 'demo123',
    navRole: 'teacher',
    color: '#2E75B6',
    icon: '👩‍🏫',
    logos: ['ikigai', 'lmgc'],
    highlights: ['AI lesson plans & Socratic scripts', 'Knowledge graph with 6 gates', 'Quiz generation (10/lesson)', 'Class analytics & AI guide'],
  },
  {
    id: 'school-student',
    institution: 'La Martiniere Girls\' College',
    instType: 'K-12 School',
    role: 'Student',
    name: 'Aarav (Demo Student)',
    email: 'student@lmgc.edu',
    password: 'student123',
    navRole: 'student',
    color: '#1E7E34',
    icon: '📝',
    logos: ['ikigai', 'lmgc'],
    highlights: ['View knowledge graph journey', 'Take quizzes per gate', 'Track mastery & Bloom levels', 'See learning style profile'],
  },
  {
    id: 'college-abhay',
    institution: 'Horizon University College',
    instType: 'Higher Education',
    role: 'Professor — Marketing',
    name: 'Prof. Abhay',
    email: 'abhay@hu.ac.ae',
    password: 'huc12345',
    navRole: 'teacher',
    color: '#2E75B6',
    icon: '📊',
    logos: ['ikigai', 'horizon'],
    highlights: ['MKT2201 — Principles of Marketing', 'Cross-course knowledge graph with IES', 'Student analytics & Bloom tracking', 'AI lesson slides & narration'],
  },
  {
    id: 'college-shashank',
    institution: 'Horizon University College',
    instType: 'Higher Education',
    role: 'Professor — Innovation',
    name: 'Prof. Shashank',
    email: 'shashank@hu.ac.ae',
    password: 'huc12345',
    navRole: 'teacher',
    color: '#7C3AED',
    icon: '💡',
    logos: ['ikigai', 'horizon'],
    highlights: ['GEN2008 — Innovation, Entrepreneurship & Sustainability', 'Cross-course dependencies with Marketing', 'Bottleneck detection across courses', 'INNOVATEX project showcase'],
  },
  {
    id: 'college-student',
    institution: 'Horizon University College',
    instType: 'Higher Education',
    role: 'Student',
    name: 'Fatima (Demo Student)',
    email: 'student@hu.ac.ae',
    password: 'student123',
    navRole: 'student',
    color: '#059669',
    icon: '📝',
    logos: ['ikigai', 'horizon'],
    highlights: ['Enrolled in Marketing + IES courses', 'Take quizzes across courses', 'Switch between courses', 'Track cross-course progress'],
  },
];

export function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleDemoLogin = async (persona: typeof DEMO_PERSONAS[0]) => {
    setLoading(persona.id);
    try {
      await signIn(persona.email, persona.password);
      const dest: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
      navigate(dest[persona.navRole] || '/teacher');
    } catch {
      // Fallback to login page
      navigate(`/login?inst=${persona.id.startsWith('school') ? 'school' : 'college'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-8 w-auto object-contain" />
          <div className="w-px h-6 bg-gray-200" />
          <span className="text-sm font-black text-leap-navy tracking-tight">LEAP</span>
        </div>
        <p className="text-[11px] text-gray-400 hidden md:block">Learning Execution and Acceleration Platform</p>
      </div>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 leading-tight">
          LEAP
        </h1>
        <p className="text-lg text-gray-500 mb-2 font-medium">
          Learning Execution and Acceleration Platform
        </p>
        <p className="text-sm text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload any syllabus — AI generates knowledge graphs, lesson plans, Socratic teaching scripts, and diagnostic quizzes. Track deep conceptual mastery, not just marks.
        </p>

        {/* Demo Persona Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {DEMO_PERSONAS.map(persona => (
            <button
              key={persona.id}
              onClick={() => handleDemoLogin(persona)}
              disabled={!!loading}
              className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-card-lg hover:border-gray-300 transition-all group relative overflow-hidden"
            >
              {/* Loading Overlay */}
              {loading === persona.id && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
                  <p className="text-[13px] font-bold text-gray-500 animate-pulse">Signing in...</p>
                </div>
              )}

              {/* Logos */}
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/ikigai-logo.jpeg" alt="Ikigai" className="h-9 w-auto object-contain" />
                {persona.logos.includes('lmgc') && (
                  <>
                    <div className="w-px h-7 bg-gray-200" />
                    <img src="/lmgc-logo.jpeg" alt="LMGC" className="h-10 w-auto object-contain" />
                  </>
                )}
                {persona.logos.includes('horizon') && (
                  <>
                    <div className="w-px h-7 bg-gray-200" />
                    <img src="/horizon-logo.png" alt="Horizon University College" className="h-10 w-auto object-contain" />
                  </>
                )}
              </div>

              {/* Institution + Role */}
              <div className="mb-3">
                <p className="text-[13px] font-black text-gray-900">{persona.institution}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: persona.color + '15', color: persona.color }}>
                    {persona.instType}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">{persona.role}</span>
                </div>
              </div>

              {/* Persona Name */}
              <div className="flex items-center gap-2.5 mb-3 bg-gray-50 rounded-xl p-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: persona.color }}>
                  {persona.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-800">{persona.name}</p>
                  <p className="text-[10px] text-gray-400">{persona.email}</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1 mb-4">
                {persona.highlights.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: persona.color }} />
                    <span className="text-[10px] text-gray-500">{h}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-2 text-[12px] font-bold group-hover:gap-3 transition-all" style={{ color: persona.color }}>
                Enter as {persona.role}
                <span className="text-base">&#8594;</span>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Login Link */}
        <p className="text-[12px] text-gray-400 mt-8">
          Have your own account? <a href="/login?inst=school" className="text-leap-blue hover:underline font-medium">Sign in</a> or <a href="/signup?inst=school" className="text-leap-blue hover:underline font-medium">create account</a>
        </p>
      </div>

      <div className="pb-6" />
    </div>
  );
}
