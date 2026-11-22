import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, BrainCircuit, BookOpen, GraduationCap, LineChart, Sparkles, Shield, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getHomePathForRole } from '../contexts/AuthContext';
import api from '../services/api';

const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowInput, setAllowInput] = useState(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const successMsg = location.state?.successMessage || '';
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();
  const { login, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate(getHomePathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleMouseMove = (e) => setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    api.get('/auth/setup-status').then((res) => setNeedsInitialAdmin(Boolean(res.data?.needsInitialAdmin))).catch(() => {});
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate(getHomePathForRole(result.role), { replace: true });
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#030712] px-4 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div
        className="absolute w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none transition-transform duration-700 ease-out"
        style={{ transform: `translate(${mousePosition.x - 300}px, ${mousePosition.y - 300}px)` }}
      />

      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/40 rounded-full mix-blend-screen filter blur-[100px] animate-[blob_8s_infinite]" />
      <div className="absolute top-[20%] right-[-5%] w-96 h-96 bg-cyan-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-[blob_9s_infinite_2s]" />
      <div className="absolute bottom-[-20%] left-[10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-[blob_10s_infinite_4s]" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.15]">
        <BrainCircuit className="absolute top-20 left-20 text-indigo-400 animate-[bounce_4s_infinite]" size={64} />
        <GraduationCap className="absolute bottom-32 right-32 text-purple-400 animate-[bounce_5s_infinite_1s]" size={80} />
        <LineChart className="absolute top-40 right-1/4 text-cyan-400 animate-[bounce_6s_infinite_2s]" size={56} />
        <BookOpen className="absolute bottom-40 left-1/4 text-blue-400 animate-[bounce_7s_infinite_3s]" size={72} />
      </div>

      <div className="relative z-10 w-full max-w-md p-8 rounded-[2rem] bg-slate-900/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_80px_rgba(99,102,241,0.1)] pointer-events-none" />

        <div className="flex flex-col items-center mb-7 relative">
          <div className="relative">
            <div className="absolute inset-[-12px] rounded-full border-2 border-dashed border-indigo-500/50 animate-[spin_10s_linear_infinite]" />
            <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-xl shadow-indigo-500/30">
              <BrainCircuit size={34} className="text-white" />
            </div>
            <Sparkles className="absolute -top-5 -right-5 text-cyan-400 animate-pulse" size={22} />
          </div>

          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-cyan-200 mt-7 tracking-tight">
            EduRisk
          </h2>
          <p className="text-indigo-200/70 text-[11px] mt-1.5 text-center font-bold uppercase tracking-[0.2em]">
            Academic Risk Prediction & Early Support
          </p>
        </div>

        {successMsg && !errorMsg && (
          <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 size={15} /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} autoComplete="off" className="space-y-5">
          <div className="space-y-1.5 group">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 group-focus-within:text-indigo-400 transition-colors">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                name="edurisk_login_email"
                autoComplete="off"
                readOnly={!allowInput}
                onFocus={() => setAllowInput(true)}
                required
                className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 group">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="edurisk_login_password"
                autoComplete="new-password"
                readOnly={!allowInput}
                onFocus={() => setAllowInput(true)}
                required
                className="w-full pl-11 pr-11 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 flex items-center justify-center gap-2 bg-white text-black hover:bg-slate-200 rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 cursor-pointer"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Sign In to Portal
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-white/10 space-y-3">
          {needsInitialAdmin ? (
            <Link
              to="/register"
              className="w-full py-3 px-4 flex items-center justify-center gap-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 border border-purple-400/40 text-purple-100 text-xs font-bold transition-colors"
            >
              <Shield size={15} /> First-Time Setup: Register First Account as Admin →
            </Link>
          ) : (
            <Link
              to="/register"
              className="w-full py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-colors"
            >
              <Mail size={14} /> New Student or Lecturer? Register with Email OTP
            </Link>
          )}
          <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <Lock size={12} /> Role-based secure access for Administrators, Lecturers &amp; Students
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
