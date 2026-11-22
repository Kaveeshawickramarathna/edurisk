import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrainCircuit,
  Mail,
  Lock,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import api from '../services/api';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowInput, setAllowInput] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await api.post('/auth/otp/send', {
        email: email.trim(),
        purpose: 'PASSWORD_RESET',
      });
      setOtpSent(true);
      setOtpCode('');
      setVerificationToken('');
      setVerifiedEmail('');
      setCooldown(30);
      setStatusMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to send reset OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code from your email.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.post('/auth/otp/verify', {
        email: email.trim(),
        otpCode: otpCode.trim(),
      });
      setVerificationToken(res.data.verificationToken);
      setVerifiedEmail(res.data.email);
      setStatusMsg('Email verified! Now set your new strong password below.');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid OTP code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    if (!verificationToken) {
      setErrorMsg('Please verify your email OTP first.');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setErrorMsg('New password must be strong (8+ chars, uppercase, lowercase, number, and special character).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: verifiedEmail || email.trim(),
        verificationToken,
        newPassword,
      });
      navigate('/login', {
        replace: true,
        state: { successMessage: res.data.message || 'Password reset successfully! Please sign in.' },
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#030712] px-4 py-10">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full filter blur-[110px]" />
      <div className="absolute bottom-[-15%] right-[-5%] w-96 h-96 bg-cyan-500/25 rounded-full filter blur-[110px]" />

      <div className="relative z-10 w-full max-w-md p-7 sm:p-8 rounded-[2rem] bg-slate-900/75 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <KeyRound size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">Reset Password</h1>
              <p className="text-xs text-slate-400">Verify your email via OTP to set a new password</p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
          >
            <ArrowLeft size={14} /> Login
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

        <form onSubmit={handleResetPassword} autoComplete="off" className="space-y-4">
          {/* Step 1 & 2: Email + OTP */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail size={13} /> Registered Email Address *
              </label>
              {verificationToken && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <ShieldCheck size={13} /> Verified
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                name="edurisk_reset_email"
                autoComplete="off"
                readOnly={!allowInput}
                onFocus={() => setAllowInput(true)}
                required
                disabled={Boolean(verificationToken)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
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
                  {sendingOtp ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : otpSent ? 'Resend OTP' : 'Send OTP'}
                </button>
              )}
            </div>

            {otpSent && !verificationToken && (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="flex-1 px-3.5 py-2.5 bg-black/50 border border-cyan-500/30 rounded-xl text-sm text-white font-mono tracking-[0.25em] placeholder:tracking-normal placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            )}
          </div>

          {/* Step 3: New Strong Password */}
          {verificationToken && (
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  New Strong Password *
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="edurisk_reset_pw"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="edurisk_reset_confirm_pw"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !verificationToken || !isStrongPassword(newPassword) || newPassword !== confirmPassword}
            className="w-full py-3.5 px-4 flex items-center justify-center gap-2 bg-white text-black hover:bg-slate-200 rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all disabled:opacity-40 cursor-pointer"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Save New Password
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <BrainCircuit size={13} className="text-indigo-400" /> EduRisk Secure Account Recovery
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
