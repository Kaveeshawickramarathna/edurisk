import React, { useEffect, useState, useCallback } from 'react';
import { Download, Printer, Cpu, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import Layout from '../components/Layout';
import DecisionSupportBanner from '../components/DecisionSupportBanner';
import { RiskBadge } from '../components/RiskBadge';
import api, { downloadReportCsv } from '../services/api';

const ReportsPage = () => {
  const [report, setReport] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [courses, setCourses] = useState([]);
  const [riskLevel, setRiskLevel] = useState('ALL');
  const [courseId, setCourseId] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (riskLevel !== 'ALL') params.riskLevel = riskLevel;
      if (courseId !== 'ALL') params.courseId = courseId;

      const [repRes, mlRes, crsRes] = await Promise.all([
        api.get('/reports/summary', { params }),
        api.get('/predictions/model-info'),
        api.get('/courses'),
      ]);
      setReport(repRes.data);
      setModelInfo(mlRes.data);
      setCourses(crsRes.data.courses || []);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }, [riskLevel, courseId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (riskLevel !== 'ALL') params.riskLevel = riskLevel;
      if (courseId !== 'ALL') params.courseId = courseId;
      await downloadReportCsv(params);
    } catch {
      alert('Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  const selectedMetrics = modelInfo?.selected_model_metrics;
  const importanceData = selectedMetrics?.feature_importances
    ? Object.entries(selectedMetrics.feature_importances).map(([k, v]) => ({
        feature: k.replace(/_/g, ' '),
        weight: Number((v * 100).toFixed(1)),
      }))
    : [];

  return (
    <Layout
      title="Academic Reports & ML Model Evaluation"
      subtitle="Export filtered academic risk summaries and inspect candidate ML evaluation metrics"
      actions={
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
          >
            <Download size={14} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      }
    >
      <DecisionSupportBanner
        isDemo={modelInfo?.is_demo ?? true}
        modelName={modelInfo?.selected_model}
        compact
      />

      {/* ML Evaluation Section */}
      <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu size={18} className="text-indigo-400" />
              Machine Learning Model Comparison & Held-Out Test Evaluation
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dataset: <span className="text-slate-200">{modelInfo?.dataset_source || 'Unavailable'}</span>
              {modelInfo?.total_samples
                ? ` · ${modelInfo.total_samples} samples (${modelInfo.train_samples} train / ${modelInfo.test_samples} held-out test)`
                : ''}
            </p>
          </div>
          {modelInfo?.selected_model && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 size={14} /> Active Model: {modelInfo.selected_model}
            </span>
          )}
        </div>

        {modelInfo?.candidate_models?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 pr-4">Candidate Model</th>
                    <th className="py-2.5 px-3">Test Accuracy</th>
                    <th className="py-2.5 px-3">Macro Precision</th>
                    <th className="py-2.5 px-3">Macro Recall</th>
                    <th className="py-2.5 px-3">Macro F1</th>
                    <th className="py-2.5 px-3">High-Risk Recall</th>
                    <th className="py-2.5 px-3">CV Macro-F1</th>
                    <th className="py-2.5 pl-3 text-right">Selection Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {modelInfo.candidate_models.map((m) => {
                    const isBest = m.model_name === modelInfo.selected_model;
                    return (
                      <tr key={m.model_name} className={isBest ? 'bg-indigo-500/10' : ''}>
                        <td className="py-3 pr-4 font-semibold text-white">
                          {m.model_name}
                          {isBest && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 uppercase">
                              Selected
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-200">{(m.test_accuracy * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-slate-200">{(m.test_macro_precision * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-slate-200">{(m.test_macro_recall * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-slate-200">{(m.test_macro_f1 * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 font-semibold text-amber-300">{(m.high_risk_recall * 100).toFixed(1)}%</td>
                        <td className="py-3 px-3 text-slate-300">{(m.cv_macro_f1_mean * 100).toFixed(1)}%</td>
                        <td className="py-3 pl-3 text-right font-bold text-indigo-300">{m.selection_score.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Confusion Matrix */}
              {selectedMetrics?.confusion_matrix && (
                <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Held-Out Confusion Matrix ({modelInfo.selected_model})
                  </h4>
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-2 text-left">Actual \ Predicted</th>
                        {selectedMetrics.confusion_matrix.labels.map((lbl) => (
                          <th key={lbl} className="py-2">{lbl}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMetrics.confusion_matrix.matrix.map((row, rIdx) => (
                        <tr key={rIdx} className="border-t border-white/5">
                          <td className="py-2.5 text-left font-semibold text-slate-200">
                            {selectedMetrics.confusion_matrix.labels[rIdx]}
                          </td>
                          {row.map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2.5 font-bold rounded ${
                                rIdx === cIdx
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : val > 0
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'text-slate-500'
                              }`}
                            >
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Feature Weights */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  Normalized Feature Importance (%)
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={importanceData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" unit="%" />
                      <YAxis type="category" dataKey="feature" stroke="#cbd5e1" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px' }} />
                      <Bar dataKey="weight" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-amber-300">
            {modelInfo?.disclaimer || 'FastAPI ML Service offline. Start uvicorn on port 8000 to view model evaluation metrics.'}
          </p>
        )}
      </div>

      {/* Exportable Student Risk Report */}
      <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-400" />
              Academic Monitoring Summary Report
            </h3>
            <p className="text-xs text-slate-400">
              {report
                ? `${report.totalRecords} students · High: ${report.highRiskCount} · Medium: ${report.mediumRiskCount} · Low: ${report.lowRiskCount}`
                : 'Loading summary...'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">HIGH Only</option>
              <option value="MEDIUM">MEDIUM Only</option>
              <option value="LOW">LOW Only</option>
            </select>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white"
            >
              <option value="ALL">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Generating report preview...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-3">ID</th>
                  <th className="py-3 pr-3">Name</th>
                  <th className="py-3 pr-3">Major</th>
                  <th className="py-3 pr-3">Attendance</th>
                  <th className="py-3 pr-3">Assign</th>
                  <th className="py-3 pr-3">Quiz</th>
                  <th className="py-3 pr-3">GPA</th>
                  <th className="py-3 pr-3">Risk</th>
                  <th className="py-3">Interventions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(report?.rows || []).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{r.student_identifier}</td>
                    <td className="py-2.5 pr-3 font-medium text-white">{r.first_name} {r.last_name}</td>
                    <td className="py-2.5 pr-3 text-slate-300">{r.major}</td>
                    <td className="py-2.5 pr-3 text-slate-200">{r.avg_attendance}%</td>
                    <td className="py-2.5 pr-3 text-slate-200">{r.avg_assignment}%</td>
                    <td className="py-2.5 pr-3 text-slate-200">{r.avg_quiz}%</td>
                    <td className="py-2.5 pr-3 text-slate-200">{r.avg_gpa}</td>
                    <td className="py-2.5 pr-3">
                      <RiskBadge level={r.risk_level} probability={r.risk_probability} />
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {r.intervention_count} ({r.latest_intervention_status || 'NONE'})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;
