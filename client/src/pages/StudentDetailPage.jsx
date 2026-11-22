import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  Save,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { RiskBadge, StatusBadge } from '../components/RiskBadge';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'FOLLOW_UP_NEEDED', 'COMPLETED'];

const StudentDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const basePath = user?.role === 'ADMIN' ? '/admin' : '/lecturer';

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [recordForms, setRecordForms] = useState({});
  const [savingEnrollmentId, setSavingEnrollmentId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [intForm, setIntForm] = useState({
    actionType: 'Academic Advising',
    notes: '',
    status: 'PENDING',
    followUpDate: '',
    studentVisible: true,
  });
  const [submittingInt, setSubmittingInt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    studentIdentifier: '',
    major: 'Computer Science',
    yearOfStudy: 1,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Add Course + Academic Record modal (GPA, Attendance, Assignments, Quizzes, etc.)
  const [courses, setCourses] = useState([]);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [addingRecord, setAddingRecord] = useState(false);
  const [newRecForm, setNewRecForm] = useState({
    courseId: '',
    attendance_percentage: 80,
    assignment_score: 75,
    quiz_score: 70,
    previous_gpa: 3.0,
    missed_submissions: 0,
    lms_activity_score: 70,
    notes: '',
  });

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [res, crsRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get('/courses'),
      ]);
      setDetail(res.data);
      setCourses(crsRes.data.courses || []);
      const initialForms = {};
      (res.data.academicRecords || []).forEach((r) => {
        initialForms[r.enrollment_id] = {
          attendance_percentage: r.attendance_percentage ?? 0,
          assignment_score: r.assignment_score ?? 0,
          quiz_score: r.quiz_score ?? 0,
          previous_gpa: r.previous_gpa ?? 3.0,
          missed_submissions: r.missed_submissions ?? 0,
          lms_activity_score: r.lms_activity_score ?? 0,
          notes: r.notes || '',
        };
      });
      setRecordForms(initialForms);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Unable to load student profile' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRunPrediction = async () => {
    setPredicting(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.post(`/predictions/student/${id}`);
      setFeedback({ type: 'success', text: 'Updated ML risk estimate and contributing indicators.' });
      await loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Prediction failed' });
    } finally {
      setPredicting(false);
    }
  };

  const handleFieldChange = (enrollmentId, field, value) => {
    setRecordForms((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        [field]: value,
      },
    }));
  };

  const handleSaveRecord = async (enrollmentId) => {
    setSavingEnrollmentId(enrollmentId);
    setFeedback({ type: '', text: '' });
    try {
      const payload = { ...recordForms[enrollmentId], autoPredict: true };
      await api.put(`/academic-records/${enrollmentId}`, payload);
      setFeedback({ type: 'success', text: 'Academic record saved and risk indicator recalculated.' });
      await loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to save academic record' });
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  const handleAddIntervention = async (e) => {
    e.preventDefault();
    setSubmittingInt(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.post('/interventions', {
        studentId: Number(id),
        ...intForm,
      });
      setIntForm({ actionType: 'Academic Advising', notes: '', status: 'PENDING', followUpDate: '', studentVisible: true });
      setFeedback({ type: 'success', text: 'Support intervention recorded successfully.' });
      await loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to add intervention' });
    } finally {
      setSubmittingInt(false);
    }
  };

  const handleUpdateInterventionStatus = async (intId, status) => {
    try {
      await api.put(`/interventions/${intId}`, { status });
      await loadDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteIntervention = async (intId) => {
    if (!window.confirm('Delete this intervention entry?')) return;
    try {
      await api.delete(`/interventions/${intId}`);
      await loadDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete intervention');
    }
  };

  const prefillFromSuggestion = (action) => {
    setIntForm((prev) => ({
      ...prev,
      actionType: action.category || 'Early Support',
      notes: `${action.title}: ${action.description}`,
    }));
  };

  const openEditProfileModal = () => {
    if (!detail?.student) return;
    setProfileForm({
      firstName: detail.student.first_name || '',
      lastName: detail.student.last_name || '',
      studentIdentifier: detail.student.student_identifier || '',
      major: detail.student.major || 'Computer Science',
      yearOfStudy: detail.student.year_of_study || 1,
    });
    setShowEditProfile(true);
  };

  const handleSaveStudentProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.put(`/students/${id}`, profileForm);
      setShowEditProfile(false);
      setFeedback({ type: 'success', text: 'Student profile updated successfully.' });
      await loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to update student profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddCourseRecord = async (e) => {
    e.preventDefault();
    if (!newRecForm.courseId) return;
    setAddingRecord(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.post(`/courses/${newRecForm.courseId}/enroll`, {
        studentId: Number(id),
        attendance_percentage: Number(newRecForm.attendance_percentage),
        assignment_score: Number(newRecForm.assignment_score),
        quiz_score: Number(newRecForm.quiz_score),
        previous_gpa: Number(newRecForm.previous_gpa),
        missed_submissions: Number(newRecForm.missed_submissions),
        lms_activity_score: Number(newRecForm.lms_activity_score),
        notes: newRecForm.notes,
        autoPredict: true,
      });
      setShowAddRecord(false);
      setNewRecForm({
        courseId: '',
        attendance_percentage: 80,
        assignment_score: 75,
        quiz_score: 70,
        previous_gpa: 3.0,
        missed_submissions: 0,
        lms_activity_score: 70,
        notes: '',
      });
      setFeedback({ type: 'success', text: 'Course enrolled, academic details saved, and ML risk indicator updated!' });
      await loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to add academic record' });
    } finally {
      setAddingRecord(false);
    }
  };

  const student = detail?.student;
  const pred = detail?.latestPrediction;
  const factors = Array.isArray(pred?.contributing_factors) ? pred.contributing_factors : [];
  const actions = Array.isArray(pred?.suggested_actions) ? pred.suggested_actions : [];
  const enrolledCourseIds = new Set((detail?.academicRecords || []).map((r) => r.course_id));
  const unenrolledCourses = courses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <Layout
      title={student ? `${student.first_name} ${student.last_name}` : 'Student Profile'}
      subtitle={student ? `${student.student_identifier} · ${student.major} · Year ${student.year_of_study} · ${student.email}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to={`${basePath}/students`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          {user?.role === 'ADMIN' && student && (
            <button
              onClick={openEditProfileModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <Pencil size={13} /> Edit Profile
            </button>
          )}
          {student && unenrolledCourses.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setNewRecForm((prev) => ({ ...prev, courseId: String(unenrolledCourses[0].id) }));
                setShowAddRecord(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 cursor-pointer"
            >
              <Plus size={14} /> Add GPA &amp; Attendance
            </button>
          )}
          <button
            onClick={handleRunPrediction}
            disabled={predicting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 disabled:opacity-60 cursor-pointer"
          >
            <Brain size={14} />
            {predicting ? 'Estimating...' : 'Run ML Risk Prediction'}
          </button>
        </div>
      }
    >
      {feedback.text && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm ${
            feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading || !detail ? (
        <div className="p-10 text-center text-slate-400">Loading student record...</div>
      ) : (
        <>
          <DecisionSupportBanner isDemo={pred?.is_demo ?? true} modelName={pred?.model_name} compact />

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Risk Indicator</p>
              <div className="mt-2">
                <RiskBadge level={pred?.risk_level || 'UNASSESSED'} probability={pred?.probability} />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Avg Attendance</p>
              <p className={`text-2xl font-bold mt-1 ${detail.summary.avg_attendance < 75 ? 'text-red-400' : 'text-white'}`}>
                {detail.summary.avg_attendance}%
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Assignments</p>
              <p className="text-2xl font-bold text-white mt-1">{detail.summary.avg_assignment}%</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Quizzes</p>
              <p className="text-2xl font-bold text-white mt-1">{detail.summary.avg_quiz}%</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Previous GPA</p>
              <p className="text-2xl font-bold text-white mt-1">{detail.summary.avg_gpa}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400">Missed Tasks</p>
              <p className={`text-2xl font-bold mt-1 ${detail.summary.avg_missed > 2 ? 'text-amber-400' : 'text-white'}`}>
                {detail.summary.avg_missed}
              </p>
            </div>
          </div>

          {/* Risk Explanation & Suggested Support Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <AlertTriangle size={17} className="text-amber-400" />
                  Associated Risk Indicators (Non-Causal Explanation)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {pred?.explanation_summary || 'Run a prediction to view indicator associations.'}
                </p>
              </div>

              <div className="space-y-3">
                {factors.map((f) => {
                  const pct = Math.min(100, Math.round((Number(f.association_score) || 0) * 180));
                  const isConcern = f.status === 'CONCERN';
                  return (
                    <div key={f.feature} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-white">{f.label}</span>
                        <span className={isConcern ? 'text-red-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                          {f.value}{f.unit === '%' ? '%' : ` ${f.unit}`} · {f.note}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isConcern ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(8, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles size={17} className="text-cyan-400" />
                  Suggested Early-Support Actions
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Use in Form" to assign a suggested follow-up directly to this student
                </p>
              </div>

              <div className="space-y-3">
                {actions.map((act, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {act.category}
                        </span>
                        <h4 className="text-sm font-semibold text-white mt-1.5">{act.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => prefillFromSuggestion(act)}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold cursor-pointer"
                      >
                        Use in Form
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{act.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Academic Performance Management */}
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Academic Performance Records (GPA, Attendance &amp; Marks)</h3>
                <p className="text-xs text-slate-400">
                  Add or update attendance, assignments, quizzes, GPA, missed submissions, and LMS activity (saving automatically refreshes the ML risk estimate)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewRecForm((prev) => ({
                    ...prev,
                    courseId: unenrolledCourses[0] ? String(unenrolledCourses[0].id) : '',
                  }));
                  setShowAddRecord(true);
                }}
                disabled={unenrolledCourses.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-40 cursor-pointer"
                title={unenrolledCourses.length === 0 ? 'Student is already enrolled in all available courses' : 'Enroll in a course and enter GPA/Attendance/Marks'}
              >
                <Plus size={14} /> Add Course &amp; Marks (GPA / Attendance)
              </button>
            </div>

            {detail.academicRecords.length === 0 ? (
              <div className="p-6 rounded-2xl bg-black/30 border border-dashed border-white/10 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  No academic records entered yet for {student?.first_name}.
                </p>
                {unenrolledCourses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewRecForm((prev) => ({ ...prev, courseId: String(unenrolledCourses[0].id) }));
                      setShowAddRecord(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus size={14} /> Add First Course, GPA &amp; Attendance
                  </button>
                ) : (
                  <p className="text-xs text-slate-400">
                    Create a course first in Courses &amp; Enrollment before adding academic records.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {detail.academicRecords.map((rec) => {
                  const form = recordForms[rec.enrollment_id] || {};
                  return (
                    <div key={rec.enrollment_id} className="p-5 rounded-2xl bg-black/30 border border-white/10 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-indigo-400">{rec.course_code}</span>
                          <h4 className="text-sm font-semibold text-white">{rec.course_name}</h4>
                          <p className="text-xs text-slate-400">
                            Semester {rec.semester} · {rec.credits} Credits
                            {rec.lecturer_first_name ? ` · Lecturer: ${rec.lecturer_first_name} ${rec.lecturer_last_name}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSaveRecord(rec.enrollment_id)}
                          disabled={savingEnrollmentId === rec.enrollment_id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                        >
                          <Save size={14} />
                          {savingEnrollmentId === rec.enrollment_id ? 'Saving...' : 'Save & Recalculate'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Attendance (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={form.attendance_percentage ?? 0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'attendance_percentage', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Assignments (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={form.assignment_score ?? 0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'assignment_score', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Quizzes (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={form.quiz_score ?? 0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'quiz_score', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Previous GPA (0-4)</label>
                          <input
                            type="number"
                            min="0"
                            max="4"
                            step="0.01"
                            value={form.previous_gpa ?? 3.0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'previous_gpa', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Missed Tasks</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={form.missed_submissions ?? 0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'missed_submissions', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">LMS Activity (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={form.lms_activity_score ?? 0}
                            onChange={(e) => handleFieldChange(rec.enrollment_id, 'lms_activity_score', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Lecturer Academic Notes</label>
                        <input
                          type="text"
                          value={form.notes || ''}
                          onChange={(e) => handleFieldChange(rec.enrollment_id, 'notes', e.target.value)}
                          placeholder="Optional remarks on progress, lab attendance, or exam prep..."
                          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Early Support & Interventions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleAddIntervention} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus size={17} className="text-indigo-400" />
                Record New Intervention
              </h3>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Support Action Type</label>
                <input
                  required
                  value={intForm.actionType}
                  onChange={(e) => setIntForm({ ...intForm, actionType: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select
                    value={intForm.status}
                    onChange={(e) => setIntForm({ ...intForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={intForm.followUpDate}
                    onChange={(e) => setIntForm({ ...intForm, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Intervention Notes *</label>
                <textarea
                  required
                  rows={4}
                  value={intForm.notes}
                  onChange={(e) => setIntForm({ ...intForm, notes: e.target.value })}
                  placeholder="Describe support plan, referrals, or follow-up steps..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={intForm.studentVisible}
                  onChange={(e) => setIntForm({ ...intForm, studentVisible: e.target.checked })}
                  className="rounded border-white/20"
                />
                Share this support action on the student's portal
              </label>

              <button
                type="submit"
                disabled={submittingInt}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {submittingInt ? 'Saving...' : 'Assign Intervention'}
              </button>
            </form>

            <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <CheckCircle2 size={17} className="text-emerald-400" />
                Intervention History ({detail.interventions.length})
              </h3>

              {detail.interventions.length === 0 ? (
                <p className="text-sm text-slate-400">No interventions recorded for this student yet.</p>
              ) : (
                <div className="space-y-3">
                  {detail.interventions.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{item.action_type}</span>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateInterventionStatus(item.id, e.target.value)}
                            className="px-2.5 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDeleteIntervention(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{item.notes}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        {item.lecturer_first_name && (
                          <span>By: {item.lecturer_first_name} {item.lecturer_last_name}</span>
                        )}
                        {item.follow_up_date && (
                          <span className="inline-flex items-center gap-1 text-cyan-300">
                            <Calendar size={12} /> Follow-up: {String(item.follow_up_date).slice(0, 10)}
                          </span>
                        )}
                        <span>{item.student_visible ? 'Visible to student' : 'Staff internal only'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Course + Academic Record Modal */}
      {showAddRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Add Academic Details (GPA &amp; Attendance)</h3>
                <p className="text-xs text-slate-400">
                  For {student?.first_name} {student?.last_name} ({student?.student_identifier})
                </p>
              </div>
              <button onClick={() => setShowAddRecord(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCourseRecord} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Course / Subject *</label>
                <select
                  required
                  value={newRecForm.courseId}
                  onChange={(e) => setNewRecForm({ ...newRecForm, courseId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                >
                  <option value="">Choose a course...</option>
                  {unenrolledCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.credits} credits)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Attendance (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.5"
                    value={newRecForm.attendance_percentage}
                    onChange={(e) => setNewRecForm({ ...newRecForm, attendance_percentage: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Assignments (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.5"
                    value={newRecForm.assignment_score}
                    onChange={(e) => setNewRecForm({ ...newRecForm, assignment_score: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Quizzes (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.5"
                    value={newRecForm.quiz_score}
                    onChange={(e) => setNewRecForm({ ...newRecForm, quiz_score: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Previous GPA (0-4) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="4"
                    step="0.01"
                    value={newRecForm.previous_gpa}
                    onChange={(e) => setNewRecForm({ ...newRecForm, previous_gpa: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Missed Tasks</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={newRecForm.missed_submissions}
                    onChange={(e) => setNewRecForm({ ...newRecForm, missed_submissions: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">LMS Activity (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={newRecForm.lms_activity_score}
                    onChange={(e) => setNewRecForm({ ...newRecForm, lms_activity_score: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Academic Notes (Optional)</label>
                <input
                  type="text"
                  value={newRecForm.notes}
                  onChange={(e) => setNewRecForm({ ...newRecForm, notes: e.target.value })}
                  placeholder="Optional remarks on progress or attendance..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRecord(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingRecord}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {addingRecord ? 'Saving & Predicting...' : 'Save Details & Run ML'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Edit Student Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edit Student Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveStudentProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">First Name *</label>
                  <input
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Last Name *</label>
                  <input
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Student Identifier *</label>
                <input
                  required
                  value={profileForm.studentIdentifier}
                  onChange={(e) => setProfileForm({ ...profileForm, studentIdentifier: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Major</label>
                  <input
                    required
                    value={profileForm.major}
                    onChange={(e) => setProfileForm({ ...profileForm, major: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Year of Study</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={profileForm.yearOfStudy}
                    onChange={(e) => setProfileForm({ ...profileForm, yearOfStudy: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentDetailPage;
