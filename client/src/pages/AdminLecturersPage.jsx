import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  BookOpen,
  Users,
  ClipboardCheck,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import api from '../services/api';

const DEPARTMENTS = ['Computer Science', 'Data Science', 'Software Engineering', 'Information Systems'];

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  identifier: '',
  department: 'Computer Science',
  password: '',
  courseIds: [],
};

const AdminLecturersPage = () => {
  const [lecturers, setLecturers] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [allowModalInput, setAllowModalInput] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lecRes, crsRes] = await Promise.all([
        api.get('/lecturers', { params: { includeInactive: 'true' } }),
        api.get('/courses'),
      ]);
      setLecturers(lecRes.data.lecturers || []);
      setAllCourses(crsRes.data.courses || []);
    } catch (err) {
      console.error('Failed to load lecturers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingLecturer(null);
    setError('');
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (lec) => {
    setEditingLecturer(lec);
    setError('');
    setForm({
      firstName: lec.first_name || '',
      lastName: lec.last_name || '',
      email: lec.email || '',
      identifier: lec.employee_id || '',
      department: lec.department || 'Computer Science',
      password: '',
      courseIds: (lec.courses || []).map((c) => c.id),
    });
    setShowModal(true);
  };

  const toggleCourse = (cid) => {
    setForm((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(cid)
        ? prev.courseIds.filter((id) => id !== cid)
        : [...prev.courseIds, cid],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let targetLecturerId = editingLecturer?.id || null;

      if (editingLecturer) {
        const payload = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          department: form.department,
        };
        if (form.password.trim()) {
          if (!isStrongPassword(form.password.trim())) {
            setError('New password must be strong (8+ chars, uppercase, lowercase, number, special char).');
            setSaving(false);
            return;
          }
          payload.password = form.password.trim();
        }
        await api.put(`/users/${editingLecturer.user_id}`, payload);

        // Sync course assignments for this lecturer
        const previousIds = (editingLecturer.courses || []).map((c) => c.id);
        const toAssign = form.courseIds.filter((id) => !previousIds.includes(id));
        const toUnassign = previousIds.filter((id) => !form.courseIds.includes(id));

        for (const cid of toAssign) {
          await api.put(`/courses/${cid}`, { lecturerId: targetLecturerId });
        }
        for (const cid of toUnassign) {
          await api.put(`/courses/${cid}`, { lecturerId: '' });
        }
      } else {
        if (!isStrongPassword(form.password)) {
          setError('Password must be strong (8+ chars, uppercase, lowercase, number, special char).');
          setSaving(false);
          return;
        }
        await api.post('/users', {
          role: 'LECTURER',
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          identifier: form.identifier,
          department: form.department,
        });

        // If courses were selected during creation, find the newly created lecturer and assign
        if (form.courseIds.length > 0) {
          const fresh = await api.get('/lecturers', { params: { includeInactive: 'true' } });
          const created = (fresh.data.lecturers || []).find(
            (l) => l.email.toLowerCase() === form.email.trim().toLowerCase()
          );
          if (created) {
            for (const cid of form.courseIds) {
              await api.put(`/courses/${cid}`, { lecturerId: created.id });
            }
          }
        }
      }

      setShowModal(false);
      setEditingLecturer(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lecturer');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (lec) => {
    try {
      await api.put(`/users/${lec.user_id}`, { isActive: !lec.is_active });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async (lec) => {
    if (!window.confirm(`Permanently delete lecturer ${lec.first_name} ${lec.last_name}?`)) return;
    try {
      await api.delete(`/users/${lec.user_id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete lecturer');
    }
  };

  const departments = Array.from(new Set([...DEPARTMENTS, ...lecturers.map((l) => l.department).filter(Boolean)]));

  const filtered = lecturers.filter((l) => {
    if (deptFilter !== 'ALL' && l.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${l.first_name} ${l.last_name} ${l.email} ${l.employee_id || ''} ${l.department || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const activeCount = lecturers.filter((l) => l.is_active).length;
  const assignedCoursesCount = allCourses.filter((c) => c.lecturer_id).length;
  const totalInterventions = lecturers.reduce((sum, l) => sum + Number(l.intervention_count || 0), 0);

  return (
    <Layout
      title="Lecturer Management"
      subtitle="Add faculty accounts, assign university courses, and track lecturer advising activity"
      actions={
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <Plus size={15} /> Add Lecturer
        </button>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
          <p className="text-xs text-slate-400">Total Lecturers</p>
          <p className="text-2xl font-bold text-white mt-1">{lecturers.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
          <p className="text-xs text-slate-400">Active Accounts</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
          <p className="text-xs text-slate-400">Assigned Courses</p>
          <p className="text-2xl font-bold text-indigo-300 mt-1">
            {assignedCoursesCount} / {allCourses.length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5">
          <p className="text-xs text-slate-400">Logged Interventions</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{totalInterventions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, email, or department..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200"
        >
          <option value="ALL">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Lecturer Cards */}
      {loading ? (
        <div className="p-10 text-center text-slate-400">Loading lecturers...</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/60 border border-white/5 rounded-2xl text-slate-400 text-sm">
          No lecturers found. Click "+ Add Lecturer" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((lec) => {
            const initials = `${lec.first_name?.[0] || ''}${lec.last_name?.[0] || ''}`.toUpperCase();
            return (
              <div key={lec.id} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-base font-bold text-white shadow-lg shadow-cyan-500/20">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {lec.first_name} {lec.last_name}
                        </h3>
                        <p className="text-xs text-slate-400">{lec.email}</p>
                        <p className="text-[11px] text-indigo-300 font-mono mt-0.5">
                          {lec.employee_id || `LEC${lec.id}`} · {lec.department}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        lec.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {lec.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-black/30">
                      <p className="text-[10px] text-slate-400">Courses</p>
                      <p className="text-sm font-bold text-white mt-0.5 flex items-center justify-center gap-1">
                        <BookOpen size={12} className="text-indigo-400" /> {lec.course_count}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30">
                      <p className="text-[10px] text-slate-400">Students</p>
                      <p className="text-sm font-bold text-cyan-300 mt-0.5 flex items-center justify-center gap-1">
                        <Users size={12} /> {lec.student_count}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30">
                      <p className="text-[10px] text-slate-400">Interventions</p>
                      <p className="text-sm font-bold text-emerald-300 mt-0.5 flex items-center justify-center gap-1">
                        <ClipboardCheck size={12} /> {lec.intervention_count}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Course Pills */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Assigned Courses
                    </p>
                    {lec.courses && lec.courses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {lec.courses.map((c) => (
                          <span
                            key={c.id}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-200 text-xs font-medium"
                          >
                            {c.code} — {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No courses assigned yet</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                  <button
                    onClick={() => openEditModal(lec)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <Pencil size={13} /> Edit & Assign Courses
                  </button>
                  <button
                    onClick={() => handleToggleActive(lec)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    title={lec.is_active ? 'Deactivate lecturer' : 'Activate lecturer'}
                  >
                    {lec.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                  </button>
                  <button
                    onClick={() => handleDelete(lec)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    title="Delete lecturer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Lecturer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingLecturer ? 'Edit Lecturer & Course Assignments' : 'Add New Lecturer'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">First Name *</label>
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Last Name *</label>
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">University Email *</label>
                  <input
                    type="email"
                    name="edurisk_add_lec_email"
                    autoComplete="off"
                    readOnly={!allowModalInput}
                    onFocus={() => setAllowModalInput(true)}
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="lecturer@university.edu"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingLecturer && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Employee ID (optional)</label>
                    <input
                      value={form.identifier}
                      onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                      placeholder="Auto e.g. LEC105"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                    />
                  </div>
                )}
                <div className={editingLecturer ? 'col-span-2' : ''}>
                  <label className="text-xs text-slate-400 block mb-1">
                    {editingLecturer ? 'Reset Password (optional)' : 'Temporary Password *'}
                  </label>
                  <input
                    type="text"
                    required={!editingLecturer}
                    minLength={editingLecturer ? undefined : 8}
                    placeholder={editingLecturer ? 'Leave blank to keep current password' : 'e.g. EduRisk@2026!'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                  />
                  <PasswordStrengthMeter password={form.password} />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Assign Courses</label>
                <div className="grid grid-cols-2 gap-2">
                  {allCourses.map((c) => {
                    const checked = form.courseIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCourse(c.id)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-indigo-500/20 border-indigo-400 text-white'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingLecturer ? 'Save Changes' : 'Add Lecturer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminLecturersPage;
