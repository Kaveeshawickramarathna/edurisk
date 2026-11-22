import React, { useEffect, useState } from 'react';
import { Lock, BookOpen, CheckCircle2, ShieldCheck } from 'lucide-react';
import Layout from '../components/Layout';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const LecturerProfilePage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    api
      .get('/courses')
      .then((res) => setCourses(res.data.courses || []))
      .catch(console.error);
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwFeedback({ type: '', text: '' });
    if (!isStrongPassword(pwForm.newPassword)) {
      setPwFeedback({ type: 'error', text: 'New password must be strong (8+ chars, uppercase, lowercase, number, special char).' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSavingPw(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwFeedback({ type: 'success', text: res.data.message });
    } catch (err) {
      setPwFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to update password' });
    } finally {
      setSavingPw(false);
    }
  };

  const profile = user?.profile;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : 'Lecturer';
  const initials = profile ? `${profile.first_name[0]}${profile.last_name[0]}` : 'LC';

  return (
    <Layout title="Lecturer Profile & Account Security" subtitle="Review your assigned teaching scope and manage account credentials">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-cyan-500/20">
              {initials}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{fullName}</h3>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
              <p className="text-[11px] text-slate-400">Employee ID</p>
              <p className="text-sm font-bold text-white font-mono mt-0.5">{profile?.employee_id || 'N/A'}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
              <p className="text-[11px] text-slate-400">Department</p>
              <p className="text-sm font-bold text-white mt-0.5">{profile?.department || 'Computing'}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-indigo-400" /> Assigned Modules ({courses.length})
            </p>
            {courses.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-indigo-300">{c.code}</span>
                  <span className="text-white ml-2">{c.name}</span>
                </div>
                <span className="text-slate-400">{c.enrolled_count} students</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
            <p className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-cyan-400" /> Role-Scoped Privacy Access
            </p>
            <p className="text-xs text-cyan-200/80 leading-relaxed">
              Your lecturer account is scoped strictly to students enrolled in your assigned modules in accordance with university privacy policy.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4 h-fit">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Lock size={17} className="text-indigo-400" />
            Update Account Password
          </h3>

          {pwFeedback.text && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                pwFeedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}
            >
              {pwFeedback.type === 'success' && <CheckCircle2 size={14} />}
              {pwFeedback.text}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Current Password</label>
            <input
              type="password"
              required
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">New Strong Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
            />
            <PasswordStrengthMeter password={pwForm.newPassword} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={savingPw}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
          >
            {savingPw ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default LecturerProfilePage;
