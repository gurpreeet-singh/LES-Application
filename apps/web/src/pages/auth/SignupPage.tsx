import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const INST_CONFIG: Record<string, { name: string; subtitle: string; showLmgc: boolean; color: string }> = {
  school: { name: 'La Martiniere Girls\' College', subtitle: 'K-12 School Platform', showLmgc: true, color: '#1B3A6B' },
  college: { name: 'Horizon University College', subtitle: 'Higher Education Platform', showLmgc: false, showHorizon: true, color: '#7C3AED' },
};

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const inst = searchParams.get('inst') || 'school';
  const config = INST_CONFIG[inst] || INST_CONFIG.school;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('teacher');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password, fullName, role);
      const dest: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
      navigate(dest[role] || '/teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB]">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/ikigai-logo.jpeg" alt="Ikigai" className="h-7 w-auto object-contain" />
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-[12px] font-black text-leap-navy">LEAP</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/signup?inst=school" className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${inst === 'school' ? 'bg-leap-navy text-white' : 'text-gray-400 hover:bg-gray-50'}`}>School</Link>
          <Link to="/signup?inst=college" className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${inst === 'college' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>University</Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-200">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-12 w-auto object-contain" />
                {config.showLmgc && (
                  <><div className="w-px h-10 bg-gray-200" /><img src="/lmgc-logo.jpeg" alt="LMGC" className="h-14 w-auto object-contain" /></>
                )}
                {(config as any).showHorizon && (
                  <><div className="w-px h-10 bg-gray-200" /><img src="/horizon-logo.png" alt="Horizon University College" className="h-14 w-auto object-contain" /></>
                )}
              </div>
              <h1 className="text-lg font-black mb-0.5" style={{ color: config.color }}>{config.name}</h1>
              <p className="text-[11px] text-gray-400">{config.subtitle}</p>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Create your account</h2>
            <p className="text-[12px] text-gray-500 mb-5">Join {config.name}</p>

            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign up form">
              <div>
                <label htmlFor="role" className="section-header block mb-2">I am a</label>
                <div className="flex gap-3" role="radiogroup" aria-label="Select role">
                  <button type="button" onClick={() => setRole('teacher')} role="radio" aria-checked={role === 'teacher'}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${role === 'teacher' ? 'border-leap-navy bg-leap-navy/5 text-leap-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {inst === 'college' ? 'Professor' : 'Teacher'}
                  </button>
                  <button type="button" onClick={() => setRole('student')} role="radio" aria-checked={role === 'student'}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${role === 'student' ? 'border-leap-navy bg-leap-navy/5 text-leap-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    Student
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="signup-name" className="section-header block mb-1.5">Full Name</label>
                <input id="signup-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label htmlFor="signup-email" className="section-header block mb-1.5">Email</label>
                <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label htmlFor="signup-password" className="section-header block mb-1.5">Password</label>
                <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} className="input-field" required aria-describedby="password-hint" />
                <p id="password-hint" className="text-[10px] text-gray-400 mt-1">Minimum 8 characters</p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3" aria-busy={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-[12px] text-gray-400 mt-4 text-center">
              Already have an account? <Link to={`/login?inst=${inst}`} className="text-leap-blue hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
