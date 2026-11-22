import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, CheckSquare, Square, Send, Calendar, LifeBuoy, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { StatusBadge } from '../components/RiskBadge';
import api from '../services/api';

const SUPPORT_TOPICS = [
  'Academic Advising',
  'Attendance & Catch-up Plan',
  'Assignment & Rubric Help',
  'Exam & Quiz Preparation',
  'Time Management & Study Plan',
];

const StudentSupportPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedActions, setCompletedActions] = useState({});
  const [reqForm, setReqForm] = useState({
    topic: SUPPORT_TOPICS[0],
    courseId: '',
    preferredDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/students/me');
      setData(res.data);
      const stuKey = `edurisk_checklist_${res.data?.student?.id}`;
      try {
        const saved = JSON.parse(localStorage.getItem(stuKey) || '{}');
        setCompletedActions(saved);
      } catch {
        setCompletedActions({});
      }
    } catch (err) {
      console.error('Failed to load student support plan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAction = (key) => {
    const stuKey = `edurisk_checklist_${data?.student?.id}`;
    setCompletedActions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(stuKey, JSON.stringify(next));
      return next;
    });
  };

  const handleRequestSupport = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.post('/interventions/request', {
        topic: reqForm.topic,
        courseId: reqForm.courseId || null,
        preferredDate: reqForm.preferredDate || null,
        notes: reqForm.notes,
      });
      setReqForm({ topic: SUPPORT_TOPICS[0], courseId: '', preferredDate: '', notes: '' });
      setFeedback({ type: 'success', text: 'Your support request has been sent to your lecturer/advisor!' });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to submit support request' });
    } finally {
      setSubmitting(false);
    }
  };

  const pred = data?.latestPrediction;
  const actions = Array.isArray(pred?.suggested_actions) ? pred.suggested_actions : [];
  const interventions = data?.interventions || [];
  const records = data?.academicRecords || [];
  const completedCount = actions.filter((a, i) => completedActions[`${a.title}_${i}`]).length;
  const progressPct = actions.length ? Math.round((completedCount / actions.length) * 100) : 0;

  return (
    <Layout
      title="Learning Support & Early Action Plan"
      subtitle="Track recommended study actions, review lecturer follow-ups, and request academic support anytime"
    >
      {loading || !data ? (
        <div className="p-12 text-center text-slate-400">Loading your support plan...</div>
      ) : (
        <>
          <DecisionSupportBanner isDemo={pred?.is_demo ?? true} modelName={pred?.model_name} compact />

          {feedback.text && (
            <div
              className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
                feedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}
            >
              <CheckCircle2 size={16} />
              {feedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Personal Action Plan Checklist */}
            <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-cyan-400" />
                    Personal Learning Action Checklist
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Check off suggested learning steps as you complete them
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-full">
                  {completedCount} / {actions.length} Completed ({progressPct}%)
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="space-y-3">
                {actions.map((act, idx) => {
                  const key = `${act.title}_${idx}`;
                  const checked = Boolean(completedActions[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleAction(key)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                        checked
                          ? 'bg-emerald-500/10 border-emerald-500/25 opacity-80'
                          : 'bg-white/[0.03] border-white/5 hover:border-indigo-500/30'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square size={20} className="text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                            {act.category}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">Priority: {act.priority}</span>
                        </div>
                        <h4 className={`text-sm font-semibold mt-1.5 ${checked ? 'line-through text-slate-400' : 'text-white'}`}>
                          {act.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{act.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Request Academic Support Form */}
            <form onSubmit={handleRequestSupport} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4 h-fit">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Send size={16} className="text-indigo-400" />
                  Request Lecturer Support
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Need tutoring, advising, or a check-in? Send a request directly to your course lecturer.
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Support Topic</label>
                <select
                  value={reqForm.topic}
                  onChange={(e) => setReqForm({ ...reqForm, topic: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                >
                  {SUPPORT_TOPICS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Related Course (Optional)</label>
                <select
                  value={reqForm.courseId}
                  onChange={(e) => setReqForm({ ...reqForm, courseId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                >
                  <option value="">General Academic Advising</option>
                  {records.map((r) => (
                    <option key={r.course_id} value={r.course_id}>
                      {r.course_code} — {r.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Preferred Follow-Up Date</label>
                <input
                  type="date"
                  value={reqForm.preferredDate}
                  onChange={(e) => setReqForm({ ...reqForm, preferredDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Message / Details *</label>
                <textarea
                  required
                  rows={4}
                  value={reqForm.notes}
                  onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })}
                  placeholder="Briefly describe the topic or challenge you would like help with..."
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Sending Request...' : 'Submit Support Request'}
              </button>
            </form>
          </div>

          {/* Shared Lecturer Follow-Ups */}
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <LifeBuoy size={18} className="text-indigo-400" />
              Active Support Sessions & Lecturer Follow-Ups ({interventions.length})
            </h3>
            {interventions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No follow-up interventions are scheduled yet. You can use the form above whenever you want academic support.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interventions.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">{item.action_type}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.notes}</p>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      {item.lecturer_first_name && (
                        <span>Advisor: {item.lecturer_first_name} {item.lecturer_last_name}</span>
                      )}
                      {item.follow_up_date && (
                        <span className="inline-flex items-center gap-1 text-cyan-300">
                          <Calendar size={12} /> Follow-up: {String(item.follow_up_date).slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
};

export default StudentSupportPage;
