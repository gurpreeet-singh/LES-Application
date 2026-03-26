import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_ACCOUNTS: Record<string, { label: string; email: string; password: string; role: string }[]> = {
  school: [
    { label: 'Principal (Admin)', email: 'principal@lmgc.edu', password: 'admin1234', role: 'admin' },
    { label: 'Teacher — Mrs. Anita Verma', email: 'anita@lmgc.edu', password: 'demo123', role: 'teacher' },
  ],
  college: [
    { label: 'Professor — Prof. Rajesh Kumar', email: 'prof.college@university.edu', password: 'college123', role: 'teacher' },
  ],
};

const INST_CONFIG: Record<string, { name: string; subtitle: string; showLmgc: boolean; color: string }> = {
  school: { name: 'La Martiniere Girls\' College', subtitle: 'K-12 School Platform', showLmgc: true, color: '#1B3A6B' },
  college: { name: 'Horizon University College', subtitle: 'Higher Education Platform', showLmgc: false, showHorizon: true, color: '#7C3AED' },
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const inst = searchParams.get('inst') || 'school';
  const config = INST_CONFIG[inst] || INST_CONFIG.school;
  const demoAccounts = DEMO_ACCOUNTS[inst] || DEMO_ACCOUNTS.school;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      const dest: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
      navigate(dest[profile.role] || '/');
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      const stored = localStorage.getItem('les_demo_session');
      const storedRole = stored ? JSON.parse(stored)?.user?.user_metadata?.role : null;
      const dest: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
      navigate(dest[storedRole] || '/teacher');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg.includes('Invalid login') ? 'Invalid email or password.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account: typeof demoAccounts[0]) => {
    setDemoLoading(account.email);
    setError('');
    try {
      await signIn(account.email, account.password);
      const dest: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
      navigate(dest[account.role] || '/teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setDemoLoading(null);
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
        {/* Institution Switcher */}
        <div className="flex items-center gap-2">
          <Link
            to="/login?inst=school"
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${inst === 'school' ? 'bg-leap-navy text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
          >
            School
          </Link>
          <Link
            to="/login?inst=college"
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${inst === 'college' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
          >
            University
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-200">
            {/* Institution Logo + Name */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-12 w-auto object-contain" />
                {config.showLmgc && (
                  <>
                    <div className="w-px h-10 bg-gray-200" />
                    <img src="/lmgc-logo.jpeg" alt="La Martiniere Girls College" className="h-14 w-auto object-contain" />
                  </>
                )}
                {(config as any).showHorizon && (
                  <>
                    <div className="w-px h-10 bg-gray-200" />
                    <img src="/horizon-logo.png" alt="Horizon University College" className="h-14 w-auto object-contain" />
                  </>
                )}
              </div>
              <h1 className="text-lg font-black mb-0.5" style={{ color: config.color }}>{config.name}</h1>
              <p className="text-[11px] text-gray-400">{config.subtitle}</p>
            </div>

            {/* Quick Demo Access */}
            <div className="mb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Demo Access</p>
              <div className="space-y-2">
                {demoAccounts.map(account => (
                  <button
                    key={account.email}
                    onClick={() => handleDemoLogin(account)}
                    disabled={!!demoLoading}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-card transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ background: config.color }}>
                        {account.role === 'admin' ? 'P' : 'T'}
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-gray-800">{account.label}</p>
                        <p className="text-[10px] text-gray-400">{account.email}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300 group-hover:text-gray-500 transition-colors">
                      {demoLoading === account.email ? 'Signing in...' : 'Enter →'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-300 font-bold">OR SIGN IN WITH YOUR ACCOUNT</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4" role="alert">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in form">
              <div>
                <label htmlFor="login-email" className="section-header block mb-1.5">Email</label>
                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="your@email.com" required />
              </div>
              <div>
                <label htmlFor="login-password" className="section-header block mb-1.5">Password</label>
                <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Enter password" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3" aria-busy={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-[12px] text-gray-400 mt-4 text-center">
              Don't have an account? <Link to={`/signup?inst=${inst}`} className="text-leap-blue hover:underline font-medium">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
