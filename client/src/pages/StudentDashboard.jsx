import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle,
  BookOpen,
  Brain,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  LifeBuoy,
  Clock,
} from 'lucide-react';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { RiskBadge, StatusBadge } from '../components/RiskBadge';
import api from '../services/api';

const StatCard = ({ title, value, sub, icon: Icon, accent, progress = null, isWarning = false }) => (
  <div className="p-5 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl relative overflow-hidden flex flex-col justify-between gap-3">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${accent}`} />
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className={`text-3xl font-bold mt-2 ${isWarning ? 'text-amber-300' : 'text-white'}`}>{value}</h3>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
        <Icon size={20} className="text-indigo-300" />
      </div>
    </div>
    {progress !== null && (
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${isWarning ? 'bg-amber-400' : 'bg-indigo-500'}`}
          style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
        />
      </div>
    )}
  </div>
);

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/students/me')
      .then((res) => setData(res.data))
      .catch((err) => console.error('Failed to load student overview:', err))
      .finally(() => setLoading(false));
  }, []);

  const student = data?.student;
  const summary = data?.summary;
  const pred = data?.latestPrediction;
  const history = data?.predictionHistory || [];
  const records = data?.academicRecords || [];
  const factors = Array.isArray(pred?.contributing_factors) ? pred.contributing_factors : [];
  const suggestedActions = Array.isArray(pred?.suggested_actions) ? pred.suggested_actions : [];
  const interventions = data?.interventions || [];

  const radarData = summary
    ? [
        { metric: 'Attendance', score: summary.avg_attendance },
        { metric: 'Assignments', score: summary.avg_assignment },
        { metric: 'Quizzes', score: summary.avg_quiz },
        { metric: 'LMS Activity', score: summary.avg_lms },
        { metric: 'Prev GPA (%)', score: Math.round((summary.avg_gpa / 4) * 100) },
      ]
    : [];

  const courseChartData = records.map((r) => ({
    course: r.course_code,
    Attendance: r.attendance_percentage,
    Assignments: r.assignment_score,
    Quizzes: r.quiz_score,
  }));

  const historyChartData = [...history]
    .reverse()
    .map((h, idx) => ({
      check: `#${idx + 1}`,
      date: String(h.generated_at || '').slice(0, 10),
      riskPct: Math.round(Number(h.probability || 0) * 100),
      level: h.risk_level,
    }));

  return (
    <Layout
      title={`Welcome back, ${student?.first_name || 'Student'}`}
      subtitle={
        student
          ? `${student.student_identifier} · ${student.major} (Year ${student.year_of_study}) · ${summary?.course_count || 0} Active Courses`
          : 'Your personalized academic monitoring & early-support dashboard'
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/student/academics"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-colors"
          >
            <SlidersHorizontal size={14} /> What-If Simulator
          </Link>
          <Link
            to="/student/support"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-colors"
          >
            <LifeBuoy size={14} /> Support Plan
          </Link>
        </div>
      }
    >
      {loading || !data ? (
        <div className="p-12 text-center text-slate-400">Loading your academic summary...</div>
      ) : records.length === 0 ? (
        <div className="p-8 sm:p-10 bg-slate-900/60 border border-indigo-500/25 rounded-3xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <BookOpen size={26} className="text-indigo-300" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h2 className="text-xl font-bold text-white">Welcome to EduRisk, {student?.first_name}!</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your account is verified and active. You are not enrolled in any courses yet — once your Administrator or Lecturer enrolls you and records your attendance, assignments, quizzes, and GPA, your live performance charts and ML risk indicators will appear here automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/student/academics"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <SlidersHorizontal size={14} /> Try What-If Goal Simulator
            </Link>
            <Link
              to="/student/support"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
            >
              <LifeBuoy size={14} /> Request Advising Support
            </Link>
          </div>
        </div>
      ) : (
        <>
          <DecisionSupportBanner isDemo={pred?.is_demo ?? true} modelName={pred?.model_name} compact />

          {/* Risk Indicator Hero Banner */}
          <div
            className={`p-6 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
              pred?.risk_level === 'HIGH'
                ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/25'
                : pred?.risk_level === 'MEDIUM'
                ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/25'
                : 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/25'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white/10 shrink-0">
                <AlertTriangle
                  size={24}
                  className={
                    pred?.risk_level === 'HIGH'
                      ? 'text-red-400'
                      : pred?.risk_level === 'MEDIUM'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">Current Academic Progress Indicator</h3>
                  <RiskBadge level={pred?.risk_level || 'UNASSESSED'} probability={pred?.probability} />
                </div>
                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                  {pred?.explanation_summary || 'Your academic metrics are being monitored to offer timely support.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/student/academics"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                Explore What-If Goals <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Previous GPA"
              value={summary.avg_gpa.toFixed(2)}
              sub={summary.avg_gpa < 2.5 ? 'Below 2.50 benchmark' : 'On track (4.00 scale)'}
              icon={TrendingUp}
              accent="bg-blue-500"
              progress={(summary.avg_gpa / 4) * 100}
              isWarning={summary.avg_gpa < 2.5}
            />
            <StatCard
              title="Overall Attendance"
              value={`${summary.avg_attendance}%`}
              sub={summary.avg_attendance < 75 ? 'Target: 75%+ recommended' : 'Meets 75% target'}
              icon={CheckCircle}
              accent={summary.avg_attendance < 75 ? 'bg-red-500' : 'bg-emerald-500'}
              progress={summary.avg_attendance}
              isWarning={summary.avg_attendance < 75}
            />
            <StatCard
              title="Assignments & Quizzes"
              value={`${summary.avg_assignment}%`}
              sub={`Quizzes Average: ${summary.avg_quiz}%`}
              icon={BookOpen}
              accent="bg-indigo-500"
              progress={summary.avg_assignment}
              isWarning={summary.avg_assignment < 65}
            />
            <StatCard
              title="LMS Engagement"
              value={`${summary.avg_lms}/100`}
              sub={`Missed Submissions: ${summary.avg_missed}`}
              icon={Brain}
              accent="bg-cyan-500"
              progress={summary.avg_lms}
              isWarning={summary.avg_lms < 55 || summary.avg_missed > 2}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Performance Across Enrolled Courses</h3>
                  <p className="text-xs text-slate-400">Attendance, assignment, and quiz comparison by module</p>
                </div>
                <Link to="/student/academics" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                  Full details →
                </Link>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courseChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="course" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                    <Legend />
                    <Bar dataKey="Attendance" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Assignments" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Quizzes" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl">
              <h3 className="text-base font-semibold text-white mb-1">Academic Indicator Profile</h3>
              <p className="text-xs text-slate-400 mb-2">Balanced view across key monitored indicators</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Your Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Indicator Breakdown + Support Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Indicators Breakdown */}
            <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">Key Indicators Associated With Your Result</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of your current metrics against reference academic benchmarks
                </p>
              </div>
              <div className="space-y-3">
                {factors.map((f) => {
                  const isConcern = f.status === 'CONCERN';
                  const pct = Math.min(100, Math.max(10, Math.round((Number(f.association_score) || 0) * 180)));
                  return (
                    <div key={f.feature} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-white">{f.label}</span>
                        <span className={isConcern ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                          {f.value}{f.unit === '%' ? '%' : ` ${f.unit}`} · {f.note}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isConcern ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Support & History Column */}
            <div className="space-y-6">
              <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles size={17} className="text-cyan-400" />
                    Top Recommended Next Steps
                  </h3>
                  <Link to="/student/support" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                    Open checklist →
                  </Link>
                </div>
                <div className="space-y-2.5">
                  {suggestedActions.slice(0, 3).map((act, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {act.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Priority: {act.priority}</span>
                      </div>
                      <p className="text-sm font-semibold text-white mt-1.5">{act.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>
                    </div>
                  ))}
                </div>

                {interventions.length > 0 && (
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Active advisor follow-ups: <strong className="text-white">{interventions.length}</strong>
                    </span>
                    <StatusBadge status={interventions[0].status} />
                  </div>
                )}
              </div>

              {historyChartData.length > 1 && (
                <div className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Clock size={15} className="text-indigo-400" />
                    Risk Estimate History
                  </h3>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyChartData}>
                        <defs>
                          <linearGradient id="riskHist" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="check" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px' }} />
                        <Area type="monotone" dataKey="riskPct" name="Risk Score %" stroke="#6366f1" strokeWidth={2.5} fill="url(#riskHist)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default StudentDashboard;
