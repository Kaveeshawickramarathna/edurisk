import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  AlertTriangle,
  Save,
  UserPlus,
  X,
  ArrowRight,
  CheckCircle2,
  TableProperties,
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const LecturerCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [records, setRecords] = useState([]);
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Enroll student modal
  const [enrollCourse, setEnrollCourse] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await api.get('/courses');
      const list = res.data.courses || [];
      setCourses(list);
      setSelectedCourseId((prev) => prev || (list[0]?.id ?? null));
    } catch (err) {
      console.error('Failed to load lecturer courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadCourseRecords = useCallback(async (cid) => {
    if (!cid) return;
    setLoadingRecords(true);
    setDirtyIds(new Set());
    try {
      const res = await api.get('/academic-records', { params: { courseId: cid } });
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to load course gradebook:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseRecords(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseRecords]);

  const handleCellChange = (enrollmentId, field, value) => {
    setRecords((prev) =>
      prev.map((row) => (row.enrollment_id === enrollmentId ? { ...row, [field]: value } : row))
    );
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(enrollmentId);
      return next;
    });
  };

  const handleSaveBulk = async () => {
    const toSave = dirtyIds.size > 0
      ? records.filter((r) => dirtyIds.has(r.enrollment_id))
      : records;

    if (toSave.length === 0) return;
    setSavingBulk(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.put('/academic-records/bulk', {
        autoPredict: true,
        records: toSave.map((r) => ({
          enrollment_id: r.enrollment_id,
          attendance_percentage: Number(r.attendance_percentage),
          assignment_score: Number(r.assignment_score),
          quiz_score: Number(r.quiz_score),
          previous_gpa: Number(r.previous_gpa),
          missed_submissions: Number(r.missed_submissions),
          lms_activity_score: Number(r.lms_activity_score),
          notes: r.notes || '',
        })),
      });
      setFeedback({ type: 'success', text: res.data.message });
      setDirtyIds(new Set());
      await Promise.all([loadCourses(), loadCourseRecords(selectedCourseId)]);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to save gradebook changes' });
    } finally {
      setSavingBulk(false);
    }
  };

  const openEnrollModal = async (course) => {
    setEnrollCourse(course);
    setSelectedStudentId('');
    try {
      const res = await api.get(`/courses/${course.id}/available-students`);
      setAvailableStudents(res.data.students || []);
    } catch {
      setAvailableStudents([]);
    }
  };

  const handleConfirmEnroll = async (e) => {
    e.preventDefault();
    if (!enrollCourse || !selectedStudentId) return;
    setEnrolling(true);
    try {
      await api.post(`/courses/${enrollCourse.id}/enroll`, { studentId: Number(selectedStudentId) });
      setFeedback({ type: 'success', text: `Student enrolled into ${enrollCourse.code} successfully.` });
      setEnrollCourse(null);
      await Promise.all([loadCourses(), loadCourseRecords(selectedCourseId)]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <Layout
      title="My Courses & Quick Gradebook"
      subtitle="Select an assigned module to enter or update student performance records in bulk and automatically refresh ML risk indicators"
    >
      {feedback.text && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 size={16} />}
          {feedback.text}
        </div>
      )}

      {/* Assigned Course Cards */}
      {loadingCourses ? (
        <div className="p-10 text-center text-slate-400">Loading your assigned courses...</div>
      ) : courses.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/60 border border-white/5 rounded-2xl text-slate-400">
          No courses are currently assigned to your lecturer account. Contact the Administrator.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => {
              const isSelected = c.id === selectedCourseId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCourseId(c.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500/50 shadow-lg shadow-indigo-600/10'
                      : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{c.code}</span>
                        <h3 className="text-base font-bold text-white mt-0.5">{c.name}</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-slate-300">
                        {c.credits} cr
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="p-2 rounded-xl bg-black/30">
                        <p className="text-[10px] text-slate-400">Students</p>
                        <p className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                          <Users size={12} className="text-indigo-400" /> {c.enrolled_count}
                        </p>
                      </div>
                      <div className="p-2 rounded-xl bg-black/30">
                        <p className="text-[10px] text-slate-400">Avg Att.</p>
                        <p className="text-sm font-bold text-cyan-300 mt-0.5">{c.avg_attendance}%</p>
                      </div>
                      <div className="p-2 rounded-xl bg-black/30">
                        <p className="text-[10px] text-slate-400">High Risk</p>
                        <p className={`text-sm font-bold flex items-center justify-center gap-1 mt-0.5 ${c.high_risk_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {c.high_risk_count > 0 && <AlertTriangle size={12} />} {c.high_risk_count}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <BookOpen size={13} /> {isSelected ? 'Viewing Gradebook' : 'Click to open gradebook'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEnrollModal(c);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 text-xs font-semibold cursor-pointer"
                    >
                      <UserPlus size={12} /> Enroll
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Course Gradebook */}
          {activeCourse && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TableProperties size={18} className="text-indigo-400" />
                    {activeCourse.code} — {activeCourse.name} Gradebook
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Edit academic indicators inline across students ({dirtyIds.size} unsaved change{dirtyIds.size === 1 ? '' : 's'})
                  </p>
                </div>

                <button
                  onClick={handleSaveBulk}
                  disabled={savingBulk || records.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={14} />
                  {savingBulk
                    ? 'Saving & Running ML...'
                    : dirtyIds.size > 0
                    ? `Save ${dirtyIds.size} Modified & Refresh ML`
                    : 'Save All & Refresh ML'}
                </button>
              </div>

              {loadingRecords ? (
                <div className="p-10 text-center text-slate-400 text-sm">Loading course gradebook...</div>
              ) : records.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  No students enrolled in {activeCourse.code} yet. Click "Enroll" above to add students.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-2">Attendance (%)</th>
                        <th className="py-3 px-2">Assignment (%)</th>
                        <th className="py-3 px-2">Quiz (%)</th>
                        <th className="py-3 px-2">Prev GPA</th>
                        <th className="py-3 px-2">Missed</th>
                        <th className="py-3 px-2">LMS (/100)</th>
                        <th className="py-3 px-3">Remarks</th>
                        <th className="py-3 px-4 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {records.map((r) => {
                        const isDirty = dirtyIds.has(r.enrollment_id);
                        return (
                          <tr
                            key={r.enrollment_id}
                            className={isDirty ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}
                          >
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <p className="font-semibold text-white">
                                {r.first_name} {r.last_name}
                              </p>
                              <p className="text-[11px] text-slate-400">{r.student_identifier}</p>
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={r.attendance_percentage ?? 0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'attendance_percentage', e.target.value)}
                                className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={r.assignment_score ?? 0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'assignment_score', e.target.value)}
                                className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={r.quiz_score ?? 0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'quiz_score', e.target.value)}
                                className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="4"
                                step="0.05"
                                value={r.previous_gpa ?? 3.0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'previous_gpa', e.target.value)}
                                className="w-18 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="50"
                                value={r.missed_submissions ?? 0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'missed_submissions', e.target.value)}
                                className="w-16 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={r.lms_activity_score ?? 0}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'lms_activity_score', e.target.value)}
                                className="w-20 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={r.notes || ''}
                                onChange={(e) => handleCellChange(r.enrollment_id, 'notes', e.target.value)}
                                placeholder="Remarks..."
                                className="w-36 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <Link
                                to={`/lecturer/students/${r.student_id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold"
                              >
                                Risk Details <ArrowRight size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Enroll Student Modal */}
      {enrollCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Enroll Student in {enrollCourse.code}</h3>
              <button onClick={() => setEnrollCourse(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {availableStudents.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">All active students are already enrolled in this course.</p>
            ) : (
              <form onSubmit={handleConfirmEnroll} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Select Student</label>
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    <option value="">Choose a student...</option>
                    {availableStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.student_identifier} — {s.first_name} {s.last_name} ({s.major})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrollCourse(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enrolling}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
                  >
                    {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LecturerCoursesPage;
