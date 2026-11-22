import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  GraduationCap,
  RefreshCw,
  ArrowRight,
  Cpu,
  BookOpen,
  ClipboardCheck,
} from 'lucide-react';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { RiskBadge, StatusBadge } from '../components/RiskBadge';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const KpiCard = ({ label, value, sub, icon: Icon, accent, to, linkText = 'View details' }) => (
  <Link
    to={to}
    className="group p-5 bg-slate-900/60 backdrop-blur-xl border border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/90 hover:-translate-y-0.5 rounded-2xl relative overflow-hidden transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer"
  >
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity ${accent}`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-indigo-400/30 transition-colors">
        <Icon size={20} className="text-indigo-300" />
      </div>
    </div>
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 group-hover:text-indigo-300">
      {linkText} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
    </span>
  </Link>
);

const StaffDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');

  const isAdmin = user?.role === 'ADMIN';
  const basePath = isAdmin ? '/admin' : '/lecturer';

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/summary');
      setData(res.data);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleBatchPredict = async () => {
    setRecalculating(true);
    setBannerMsg('');
    try {
      const res = await api.post('/predictions/batch');
      setBannerMsg(res.data.message);
      await fetchSummary();
    } catch (err) {
      setBannerMsg(err.response?.data?.error || 'Batch risk recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  const title = isAdmin ? 'University Risk Overview' : 'Lecturer Academic Overview';
  const subtitle = isAdmin
    ? `System-wide academic monitoring · Semester ${data?.settings?.current_semester || '2026-S2'}`
    : `Assigned course cohorts & early-support watchlist · Semester ${data?.settings?.current_semester || '2026-S2'}`;

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      actions={
        <button
          onClick={handleBatchPredict}
          disabled={recalculating}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Running ML...' : 'Refresh ML Estimates'}
        </button>
      }
    >
      <DecisionSupportBanner
        isDemo={data?.mlService?.is_demo ?? true}
        modelName={data?.mlService?.selected_model || 'ML Service'}
        compact
      />

      {bannerMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
          {bannerMsg}
        </div>
      )}

      {loading || !data ? (
        <div className="p-12 text-center text-slate-400">Loading analytics dashboard...</div>
      ) : (
        <>
          {/* Admin System Quick-Overview Strip */}
          {isAdmin && data.systemCounts && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/admin/users"
                className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-purple-500/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Accounts</p>
                  <p className="text-xl font-bold text-white mt-0.5">{data.systemCounts.totalUsers}</p>
                </div>
                <span className="text-xs text-purple-300 font-semibold">Manage →</span>
              </Link>
              <Link
                to="/admin/lecturers"
                className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-cyan-500/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Active Lecturers</p>
                  <p className="text-xl font-bold text-cyan-300 mt-0.5">{data.systemCounts.lecturers}</p>
                </div>
                <span className="text-xs text-cyan-300 font-semibold">Manage →</span>
              </Link>
              <Link
                to="/admin/courses"
                className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">University Courses</p>
                  <p className="text-xl font-bold text-indigo-300 mt-0.5">{data.systemCounts.courses}</p>
                </div>
                <span className="text-xs text-indigo-300 font-semibold">Courses →</span>
              </Link>
              <Link
                to="/admin/settings"
                className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/40 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">ML Prediction Engine</p>
                  <p className={`text-xl font-bold mt-0.5 ${data.mlService?.available ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {data.mlService?.available ? 'Online' : 'Fallback'}
                  </p>
                </div>
                <span className="text-xs text-emerald-300 font-semibold">Settings →</span>
              </Link>
            </div>
          )}

          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard
              label="Monitored Students"
              value={data.totalStudents}
              sub={isAdmin ? `${data.systemCounts?.lecturers || 0} Lecturers · ${data.systemCounts?.courses || 0} Courses` : `${data.coursePerformance?.length || 0} Assigned Courses`}
              icon={GraduationCap}
              accent="bg-indigo-500"
              to={`${basePath}/students`}
              linkText="View all students"
            />
            <KpiCard
              label="High-Risk Indicator"
              value={data.riskCounts?.HIGH || 0}
              sub={`${data.totalStudents ? Math.round(((data.riskCounts?.HIGH || 0) / data.totalStudents) * 100) : 0}% requiring priority review`}
              icon={AlertTriangle}
              accent="bg-red-500"
              to={`${basePath}/students?riskLevel=HIGH`}
              linkText="Inspect high-risk students"
            />
            <KpiCard
              label="Medium-Risk Indicator"
              value={data.riskCounts?.MEDIUM || 0}
              sub="Recommended for proactive check-in"
              icon={Activity}
              accent="bg-amber-500"
              to={`${basePath}/students?riskLevel=MEDIUM`}
              linkText="Inspect medium-risk students"
            />
            <KpiCard
              label="Cohort Avg Attendance"
              value={`${data.averages?.attendance ?? 0}%`}
              sub={`Avg GPA: ${data.averages?.gpa ?? 0} · ML: ${data.mlService?.available ? 'Online' : 'Fallback'}`}
              icon={Cpu}
              accent={data.mlService?.available ? 'bg-emerald-500' : 'bg-amber-500'}
              to={isAdmin ? '/admin/reports' : '/lecturer/courses'}
              linkText={isAdmin ? 'Open reports & ML metrics' : 'Open course gradebook'}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Distribution Pie */}
            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
              <h3 className="text-base font-semibold text-white mb-1">Risk Category Summary</h3>
              <p className="text-xs text-slate-400 mb-4">Distribution across monitored students</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={4}
                    >
                      {data.riskDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Major Breakdown Stacked Bar */}
            <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
              <h3 className="text-base font-semibold text-white mb-1">Risk Indicators by Major</h3>
              <p className="text-xs text-slate-400 mb-4">Comparison of LOW, MEDIUM, and HIGH risk cohorts</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.majorBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="major" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="HIGH" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="MEDIUM" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="LOW" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Course Performance + Recent Interventions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-400" />
                    Course Performance Averages
                  </h3>
                  <p className="text-xs text-slate-400">Average attendance (%) vs assignment score (%)</p>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.coursePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="code" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="avg_attendance" name="Avg Attendance %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avg_assignment" name="Avg Assignment %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-cyan-400" />
                  Recent Interventions
                </h3>
                <Link to={`${basePath}/interventions`} className="text-xs text-indigo-400 hover:text-indigo-300">
                  View all
                </Link>
              </div>
              <div className="space-y-3 flex-1">
                {data.recentInterventions?.length === 0 ? (
                  <p className="text-sm text-slate-400">No interventions logged yet.</p>
                ) : (
                  data.recentInterventions.map((item) => (
                    <Link
                      key={item.id}
                      to={`${basePath}/students/${item.student_id}`}
                      className="block p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white truncate">
                          {item.student_first_name} {item.student_last_name} ({item.student_identifier})
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">{item.action_type}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Priority Watchlist */}
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Priority Early-Support Watchlist</h3>
                <p className="text-xs text-slate-400">
                  Students flagged with HIGH or MEDIUM risk indicators for lecturer review
                </p>
              </div>
              <Link
                to={`${basePath}/students`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Manage All Students <ArrowRight size={14} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-3 pr-4">Student</th>
                    <th className="py-3 pr-4">Major</th>
                    <th className="py-3 pr-4">Attendance</th>
                    <th className="py-3 pr-4">Assignments</th>
                    <th className="py-3 pr-4">Prev GPA</th>
                    <th className="py-3 pr-4">Risk Indicator</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.highRiskWatchlist?.map((stu) => (
                    <tr key={stu.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-white">
                          {stu.first_name} {stu.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{stu.student_identifier}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{stu.major}</td>
                      <td className={`py-3 pr-4 font-medium ${stu.avg_attendance < 75 ? 'text-red-400' : 'text-slate-200'}`}>
                        {stu.avg_attendance}%
                      </td>
                      <td className="py-3 pr-4 text-slate-200">{stu.avg_assignment}%</td>
                      <td className="py-3 pr-4 text-slate-200">{stu.avg_gpa}</td>
                      <td className="py-3 pr-4">
                        <RiskBadge level={stu.risk_level} probability={stu.risk_probability} />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`${basePath}/students/${stu.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold transition-colors"
                        >
                          Review & Support <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default StaffDashboard;
