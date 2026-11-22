import React, { useEffect, useState } from 'react';
import { Save, Settings, Lock, Cpu, RefreshCw, CheckCircle2, Database } from 'lucide-react';
import Layout from '../components/Layout';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import api from '../services/api';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncingMl, setSyncingMl] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    api.get('/settings').then((res) => setSettings(res.data.settings)).catch(console.error);
    api.get('/dashboard/summary').then((res) => setHealth(res.data.mlService)).catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.put('/settings', settings);
      setSettings(res.data.settings);
      setMessage({ type: 'success', text: 'Academic settings updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleBatchSync = async () => {
    setSyncingMl(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/predictions/batch');
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'ML batch sync failed' });
    } finally {
      setSyncingMl(false);
    }
  };

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

  return (
    <Layout
      title="Academic Settings & System Administration"
      subtitle="Configure university-wide semester thresholds, ML synchronization, and administrator security"
    >
      {message.text && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
            message.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Institutional Academic Settings */}
        {!settings ? (
          <div className="lg:col-span-2 p-10 text-center text-slate-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Settings size={18} className="text-indigo-400" /> Institutional Academic Configuration
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Institution Name</label>
                <input
                  value={settings.institution_name || ''}
                  onChange={(e) => setSettings({ ...settings, institution_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Active Semester</label>
                <input
                  value={settings.current_semester || ''}
                  onChange={(e) => setSettings({ ...settings, current_semester: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Attendance Warning Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.attendance_warning_threshold ?? 75}
                  onChange={(e) => setSettings({ ...settings, attendance_warning_threshold: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">GPA Warning Threshold (0.0–4.0)</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.1"
                  value={settings.gpa_warning_threshold ?? 2.5}
                  onChange={(e) => setSettings({ ...settings, gpa_warning_threshold: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Medium Risk Threshold (0.0–1.0)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.medium_risk_threshold ?? 0.35}
                  onChange={(e) => setSettings({ ...settings, medium_risk_threshold: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">High Risk Threshold (0.0–1.0)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.high_risk_threshold ?? 0.65}
                  onChange={(e) => setSettings({ ...settings, high_risk_threshold: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                <Save size={15} /> {saving ? 'Saving...' : 'Save Academic Settings'}
              </button>
            </div>
          </form>
        )}

        {/* Right Column: System Health + Admin Password */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu size={17} className="text-cyan-400" />
              System & ML Engine Status
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-black/30 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Cpu size={13} /> FastAPI ML Service</span>
                <span className={health?.available ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                  {health?.available ? 'Online' : 'Offline / Fallback'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Database size={13} /> Active ML Model</span>
                <span className="text-white font-semibold">{health?.selected_model || 'Logistic Regression'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBatchSync}
              disabled={syncingMl}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw size={14} className={syncingMl ? 'animate-spin' : ''} />
              {syncingMl ? 'Running University-Wide ML Sync...' : 'Sync All Student Predictions (ML)'}
            </button>
          </div>

          <form onSubmit={handlePasswordChange} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-3.5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Lock size={17} className="text-indigo-400" />
              Admin Account Password
            </h3>

            {pwFeedback.text && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  pwFeedback.type === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-300'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                }`}
              >
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
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
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
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
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
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingPw}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              {savingPw ? 'Updating...' : 'Update Admin Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AdminSettingsPage;
