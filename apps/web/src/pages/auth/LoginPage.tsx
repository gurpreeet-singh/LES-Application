import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('anita@lmgc.edu');
  const [password, setPassword] = useState('demo123');
  const [fullName, setFullName] = useState('Mrs. Anita Verma');
  const [role, setRole] = useState<'student' | 'teacher'>('teacher');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, profile } = useAuth();
  const navigate = useNavigate();

  if (profile) {
    navigate(profile.role === 'teacher' ? '/teacher' : '/student');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(role === 'teacher' ? '/teacher' : '/student');
    } catch (signInErr) {
      // If login fails, try signup (new user)
      try {
        await signUp(email, password, fullName || email.split('@')[0] || 'User', role);
        navigate(role === 'teacher' ? '/teacher' : '/student');
      } catch (signUpErr) {
        // If both fail, show the original login error (not the signup error)
        const msg = signInErr instanceof Error ? signInErr.message : 'Login failed';
        if (msg.includes('Invalid login')) {
          setError('Invalid email or password. Please check your credentials.');
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-200 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-12 w-auto object-contain" />
            <div className="w-px h-10 bg-gray-200" />
            <img src="/lmgc-logo.jpeg" alt="LMGC" className="h-14 w-auto object-contain" />
          </div>
          <h1 className="text-lg font-black text-les-navy mb-0.5">Learning Effectiveness System</h1>
          <p className="text-[11px] text-gray-400">Powered by Ikigai School of AI</p>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome back</h2>
        <p className="text-[12px] text-gray-500 mb-5">Sign in to continue</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="section-header block mb-2">I am a</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  role === 'teacher'
                    ? 'border-les-navy bg-les-navy/5 text-les-navy'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                👩‍🏫 Teacher
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  role === 'student'
                    ? 'border-les-navy bg-les-navy/5 text-les-navy'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                🎓 Student
              </button>
            </div>
          </div>

          <div>
            <label className="section-header block mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="section-header block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="section-header block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-[12px] text-gray-400 mt-4 text-center">
          Don't have an account? <Link to="/signup" className="text-les-blue hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
