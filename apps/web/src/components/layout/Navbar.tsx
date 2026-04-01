import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const dashboardMap: Record<string, string> = { teacher: '/teacher', student: '/student', admin: '/admin' };
  const dashboardPath = dashboardMap[profile?.role || ''] || '/';
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Detect institution from profile school field
  const isCollege = profile?.school === 'Horizon University College' || profile?.email?.includes('college') || profile?.email?.includes('university') || profile?.email?.includes('hu.ac.ae');

  const teacherLinks = [
    { to: '/teacher', label: 'Dashboard', exact: true },
    { to: '/teacher/courses', label: 'Courses' },
    { to: '/teacher/guide', label: 'Guide' },
  ];

  const studentLinks = [
    { to: '/student', label: 'Dashboard', exact: true },
    { to: '/student/guide', label: 'Guide' },
  ];
  // Note: "Lessons" link is per-course, shown on dashboard

  const adminLinks = [
    { to: '/admin', label: 'Today', exact: true },
    { to: '/admin/timetable', label: 'Timetable' },
    { to: '/admin/teachers', label: 'Teachers' },
    { to: '/admin/guide', label: 'Guide' },
  ];

  const linkMap: Record<string, typeof teacherLinks> = { teacher: teacherLinks, student: studentLinks, admin: adminLinks };
  const links = linkMap[profile?.role || ''] || [];

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-nav px-4 md:px-6 py-2 flex items-center justify-between" aria-label="Main navigation">
      <div className="flex items-center gap-5">
        {/* Logo — adapts per institution */}
        <Link to={dashboardPath} className="flex items-center gap-3">
          <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
            <img src="/ikigai-logo.jpeg" alt="Ikigai School of AI" className="h-8 w-auto object-contain" />
          </div>
          {isCollege ? (
            <div className="flex items-center gap-2">
              <img src="/horizon-logo.png" alt="Horizon University College" className="h-9 w-auto object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img src="/lmgc-logo.jpeg" alt="La Martiniere Girls' College" className="h-9 w-auto object-contain" />
              <div className="flex flex-col hidden md:flex">
                <span className="text-[11px] font-black text-leap-navy tracking-tight leading-none">LMGC</span>
                <span className="text-[8px] text-gray-400 leading-none">La Martiniere</span>
              </div>
            </div>
          )}
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
          <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-[13px] font-bold ${isCollege ? 'bg-purple-700' : 'bg-leap-navy'}`}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-gray-700">{profile?.full_name}</span>
            <span className="text-[10px] text-gray-400 capitalize">{profile?.role}</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[12px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Sign out of your account"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
