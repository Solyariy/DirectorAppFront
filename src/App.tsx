import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Apps from './pages/Apps';
import Rules from './pages/Rules';
import Policies from './pages/Policies';
import Jobs from './pages/Jobs';
import Energy from './pages/Energy';
import Login from './pages/Login';
import { logout, useSession } from './auth';
import { api } from './api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/apps', label: 'Apps', icon: '▣' },
  { to: '/policies', label: 'Policies', icon: '⛉' },
  { to: '/rules', label: 'Rules', icon: '≣' },
  { to: '/jobs', label: 'Jobs', icon: '☰' },
  { to: '/energy', label: 'Energy', icon: '☀' },
];

export default function App() {
  const session = useSession();
  if (!session) return <Login />;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          <span>Director</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {session.username && <span className="sidebar-user" title="Signed in as">{session.username}</span>}
          <button className="btn btn-ghost btn-sm sidebar-logout" onClick={() => logout(api.auth.logout)}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/energy" element={<Energy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
