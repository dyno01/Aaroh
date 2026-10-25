import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, GitBranch, BookOpen, UserRound, Zap, LayoutDashboard, Radio, BarChart3, Upload, Users, Tags } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { Avatar } from '../components/ui.jsx';

const studentNav = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/path', label: 'Path', icon: GitBranch },
  { to: '/app/tests', label: 'Tests', icon: BookOpen },
  { to: '/app/analytics', label: 'Stats', icon: BarChart3 },
  { to: '/app/you', label: 'You', icon: UserRound }
];

const adminNav = [
  { to: '/app/admin', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/admin/exams', label: 'Papers', icon: BookOpen },
  { to: '/app/admin/live', label: 'Live', icon: Radio },
  { to: '/app/admin/students', label: 'People', icon: Users },
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/admin/import', label: 'Import', icon: Upload },
  { to: '/app/admin/styles', label: 'Buttons', icon: Tags }
];

function IconBtn({ to, end, label, icon: Icon }) {
  return (
    <NavLink to={to} end={end} title={label} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-ico"><Icon size={20} strokeWidth={2.1} /></span>
      <span className="nav-lab">{label}</span>
    </NavLink>
  );
}

export default function Shell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const adminMode = loc.pathname.startsWith('/app/admin');
  const items = adminMode ? adminNav : studentNav;

  async function startNow() {
    if (adminMode) {
      nav('/app/admin/live');
      return;
    }
    try {
      const d = await api('/api/exams/start-pick');
      if (d?.exam?.id) nav(`/app/exam/${d.exam.id}`);
      else nav('/app/tests');
    } catch {
      nav('/app/tests');
    }
  }

  return (
    <div className={`shell ${adminMode ? 'admin' : ''}`}>
      <aside className="sidebar">
        <div className="side-top">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <span className="brand-name">Aaroh</span>
              {adminMode && <div className="desk-pill">Coach desk</div>}
            </div>
          </div>
        </div>
        <nav className="side-nav">
          {items.map((it) => (
            <IconBtn key={it.to} {...it} />
          ))}
        </nav>
        <div className="side-spacer" />
        <div className="side-foot">
          <div className="user-card">
            <Avatar key={user?.name} name={user?.name} color={user?.avatar_color} size={40} />
            <div className="who">
              <b title={user?.name}>{user?.name}</b>
              <span>{user?.role === 'admin' ? 'Coach' : (user?.username ? `@${user.username}` : 'Aspirant')}</span>
            </div>
          </div>
          {user?.role === 'admin' && (
            <NavLink to={adminMode ? '/app' : '/app/admin'} className="nav-item">
              <span className="nav-ico">{adminMode ? <Home size={18} strokeWidth={2.1} /> : <LayoutDashboard size={18} strokeWidth={2.1} />}</span>
              <span className="nav-lab">{adminMode ? 'Student hall' : 'Coach desk'}</span>
            </NavLink>
          )}
          <button className="side-cta" onClick={startNow}>
            <Zap size={18} strokeWidth={2.2} /> {adminMode ? 'Open live' : 'Start a paper'}
          </button>
        </div>
      </aside>

      <aside className="rail" aria-label="Hall">
        <div className="brand-mark" title="Aaroh">A</div>
        <div className="rail-stack">
          {items.slice(0, 2).map((it) => (
            <IconBtn key={it.to} {...it} />
          ))}
          <button className="go" onClick={startNow} title={adminMode ? 'Live control' : 'Start a paper'} aria-label={adminMode ? 'Live' : 'Start a paper'}>
            <Zap size={22} strokeWidth={2.2} />
          </button>
          {(adminMode ? items.slice(2).filter((it) => it.to !== '/app/admin/live') : items.slice(2)).map((it) => (
            <IconBtn key={it.to} {...it} />
          ))}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="dock" aria-label="Hall">
        {(adminMode ? adminNav.slice(0, 2) : studentNav.slice(0, 2)).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <span className="lab"><it.icon size={16} strokeWidth={2.2} /> {it.label}</span>
          </NavLink>
        ))}
        <button className="go" onClick={startNow} aria-label={adminMode ? 'Live' : 'Start a paper'}>
          <Zap size={20} strokeWidth={2.2} />
        </button>
        {(adminMode ? [adminNav[3], adminNav[5]] : [
          studentNav[2],
          user?.role === 'admin' ? { to: '/app/admin', label: 'Desk', icon: LayoutDashboard } : studentNav[4]
        ]).map((it) => (
          <NavLink key={it.to} to={it.to}>
            <span className="lab"><it.icon size={16} strokeWidth={2.2} /> {it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
