import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, UserCheck, UserX, X, Pencil } from 'lucide-react';
import Layout from '../components/Layout';
import PasswordStrengthMeter, { isStrongPassword } from '../components/PasswordStrengthMeter';
import api from '../services/api';

const EMPTY_FORM = {
  email: '',
  password: '',
  role: 'LECTURER',
  firstName: '',
  lastName: '',
  identifier: '',
  major: 'Computer Science',
  department: 'Computer Science',
  yearOfStudy: 1,
};

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [allowModalInput, setAllowModalInput] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setError('');
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setError('');
    setForm({
      email: u.email || '',
      password: '',
      role: u.role,
      firstName: u.first_name || '',
      lastName: u.last_name || '',
      identifier: u.student_identifier || u.employee_id || '',
      major: u.major || 'Computer Science',
      department: u.department || 'Computer Science',
      yearOfStudy: u.year_of_study || 1,
    });
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingUser) {
        const payload = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          major: form.major,
          department: form.department,
          yearOfStudy: form.yearOfStudy,
        };
        if (form.password.trim()) {
          if (!isStrongPassword(form.password.trim())) {
            setError('New password must be strong (8+ chars, uppercase, lowercase, number, special char).');
            return;
          }
          payload.password = form.password.trim();
        }
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        if (!isStrongPassword(form.password)) {
          setError('Password must be strong (8+ chars, uppercase, lowercase, number, special char).');
          return;
        }
        await api.post('/users', form);
      }
      setShowModal(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.is_active });
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const counts = {
    ALL: users.length,
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    LECTURER: users.filter((u) => u.role === 'LECTURER').length,
    STUDENT: users.filter((u) => u.role === 'STUDENT').length,
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${u.first_name} ${u.last_name} ${u.email} ${u.student_identifier || ''} ${u.employee_id || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <Layout
      title="User Management & Access Control"
      subtitle="Create, edit, reset passwords, and manage permissions for administrators, lecturers, and students"
      actions={
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <Plus size={15} /> Create User
        </button>
      }
    >
      {/* Clickable Role Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'ALL', label: 'All Users', color: 'text-white' },
          { key: 'ADMIN', label: 'Administrators', color: 'text-purple-300' },
          { key: 'LECTURER', label: 'Lecturers', color: 'text-cyan-300' },
          { key: 'STUDENT', label: 'Students', color: 'text-indigo-300' },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setRoleFilter(card.key)}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              roleFilter === card.key
                ? 'bg-indigo-600/15 border-indigo-500/50'
                : 'bg-slate-900/60 border-white/5 hover:border-indigo-500/30'
            }`}
          >
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{counts[card.key]}</p>
          </button>
        ))}
      </div>

      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ADMIN', 'LECTURER', 'STUDENT'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No users match your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Identifier</th>
                  <th className="py-3.5 px-4">Department / Major</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-white">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-indigo-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {u.student_identifier || u.employee_id || 'ADMIN'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {u.major || u.department || 'Administration'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                          title="Edit user or reset password"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                          title={u.is_active ? 'Deactivate user' : 'Activate user'}
                        >
                          {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingUser ? `Edit User (${editingUser.role})` : 'Create New User'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{error}</div>
            )}
            <form onSubmit={handleSaveUser} autoComplete="off" className="space-y-3.5">
              {!editingUser && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    <option value="LECTURER">Lecturer</option>
                    <option value="STUDENT">Student</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              )}
              {form.role !== 'ADMIN' && (
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
              )}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email *</label>
                <input
                  type="email"
                  name="edurisk_add_usr_email"
                  autoComplete="off"
                  readOnly={!allowModalInput}
                  onFocus={() => setAllowModalInput(true)}
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  {editingUser ? 'Reset Password (leave blank to keep current)' : 'Temporary Password *'}
                </label>
                <input
                  type="text"
                  required={!editingUser}
                  minLength={editingUser ? undefined : 8}
                  placeholder={editingUser ? 'Optional strong password' : 'e.g. EduRisk@2026!'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500"
                />
                <PasswordStrengthMeter password={form.password} />
              </div>
              {form.role === 'LECTURER' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              )}
              {form.role === 'STUDENT' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Major</label>
                    <input
                      value={form.major}
                      onChange={(e) => setForm({ ...form, major: e.target.value })}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Year</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={form.yearOfStudy}
                      onChange={(e) => setForm({ ...form, yearOfStudy: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer">
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminUsersPage;
