import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const dashboardPath = profile?.role === 'teacher' ? '/teacher' : '/student';
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const teacherLinks = [
    { to: '/teacher', label: 'Dashboard', exact: true },
    { to: '/teacher/courses', label: 'Courses' },
    { to: '/teacher/guide', label: 'Guide' },
  ];

  const studentLinks = [
    { to: '/student', label: 'Dashboard', exact: true },
  ];

  const links = profile?.role === 'teacher' ? teacherLinks : studentLinks;

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-nav px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-5">
        {/* Ikigai Logo (SaaS Provider) + LMGC Logo (Client) */}
        <Link to={dashboardPath} className="flex items-center gap-3">
          <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
            <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <img src="/lmgc-logo.jpeg" alt="La Martiniere Girls' College" className="h-9 w-auto object-contain" />
            <div className="flex flex-col hidden md:flex">
              <span className="text-[11px] font-black text-les-navy tracking-tight leading-none">LMGC</span>
              <span className="text-[8px] text-gray-400 leading-none">La Martiniere</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1 ml-1">
          {links.map(link => {
            const active = link.exact
              ? location.pathname === link.to
              : isActive(link.to) && !(link.to === '/teacher' && location.pathname !== '/teacher');
            return (
              <Link
                key={link.to}
                to={link.to}
                className={active ? 'pill-tab-active' : 'pill-tab-inactive'}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-les-navy text-white flex items-center justify-center text-[13px] font-bold">
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-gray-700">{profile?.full_name}</span>
            <span className="text-[10px] text-gray-400 capitalize">{profile?.role}</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[12px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
