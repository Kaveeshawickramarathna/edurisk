import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  FileBarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  LifeBuoy,
  UserCircle,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ROLE_NAV = {
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/students', label: 'Students & Records', icon: GraduationCap },
    { to: '/admin/lecturers', label: 'Lecturer Management', icon: UserCheck },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/courses', label: 'Courses & Enrollment', icon: BookOpen },
    { to: '/admin/interventions', label: 'Interventions', icon: ClipboardCheck },
    { to: '/admin/reports', label: 'Reports & ML Metrics', icon: FileBarChart2 },
    { to: '/admin/settings', label: 'Academic Settings', icon: Settings },
  ],
  LECTURER: [
    { to: '/lecturer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/lecturer/courses', label: 'Courses & Gradebook', icon: BookOpen },
    { to: '/lecturer/students', label: 'My Students & Records', icon: GraduationCap },
    { to: '/lecturer/interventions', label: 'Interventions', icon: ClipboardCheck },
    { to: '/lecturer/reports', label: 'Reports & ML Metrics', icon: FileBarChart2 },
    { to: '/lecturer/profile', label: 'My Profile', icon: UserCircle },
  ],
  STUDENT: [
    { to: '/dashboard', label: 'My Overview', icon: LayoutDashboard },
    { to: '/student/academics', label: 'Courses & Simulator', icon: BookOpen },
    { to: '/student/support', label: 'Support & Actions', icon: LifeBuoy },
    { to: '/student/profile', label: 'My Profile', icon: UserCircle },
  ],
};

const ROLE_BADGE = {
  ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  LECTURER: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  STUDENT: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
};

const Layout = ({ title, subtitle, actions, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = ROLE_NAV[user?.role] || [];
  const displayName = user?.profile
    ? `${user.profile.first_name} ${user.profile.last_name}`
    : user?.role === 'ADMIN'
    ? 'System Administrator'
    : user?.email || 'User';

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavLinks = (onSelect) => (
    <div className="px-4 py-5 space-y-1.5">
      <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
        {user?.role} Portal
      </p>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onSelect}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900/60 backdrop-blur-xl border-r border-white/5 hidden lg:flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <BrainCircuit size={22} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 block leading-tight">
                EduRisk
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                Early Support AI
              </span>
            </div>
          </div>
          {renderNavLinks(() => {})}
        </div>

        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-slate-900 border-r border-white/10 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                    <BrainCircuit size={20} className="text-white" />
                  </div>
                  <span className="text-lg font-bold text-white">EduRisk</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              {renderNavLinks(() => setMobileOpen(false))}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-300 bg-red-500/10"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="min-h-20 py-3 bg-slate-900/40 backdrop-blur-md border-b border-white/5 flex flex-wrap items-center justify-between gap-4 px-5 md:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
                {title || 'EduRisk Portal'}
              </h1>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {actions}
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                ROLE_BADGE[user?.role] || ROLE_BADGE.STUDENT
              }`}
            >
              {user?.role}
            </span>
            <div className="flex items-center gap-2.5 p-1 pr-3 bg-white/5 rounded-full border border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
              <span className="text-xs font-medium text-slate-200 hidden sm:inline">{displayName}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
