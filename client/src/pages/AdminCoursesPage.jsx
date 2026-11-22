import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, UserPlus, BookOpen, X, Pencil, Users, AlertTriangle, UserMinus } from 'lucide-react';
import Layout from '../components/Layout';
import { RiskBadge } from '../components/RiskBadge';
import api from '../services/api';

const EMPTY_COURSE_FORM = {
  code: '',
  name: '',
  department: 'Computer Science',
  credits: 3,
  lecturerId: '',
};

const AdminCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE_FORM);

  // Enroll Modal
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Roster Modal
  const [rosterCourse, setRosterCourse] = useState(null);
  const [rosterStudents, setRosterStudents] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [crsRes, lecRes] = await Promise.all([
        api.get('/courses'),
        api.get('/lecturers'),
      ]);
      setCourses(crsRes.data.courses || []);
      setLecturers(lecRes.data.lecturers || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingCourseId(null);
    setCourseForm(EMPTY_COURSE_FORM);
    setShowCourseModal(true);
  };

  const openEditModal = (course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      code: course.code || '',
      name: course.name || '',
      department: course.department || 'Computer Science',
      credits: course.credits || 3,
      lecturerId: course.lecturer_id ? String(course.lecturer_id) : '',
    });
    setShowCourseModal(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...courseForm,
        lecturerId: courseForm.lecturerId ? Number(courseForm.lecturerId) : null,
      };
      if (editingCourseId) {
        await api.put(`/courses/${editingCourseId}`, payload);
      } else {
        await api.post('/courses', payload);
      }
      setShowCourseModal(false);
      setEditingCourseId(null);
      setCourseForm(EMPTY_COURSE_FORM);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save course');
    }
  };

  const openEnrollModal = async (course) => {
    setEnrollTarget(course);
    setSelectedStudentId('');
    try {
      const res = await api.get(`/courses/${course.id}/available-students`);
      setAvailableStudents(res.data.students || []);
    } catch {
      setAvailableStudents([]);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !enrollTarget) return;
    try {
      await api.post(`/courses/${enrollTarget.id}/enroll`, { studentId: Number(selectedStudentId) });
      setEnrollTarget(null);
      setSelectedStudentId('');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Enrollment failed');
    }
  };

  const openRosterModal = async (course) => {
    setRosterCourse(course);
    setLoadingRoster(true);
    try {
      const res = await api.get(`/courses/${course.id}/students`);
      setRosterStudents(res.data.students || []);
    } catch {
      setRosterStudents([]);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleUnenroll = async (studentId, studentName) => {
    if (!rosterCourse) return;
    if (!window.confirm(`Remove ${studentName} from ${rosterCourse.code}?`)) return;
    try {
      await api.delete(`/courses/${rosterCourse.id}/enroll/${studentId}`);
      await Promise.all([loadData(), openRosterModal(rosterCourse)]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unenroll student');
    }
  };

  const handleDeleteCourse = async (id, code) => {
    if (!window.confirm(`Delete course ${code} and all its enrollments?`)) return;
    try {
      await api.delete(`/courses/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <Layout
      title="Courses & Student Enrollments"
      subtitle="Configure university modules, assign lecturers, manage course rosters, and monitor risk metrics"
      actions={
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <Plus size={15} /> Add Course
        </button>
      }
    >
      {loading ? (
        <div className="p-10 text-center text-slate-400">Loading courses...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((c) => (
            <div key={c.id} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{c.code}</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{c.name}</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300 font-medium">
                    {c.credits} Credits
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Department: {c.department}</p>
                <p className="text-xs text-slate-300 mt-1">
                  Assigned Lecturer:{' '}
                  <strong>
                    {c.lecturer_first_name ? `${c.lecturer_first_name} ${c.lecturer_last_name}` : 'Unassigned'}
                  </strong>
                </p>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="p-2.5 rounded-xl bg-black/30">
                    <p className="text-[10px] text-slate-400">Avg Attendance</p>
                    <p className="text-sm font-bold text-cyan-300 mt-0.5">{c.avg_attendance ?? 0}%</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30">
                    <p className="text-[10px] text-slate-400">Avg Assign</p>
                    <p className="text-sm font-bold text-white mt-0.5">{c.avg_assignment ?? 0}%</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30">
                    <p className="text-[10px] text-slate-400">High Risk</p>
                    <p className={`text-sm font-bold mt-0.5 flex items-center justify-center gap-1 ${(c.high_risk_count || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(c.high_risk_count || 0) > 0 && <AlertTriangle size={12} />} {c.high_risk_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => openRosterModal(c)}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 font-semibold cursor-pointer"
                >
                  <Users size={14} /> {c.enrolled_count} Enrolled (View Roster)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(c)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                    title="Edit course"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => openEnrollModal(c)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold cursor-pointer"
                  >
                    <UserPlus size={13} /> Enroll
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(c.id, c.code)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingCourseId ? 'Update Course / Subject' : 'Add New Course'}
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Course Code *</label>
                  <input required value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="CS401" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Credits</label>
                  <input type="number" min="1" max="12" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: Number(e.target.value) })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Course Name *</label>
                <input required value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="Artificial Intelligence" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Department</label>
                <input value={courseForm.department} onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Assign Lecturer</label>
                <select value={courseForm.lecturerId} onChange={(e) => setCourseForm({ ...courseForm, lecturerId: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white">
                  <option value="">Unassigned</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>{l.first_name} {l.last_name} ({l.department})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCourseModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer">
                  {editingCourseId ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {enrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Enroll Student in {enrollTarget.code}</h3>
              <button onClick={() => setEnrollTarget(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            {availableStudents.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">All active students are already enrolled in this course.</p>
            ) : (
              <form onSubmit={handleEnroll} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Select Available Student</label>
                  <select required value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white">
                    <option value="">Choose student...</option>
                    {availableStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.student_identifier} — {s.first_name} {s.last_name} ({s.major})</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEnrollTarget(null)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer">Confirm Enrollment</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Course Roster Modal */}
      {rosterCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-400" />
                  {rosterCourse.code} — Enrolled Students ({rosterStudents.length})
                </h3>
                <p className="text-xs text-slate-400">{rosterCourse.name}</p>
              </div>
              <button onClick={() => setRosterCourse(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {loadingRoster ? (
                <p className="text-sm text-slate-400 text-center py-8">Loading roster...</p>
              ) : rosterStudents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No students enrolled in this course.</p>
              ) : (
                rosterStudents.map((st) => (
                  <div key={st.enrollment_id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        to={`/admin/students/${st.student_id}`}
                        className="font-semibold text-sm text-white hover:text-indigo-300"
                      >
                        {st.first_name} {st.last_name} ({st.student_identifier})
                      </Link>
                      <p className="text-xs text-slate-400">
                        {st.major} · Attendance: {st.attendance_percentage ?? 0}% · Assign: {st.assignment_score ?? 0}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={st.risk_level || 'UNASSESSED'} />
                      <button
                        onClick={() => handleUnenroll(st.student_id, `${st.first_name} ${st.last_name}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold cursor-pointer"
                        title="Remove from course"
                      >
                        <UserMinus size={13} /> Unenroll
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminCoursesPage;
