import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, GraduationCap, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import api from '../services/api';

const StudentProfilePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    api
      .get('/students/me')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const student = data?.student;
  const records = data?.academicRecords || [];
  const totalCredits = records.reduce((acc, r) => acc + Number(r.credits || 0), 0);

  return (
    <Layout title="My Profile & Account Security" subtitle="View your university enrollment summary and manage your password">
      {loading || !student ? (
        <div className="p-12 text-center text-slate-400">Loading profile...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Profile Card */}
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-500/25">
                {student.first_name[0]}{student.last_name[0]}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{student.first_name} {student.last_name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{student.email}</span>
                  {student.email_verified && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                      Email Verified ✓
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[11px] text-slate-400">Student ID</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{student.student_identifier}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[11px] text-slate-400">Year of Study</p>
                <p className="text-sm font-bold text-white mt-0.5">Year {student.year_of_study}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[11px] text-slate-400">Academic Major</p>
                <p className="text-sm font-bold text-white mt-0.5">{student.major}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[11px] text-slate-400">Enrolled Load</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {records.length} Courses ({totalCredits} Credits)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
              <p className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-indigo-400" /> Data Privacy & Responsible AI
              </p>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                EduRisk evaluates only approved academic progress metrics (attendance, assignments, quizzes, previous GPA, submission timeliness, and LMS activity). No sensitive personal attributes are used, and only you and your authorized lecturers/administrators can view your records.
              </p>
            </div>
          </div>

          {/* Security / Password Change */}
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

            <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
              <GraduationCap size={14} className="text-cyan-400" />
              <span>Need to update your major or enrollment details? Contact the university administrator.</span>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default StudentProfilePage;
