import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Calendar,
  ArrowRight,
  Plus,
  X,
  Trash2,
  Pencil,
  Search,
  MessageSquareHeart,
} from 'lucide-react';
import Layout from '../components/Layout';
import { RiskBadge, StatusBadge } from '../components/RiskBadge';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = ['ALL', 'STUDENT_REQUESTS', 'PENDING', 'IN_PROGRESS', 'FOLLOW_UP_NEEDED', 'COMPLETED'];
const EDITABLE_STATUSES = ['PENDING', 'IN_PROGRESS', 'FOLLOW_UP_NEEDED', 'COMPLETED'];

const InterventionsPage = () => {
  const { user } = useAuth();
  const basePath = user?.role === 'ADMIN' ? '/admin' : '/lecturer';

  const [interventions, setInterventions] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState({
    studentId: '',
    actionType: 'Academic Advising',
    notes: '',
    status: 'PENDING',
    followUpDate: '',
    studentVisible: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, stuRes] = await Promise.all([
        api.get('/interventions'),
        api.get('/students'),
      ]);
      setInterventions(intRes.data.interventions || []);
      setStudents(stuRes.data.students || []);
    } catch (err) {
      console.error('Failed to load interventions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      studentId: '',
      actionType: 'Academic Advising',
      notes: '',
      status: 'PENDING',
      followUpDate: '',
      studentVisible: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      studentId: String(item.student_id),
      actionType: item.action_type || 'Academic Advising',
      notes: item.notes || '',
      status: item.status || 'PENDING',
      followUpDate: item.follow_up_date ? String(item.follow_up_date).slice(0, 10) : '',
      studentVisible: Boolean(item.student_visible),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/interventions/${editingItem.id}`, {
          actionType: form.actionType,
          notes: form.notes,
          status: form.status,
          followUpDate: form.followUpDate || null,
          studentVisible: form.studentVisible,
        });
      } else {
        await api.post('/interventions', form);
      }
      setShowModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save intervention');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/interventions/${id}`, { status });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this intervention?')) return;
    try {
      await api.delete(`/interventions/${id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const studentRequestCount = interventions.filter((i) =>
    String(i.action_type || '').startsWith('Student Request:')
  ).length;
  const pendingCount = interventions.filter((i) => i.status === 'PENDING').length;
  const inProgressCount = interventions.filter((i) => i.status === 'IN_PROGRESS').length;
  const completedCount = interventions.filter((i) => i.status === 'COMPLETED').length;

  const filteredInterventions = interventions.filter((item) => {
    if (statusFilter === 'STUDENT_REQUESTS') {
      if (!String(item.action_type || '').startsWith('Student Request:')) return false;
    } else if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${item.student_first_name} ${item.student_last_name} ${item.student_identifier} ${item.action_type} ${item.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <Layout
      title="Early Support & Interventions"
      subtitle="Respond to student support requests, assign follow-up actions, and track advising outcomes"
      actions={
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <Plus size={15} /> Log Intervention
        </button>
      }
    >
      {/* Summary Strip (Clickable Quick Filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'STUDENT_REQUESTS', label: 'Student Requests', count: studentRequestCount, color: 'text-cyan-300' },
          { key: 'PENDING', label: 'Pending Review', count: pendingCount, color: 'text-amber-300' },
          { key: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount, color: 'text-indigo-300' },
          { key: 'COMPLETED', label: 'Completed', count: completedCount, color: 'text-emerald-300' },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setStatusFilter(statusFilter === card.key ? 'ALL' : card.key)}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === card.key
                ? 'bg-indigo-600/15 border-indigo-500/50'
                : 'bg-slate-900/60 border-white/5 hover:border-indigo-500/30'
            }`}
          >
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.count}</p>
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {st === 'STUDENT_REQUESTS' ? `Student Requests (${studentRequestCount})` : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[230px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or notes..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading interventions...</div>
        ) : filteredInterventions.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/60 border border-white/5 rounded-2xl text-slate-400 text-sm">
            No interventions found matching this filter.
          </div>
        ) : (
          filteredInterventions.map((item) => {
            const isStudentRequest = String(item.action_type || '').startsWith('Student Request:');
            return (
              <div
                key={item.id}
                className={`p-5 bg-slate-900/60 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isStudentRequest ? 'border-cyan-500/25' : 'border-white/5'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isStudentRequest ? (
                      <MessageSquareHeart size={16} className="text-cyan-400" />
                    ) : (
                      <ClipboardCheck size={16} className="text-indigo-400" />
                    )}
                    <span className="font-semibold text-white">{item.action_type}</span>
                    {isStudentRequest && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold uppercase">
                        Student Initiated
                      </span>
                    )}
                    <StatusBadge status={item.status} />
                    {item.current_risk_level && <RiskBadge level={item.current_risk_level} />}
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{item.notes}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <span>
                      Student:{' '}
                      <strong className="text-slate-200">
                        {item.student_first_name} {item.student_last_name} ({item.student_identifier})
                      </strong>
                    </span>
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

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white"
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => openEditModal(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                    title="Edit notes or reply"
                  >
                    <Pencil size={12} /> Edit / Reply
                  </button>
                  <Link
                    to={`${basePath}/students/${item.student_id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold"
                  >
                    Profile <ArrowRight size={13} />
                  </Link>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Update Intervention / Reply' : 'Log Early-Support Intervention'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingItem && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Student *</label>
                  <select
                    required
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    <option value="">Select a student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.student_identifier} — {s.first_name} {s.last_name} ({s.risk_level || 'UNASSESSED'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Action Type *</label>
                <input
                  required
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Support Notes / Advisor Reply *</label>
                <textarea
                  required
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.studentVisible}
                  onChange={(e) => setForm({ ...form, studentVisible: e.target.checked })}
                />
                Visible on student's Support & Actions portal
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer">
                  {editingItem ? 'Save Update' : 'Save Intervention'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default InterventionsPage;
