import React, { useEffect, useState } from 'react';
import { BookOpen, SlidersHorizontal, RotateCcw, Sparkles, CheckCircle2, AlertCircle, User } from 'lucide-react';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { RiskBadge } from '../components/RiskBadge';
import api from '../services/api';

const StudentAcademicsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sim, setSim] = useState({
    attendance_percentage: 75,
    assignment_score: 70,
    quiz_score: 70,
    previous_gpa: 3.0,
    missed_submissions: 1,
    lms_activity_score: 65,
  });
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    api
      .get('/students/me')
      .then((res) => {
        setData(res.data);
        const s = res.data.summary;
        if (s) {
          setSim({
            attendance_percentage: s.avg_attendance,
            assignment_score: s.avg_assignment,
            quiz_score: s.avg_quiz,
            previous_gpa: s.avg_gpa,
            missed_submissions: s.avg_missed,
            lms_activity_score: s.avg_lms,
          });
        }
      })
      .catch((err) => console.error('Failed to load academics:', err))
      .finally(() => setLoading(false));
  }, []);

  const runSimulation = async (overrideValues = null) => {
    const payload = overrideValues || sim;
    setSimulating(true);
    try {
      const res = await api.post('/predictions/simulate', payload);
      setSimResult(res.data.prediction);
    } catch (err) {
      alert(err.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const resetToCurrent = () => {
    if (!data?.summary) return;
    const s = data.summary;
    const base = {
      attendance_percentage: s.avg_attendance,
      assignment_score: s.avg_assignment,
      quiz_score: s.avg_quiz,
      previous_gpa: s.avg_gpa,
      missed_submissions: s.avg_missed,
      lms_activity_score: s.avg_lms,
    };
    setSim(base);
    setSimResult(null);
  };

  const applyTargetGoals = () => {
    const target = {
      attendance_percentage: Math.max(85, sim.attendance_percentage),
      assignment_score: Math.max(80, sim.assignment_score),
      quiz_score: Math.max(75, sim.quiz_score),
      previous_gpa: sim.previous_gpa,
      missed_submissions: 0,
      lms_activity_score: Math.max(75, sim.lms_activity_score),
    };
    setSim(target);
    runSimulation(target);
  };

  const records = data?.academicRecords || [];
  const currentPred = data?.latestPrediction;

  return (
    <Layout
      title="My Course Performance & Goal Simulator"
      subtitle="Review module-by-module academic indicators and explore how study improvements affect your risk estimate"
    >
      {loading || !data ? (
        <div className="p-12 text-center text-slate-400">Loading your enrolled courses...</div>
      ) : (
        <>
          <DecisionSupportBanner isDemo={currentPred?.is_demo ?? true} modelName={currentPred?.model_name} compact />

          {/* Course Cards */}
          {records.length === 0 ? (
            <div className="p-8 bg-slate-900/60 border border-white/5 rounded-2xl text-center space-y-2">
              <p className="text-base font-semibold text-white">No Courses Enrolled Yet</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your Administrator or Lecturer has not enrolled you in any modules yet. While you wait, you can use the interactive What-If Simulator below to explore academic goals!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {records.map((r) => {
              const attLow = r.attendance_percentage < 75;
              const asgLow = r.assignment_score < 65;
              return (
                <div key={r.enrollment_id} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        {r.course_code} · Semester {r.semester}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-0.5">{r.course_name}</h3>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <User size={12} />
                        Lecturer:{' '}
                        {r.lecturer_first_name ? `${r.lecturer_first_name} ${r.lecturer_last_name}` : 'TBA'} · {r.credits} Credits
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        attLow || asgLow
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {attLow || asgLow ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                      {attLow || asgLow ? 'Needs Focus' : 'On Track'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">Attendance</p>
                      <p className={`text-lg font-bold mt-0.5 ${attLow ? 'text-red-400' : 'text-emerald-400'}`}>
                        {r.attendance_percentage}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">Assignments</p>
                      <p className={`text-lg font-bold mt-0.5 ${asgLow ? 'text-amber-300' : 'text-white'}`}>
                        {r.assignment_score}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">Quizzes</p>
                      <p className="text-lg font-bold text-white mt-0.5">{r.quiz_score}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">Previous GPA</p>
                      <p className="text-lg font-bold text-white mt-0.5">{r.previous_gpa}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">Missed Tasks</p>
                      <p className={`text-lg font-bold mt-0.5 ${r.missed_submissions > 2 ? 'text-red-400' : 'text-white'}`}>
                        {r.missed_submissions}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-[11px] text-slate-400">LMS Activity</p>
                      <p className="text-lg font-bold text-white mt-0.5">{r.lms_activity_score}/100</p>
                    </div>
                  </div>

                  {r.notes && (
                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">Lecturer Remark:</span> {r.notes}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}

          {/* Interactive What-If Academic Improvement Simulator */}
          <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-cyan-400" />
                  Interactive "What-If" Academic Goal Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust the sliders below to explore how improving attendance, assignments, or LMS habits may shift your estimated risk indicator. This simulation does not modify your official university records.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyTargetGoals}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold cursor-pointer"
                >
                  <Sparkles size={13} /> Try Target Benchmarks
                </button>
                <button
                  type="button"
                  onClick={resetToCurrent}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sliders */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'attendance_percentage', label: 'Attendance Percentage', min: 0, max: 100, step: 1, unit: '%' },
                  { key: 'assignment_score', label: 'Assignment Score', min: 0, max: 100, step: 1, unit: '%' },
                  { key: 'quiz_score', label: 'Quiz Score', min: 0, max: 100, step: 1, unit: '%' },
                  { key: 'lms_activity_score', label: 'LMS Activity Score', min: 0, max: 100, step: 1, unit: '/100' },
                  { key: 'missed_submissions', label: 'Missed Submissions', min: 0, max: 12, step: 1, unit: ' tasks' },
                  { key: 'previous_gpa', label: 'Previous GPA (Reference)', min: 0, max: 4, step: 0.05, unit: ' GPA' },
                ].map((ctrl) => (
                  <div key={ctrl.key} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{ctrl.label}</span>
                      <span className="font-bold text-indigo-300">
                        {sim[ctrl.key]}{ctrl.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      step={ctrl.step}
                      value={sim[ctrl.key]}
                      onChange={(e) => setSim({ ...sim, [ctrl.key]: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                ))}

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => runSimulation()}
                    disabled={simulating}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 disabled:opacity-60 cursor-pointer"
                  >
                    {simulating ? 'Running ML Simulation...' : 'Simulate Risk Estimate'}
                  </button>
                </div>
              </div>

              {/* Comparison Panel */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/10 flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-white/10">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Current Recorded Status</p>
                    <div className="mt-2">
                      <RiskBadge level={currentPred?.risk_level || 'UNASSESSED'} probability={currentPred?.probability} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan-300 font-semibold">Simulated Goal Outcome</p>
                    {simResult ? (
                      <div className="mt-2 space-y-3">
                        <RiskBadge level={simResult.risk_level} probability={simResult.probability} />
                        <p className="text-xs text-slate-300 leading-relaxed">{simResult.explanation_summary}</p>
                        {simResult.class_probabilities && (
                          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                            {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                              <div key={lvl} className="p-2 rounded-lg bg-white/5">
                                <p className="text-[10px] text-slate-400">{lvl}</p>
                                <p className="text-xs font-bold text-white">
                                  {Math.round((simResult.class_probabilities[lvl] || 0) * 100)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-2">
                        Adjust sliders and click <strong>Simulate Risk Estimate</strong> (or <strong>Try Target Benchmarks</strong>) to preview how changes affect the model's estimate.
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <BookOpen size={13} /> Powered by live EduRisk FastAPI ML Service
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default StudentAcademicsPage;
