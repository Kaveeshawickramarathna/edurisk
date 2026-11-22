import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, ArrowRight, Trash2, X, Filter, Eye, EyeOff } from 'lucide-react';
import Layout from '../components/Layout';
import { RiskBadge } from '../components/RiskBadge';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MAJORS = ['Computer Science', 'Data Science', 'Software Engineering', 'Information Systems'];

const StudentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const basePath = isAdmin ? '/admin' : '/lecturer';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialRisk = ['HIGH', 'MEDIUM', 'LOW'].includes(searchParams.get('riskLevel'))
    ? searchParams.get('riskLevel')
    : 'ALL';

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [major, setMajor] = useState('ALL');
  const [courseId, setCourseId] = useState('ALL');
  const [riskLevel, setRiskLevel] = useState(initialRisk);

  const handleRiskFilterChange = (nextVal) => {
    setRiskLevel(nextVal);
    if (nextVal === 'ALL') {
      searchParams.delete('riskLevel');
    } else {
      searchParams.set('riskLevel', nextVal);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newStu, setNewStu] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studentIdentifier: '',
    major: 'Computer Science',
    yearOfStudy: 1,
    password: '',
    courseIds: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [allowModalInput, setAllowModalInput] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (major !== 'ALL') params.major = major;
      if (courseId !== 'ALL') params.courseId = courseId;
      if (riskLevel !== 'ALL') params.riskLevel = riskLevel;

      const [stuRes, crsRes] = await Promise.all([
        api.get('/students', { params }),
        api.get('/courses'),
      ]);
      setStudents(stuRes.data.students || []);
      setCourses(crsRes.data.courses || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }, [search, major, courseId, riskLevel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!isStrongPassword(newStu.password)) {
      setFormError('Password must be strong (8+ chars, uppercase, lowercase, number, and special character).');
      return;
    }
    setSaving(true);
    try {
      await api.post('/students', newStu);
      setShowAddModal(false);
      setNewStu({
        firstName: '',
        lastName: '',
        email: '',
        studentIdentifier: '',
        major: 'Computer Science',
        yearOfStudy: 1,
        password: '',
        courseIds: [],
      });
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(`Delete student ${name} and all associated records?`)) return;
    try {
      await api.delete(`/students/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete student');
    }
  };

  const toggleCourseSelection = (cid) => {
    setNewStu((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(cid)
        ? prev.courseIds.filter((id) => id !== cid)
        : [...prev.courseIds, cid],
    }));
  };

  return (
    <Layout
      title={isAdmin ? 'Student Management & Academic Records' : 'My Students & Academic Records'}
      subtitle="Search, filter by risk category or course, and inspect individual performance records"
      actions={
        isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <Plus size={15} /> Add Student
          </button>
        )
      }
    >
      {/* Filters Bar */}
      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, student ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={riskLevel}
          onChange={(e) => handleRiskFilterChange(e.target.value)}
          className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Risk Levels</option>
          <option value="HIGH">HIGH Risk</option>
          <option value="MEDIUM">MEDIUM Risk</option>
          <option value="LOW">LOW Risk</option>
        </select>

        <select
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Majors</option>
          {MAJORS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Filter size={14} /> Showing {students.length} students
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm space-y-3">
            <p>
              {isAdmin
                ? 'No students match the selected filters.'
                : 'No students are enrolled in your assigned courses yet.'}
            </p>
            {!isAdmin && (
              <Link
                to="/lecturer/courses"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Open Courses &amp; Gradebook to Enroll Students &amp; Add Marks <ArrowRight size={13} />
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                  <th className="py-3.5 px-5">Student</th>
                  <th className="py-3.5 px-4">Major / Year</th>
                  <th className="py-3.5 px-4">Attendance</th>
                  <th className="py-3.5 px-4">Assign / Quiz</th>
                  <th className="py-3.5 px-4">Prev GPA</th>
                  <th className="py-3.5 px-4">Missed</th>
                  <th className="py-3.5 px-4">Risk Indicator</th>
                  <th className="py-3.5 px-4">Support</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-white">
                        {stu.first_name} {stu.last_name}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span>{stu.student_identifier} · {stu.email}</span>
                        {stu.email_verified && (
                          <span className="text-emerald-400 font-semibold text-[11px]">✓ Verified</span>
                        )}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-200">{stu.major}</p>
                      <p className="text-xs text-slate-400">Year {stu.year_of_study}</p>
                    </td>
                    <td className={`py-3.5 px-4 font-semibold ${stu.avg_attendance < 75 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {stu.avg_attendance}%
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {stu.avg_assignment}% / {stu.avg_quiz}%
                    </td>
                    <td className={`py-3.5 px-4 font-medium ${stu.avg_gpa < 2.5 ? 'text-amber-300' : 'text-slate-200'}`}>
                      {stu.avg_gpa}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{stu.avg_missed}</td>
                    <td className="py-3.5 px-4">
                      <RiskBadge level={stu.risk_level} probability={stu.risk_probability} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {stu.intervention_count} logged
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`${basePath}/students/${stu.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold"
                        >
                          Marks &amp; Risk <ArrowRight size={13} />
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteStudent(stu.id, `${stu.first_name} ${stu.last_name}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete student"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal (Admin) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Add New Student Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateStudent} autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">First Name *</label>
                  <input
                    required
                    value={newStu.firstName}
                    onChange={(e) => setNewStu({ ...newStu, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Last Name *</label>
                  <input
                    required
                    value={newStu.lastName}
                    onChange={(e) => setNewStu({ ...newStu, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">University Email *</label>
                  <input
                    type="email"
                    name="edurisk_add_stu_email"
                    autoComplete="off"
                    readOnly={!allowModalInput}
                    onFocus={() => setAllowModalInput(true)}
                    required
                    value={newStu.email}
                    onChange={(e) => setNewStu({ ...newStu, email: e.target.value })}
                    placeholder="student@university.edu"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Student ID (optional)</label>
                  <input
                    value={newStu.studentIdentifier}
                    onChange={(e) => setNewStu({ ...newStu, studentIdentifier: e.target.value })}
                    placeholder="Auto-generated e.g. STU1050"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Major</label>
                  <select
                    value={newStu.major}
                    onChange={(e) => setNewStu({ ...newStu, major: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    {MAJORS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Year of Study</label>
                  <select
                    value={newStu.yearOfStudy}
                    onChange={(e) => setNewStu({ ...newStu, yearOfStudy: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Account Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="edurisk_add_stu_pw"
                    autoComplete="new-password"
                    readOnly={!allowModalInput}
                    onFocus={() => setAllowModalInput(true)}
                    required
                    minLength={8}
                    value={newStu.password}
                    onChange={(e) => setNewStu({ ...newStu, password: e.target.value })}
                    placeholder="Strong password e.g. Student@2026"
                    className="w-full pl-3 pr-10 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
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
                <PasswordStrengthMeter password={newStu.password} />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Enroll in Courses</label>
                <div className="grid grid-cols-2 gap-2">
                  {courses.map((c) => {
                    const checked = newStu.courseIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCourseSelection(c.id)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-indigo-500/20 border-indigo-400 text-white'
                            : 'bg-black/30 border-white/10 text-slate-400'
                        }`}
                      >
                        <p className="font-semibold">{c.code}</p>
                        <p className="truncate opacity-80">{c.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentsPage;
