import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrainCircuit,
  User,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { useAuth, getHomePathForRole } from '../contexts/AuthContext';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';

const MAJORS = ['Computer Science', 'Data Science', 'Software Engineering', 'Information Systems'];

const Register = () => {
  const navigate = useNavigate();
  const { user, completeAuthSession } = useAuth();

  const [form, setForm] = useState({
    role: 'STUDENT',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    studentIdentifier: '',
    major: 'Computer Science',
    yearOfStudy: 1,
    department: 'Computer Science',
    employeeId: '',
  });

  const [otpCode, setOtpCode] = useState('');
  const [otpSentInfo, setOtpSentInfo] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [allowInput, setAllowInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (user) {
      navigate(getHomePathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    api
      .get('/auth/setup-status')
      .then((res) => setNeedsInitialAdmin(Boolean(res.data?.needsInitialAdmin)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (!form.firstName.trim()) {
      setErrorMsg('Please enter your First Name before requesting an OTP.');
      return;
    }
    if (!form.email.trim()) {
      setErrorMsg('Please enter your email address first.');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await api.post('/auth/otp/send', {
        email: form.email,
        studentName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        purpose: 'STUDENT_REGISTER',
      });
      setOtpSentInfo(res.data);
      setVerificationToken('');
      setVerifiedEmail('');
      setOtpCode('');
      setCooldown(30);
      setStatusMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to send email OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code from your email.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.post('/auth/otp/verify', {
        email: form.email,
        otpCode: otpCode.trim(),
      });
      setVerificationToken(res.data.verificationToken);
      setVerifiedEmail(res.data.email);
      setStatusMsg(`Email ${res.data.email} verified!`);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid OTP code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!verificationToken) {
      setErrorMsg('Please verify your email address with OTP first.');
      return;
    }
    if (!isStrongPassword(form.password)) {
      setErrorMsg('Please enter a strong password (8+ chars with uppercase, lowercase, number, and special character).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/register-student', {
        ...form,
        email: verifiedEmail || form.email,
        verificationToken,
      });
      completeAuthSession(res.data.token, res.data.user);
      navigate(getHomePathForRole(res.data.user.role), { replace: true });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#030712] px-4 py-10">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full filter blur-[110px]" />
      <div className="absolute bottom-[-15%] right-[-5%] w-96 h-96 bg-cyan-500/25 rounded-full filter blur-[110px]" />

      <div className="relative z-10 w-full max-w-xl p-7 sm:p-8 rounded-[2rem] bg-slate-900/75 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <BrainCircuit size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">
                {needsInitialAdmin
                  ? 'Initial Administrator Setup'
                  : form.role === 'LECTURER'
                  ? 'Lecturer Registration'
                  : 'Student Registration'}
              </h1>
              <p className="text-xs text-slate-400">
                {needsInitialAdmin
                  ? 'First registered user becomes the System Administrator (verified via Email OTP)'
                  : 'Verify your email address via 6-digit OTP to join EduRisk'}
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
          >
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}
        {statusMsg && !errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} /> {statusMsg}
          </div>
        )}

        <form onSubmit={handleRegister} autoComplete="off" className="space-y-4">
          {!needsInitialAdmin && (
            <div className="grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'STUDENT' })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.role === 'STUDENT'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap size={15} /> Register as Student
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'LECTURER' })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  form.role === 'LECTURER'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck size={15} /> Register as Lecturer
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">First Name *</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="First name"
                  className="w-full pl-9 pr-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Last Name *</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Last name"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Email & OTP Verification Section */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail size={13} /> Email Address & OTP Verification *
              </label>
              {verificationToken && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <ShieldCheck size={13} /> Verified
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                name="edurisk_reg_email"
                autoComplete="off"
                readOnly={!allowInput}
                onFocus={() => setAllowInput(true)}
                required
                disabled={Boolean(verificationToken)}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="student@university.edu"
                className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 disabled:opacity-60"
              />
              {!verificationToken && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || cooldown > 0}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={sendingOtp ? 'animate-spin' : ''} />
                  {sendingOtp ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : otpSentInfo ? 'Resend OTP' : 'Send Email OTP'}
                </button>
              )}
            </div>

            {otpSentInfo && !verificationToken && (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP from email"
                  className="flex-1 px-3.5 py-2.5 bg-black/50 border border-cyan-500/30 rounded-xl text-sm text-white font-mono tracking-[0.25em] placeholder:tracking-normal placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3.5">
            <div className={`grid grid-cols-1 ${needsInitialAdmin ? '' : 'sm:grid-cols-2'} gap-3.5`}>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Password *</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="edurisk_reg_password"
                    autoComplete="new-password"
                    readOnly={!allowInput}
                    onFocus={() => setAllowInput(true)}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="e.g. EduRisk@2026"
                    className="w-full pl-9 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {!needsInitialAdmin && form.role === 'STUDENT' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Student ID (Optional)</label>
                  <input
                    value={form.studentIdentifier}
                    onChange={(e) => setForm({ ...form, studentIdentifier: e.target.value })}
                    placeholder="Auto e.g. STU1050"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600"
                  />
                </div>
              )}
              {!needsInitialAdmin && form.role === 'LECTURER' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Employee ID (Optional)</label>
                  <input
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="Auto e.g. LEC105"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600"
                  />
                </div>
              )}
            </div>
            <PasswordStrengthMeter password={form.password} />
          </div>

          {!needsInitialAdmin && form.role === 'STUDENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Major</label>
                <select
                  value={form.major}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                >
                  {MAJORS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Year</label>
                <select
                  value={form.yearOfStudy}
                  onChange={(e) => setForm({ ...form, yearOfStudy: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                >
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!needsInitialAdmin && form.role === 'LECTURER' && (
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
              >
                {MAJORS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !verificationToken || !isStrongPassword(form.password)}
            className="w-full py-3.5 px-4 flex items-center justify-center gap-2 bg-white text-black hover:bg-slate-200 rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all disabled:opacity-40 cursor-pointer"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                {needsInitialAdmin
                  ? 'Create Administrator Account'
                  : form.role === 'LECTURER'
                  ? 'Complete Lecturer Registration'
                  : 'Complete Student Registration'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
