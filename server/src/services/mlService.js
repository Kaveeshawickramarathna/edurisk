const db = require('../config/db');
require('dotenv').config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

async function checkMlHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { available: false, status: res.status };
    const data = await res.json();
    return { available: true, ...data };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

async function getModelInfo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/model-info`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`ML service returned HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    return {
      available: false,
      is_demo: true,
      selected_model: 'ML Service Offline',
      candidate_models: [],
      disclaimer:
        'FastAPI ML service is currently unreachable. Start the Python ML service on port 8000 to view full model evaluation metrics and run trained scikit-learn predictions.',
      error: err.message,
    };
  }
}

function fallbackDemoPrediction(features) {
  const att = Number(features.attendance_percentage || 0);
  const asg = Number(features.assignment_score || 0);
  const quiz = Number(features.quiz_score || 0);
  const gpa = Number(features.previous_gpa || 0);
  const missed = Number(features.missed_submissions || 0);
  const lms = Number(features.lms_activity_score || 0);

  const score =
    0.28 * ((100 - att) / 100) +
    0.22 * ((100 - asg) / 100) +
    0.16 * ((100 - quiz) / 100) +
    0.16 * ((4.0 - gpa) / 4.0) +
    0.10 * Math.min(1, missed / 10) +
    0.08 * ((100 - lms) / 100);

  const risk_level = score >= 0.45 ? 'HIGH' : score >= 0.28 ? 'MEDIUM' : 'LOW';
  const probability = Number(Math.min(0.97, Math.max(0.05, score * 1.45)).toFixed(4));

  const contributing_factors = [
    { feature: 'attendance_percentage', label: 'Attendance Percentage', value: att, unit: '%', benchmark: 75, model_weight: 0.28, status: att < 75 ? 'CONCERN' : 'HEALTHY', direction: att < 75 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.28 * (0.35 + 1.4 * Math.max(0, (75 - att) / 75))).toFixed(4)), note: att < 75 ? 'Below benchmark (75%)' : 'At or above benchmark (75%)' },
    { feature: 'assignment_score', label: 'Assignment Performance', value: asg, unit: '%', benchmark: 65, model_weight: 0.22, status: asg < 65 ? 'CONCERN' : 'HEALTHY', direction: asg < 65 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.22 * (0.35 + 1.4 * Math.max(0, (65 - asg) / 65))).toFixed(4)), note: asg < 65 ? 'Below benchmark (65%)' : 'At or above benchmark (65%)' },
    { feature: 'quiz_score', label: 'Quiz Performance', value: quiz, unit: '%', benchmark: 60, model_weight: 0.16, status: quiz < 60 ? 'CONCERN' : 'HEALTHY', direction: quiz < 60 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.16 * (0.35 + 1.4 * Math.max(0, (60 - quiz) / 60))).toFixed(4)), note: quiz < 60 ? 'Below benchmark (60%)' : 'At or above benchmark (60%)' },
    { feature: 'previous_gpa', label: 'Previous Semester GPA', value: gpa, unit: 'GPA', benchmark: 2.5, model_weight: 0.16, status: gpa < 2.5 ? 'CONCERN' : 'HEALTHY', direction: gpa < 2.5 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.16 * (0.35 + 1.4 * Math.max(0, (2.5 - gpa) / 2.5))).toFixed(4)), note: gpa < 2.5 ? 'Below benchmark (2.5 GPA)' : 'At or above benchmark (2.5 GPA)' },
    { feature: 'missed_submissions', label: 'Missed / Late Submissions', value: missed, unit: 'tasks', benchmark: 2, model_weight: 0.10, status: missed > 2 ? 'CONCERN' : 'HEALTHY', direction: missed > 2 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.10 * (0.35 + 1.4 * Math.max(0, (missed - 2) / 2))).toFixed(4)), note: missed > 2 ? 'Above threshold (2 tasks)' : 'Within expected threshold (<= 2 tasks)' },
    { feature: 'lms_activity_score', label: 'LMS Engagement', value: lms, unit: '/100', benchmark: 55, model_weight: 0.08, status: lms < 55 ? 'CONCERN' : 'HEALTHY', direction: lms < 55 ? 'RISK_INCREASING' : 'PROTECTIVE', association_score: Number((0.08 * (0.35 + 1.4 * Math.max(0, (55 - lms) / 55))).toFixed(4)), note: lms < 55 ? 'Below benchmark (55/100)' : 'At or above benchmark (55/100)' },
  ];

  const suggested_actions = contributing_factors
    .filter((f) => f.status === 'CONCERN')
    .map((f) => ({
      indicator: f.label,
      category: 'Early Academic Support',
      title: `Review ${f.label} with academic advisor`,
      description: `${f.label} is currently flagged (${f.note}). Plan targeted follow-up support.`,
      priority: 'HIGH',
    }));

  if (suggested_actions.length === 0) {
    suggested_actions.push({
      indicator: 'Overall Progress',
      category: 'Positive Reinforcement',
      title: 'Maintain current academic progress',
      description: 'All monitored indicators currently meet target benchmarks.',
      priority: 'LOW',
    });
  }

  return {
    risk_level,
    probability,
    class_probabilities: {
      LOW: risk_level === 'LOW' ? 0.8 : 0.1,
      MEDIUM: risk_level === 'MEDIUM' ? 0.65 : 0.18,
      HIGH: risk_level === 'HIGH' ? 0.72 : 0.08,
    },
    contributing_factors,
    suggested_actions,
    explanation_summary:
      'Fallback demo estimate generated while FastAPI ML service was unavailable. Indicators reflect non-causal associations for human review.',
    model_name: 'Fallback Demo Rules (ML Service Offline)',
    is_demo: true,
  };
}

async function predictRisk(features) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`ML predict HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[MLService] Fallback activated: ${err.message}`);
    return fallbackDemoPrediction(features);
  }
}

async function aggregateStudentFeatures(studentId) {
  const res = await db.query(
    `SELECT
       COALESCE(ROUND(AVG(ar.attendance_percentage)::numeric, 2), 0)::float AS attendance_percentage,
       COALESCE(ROUND(AVG(ar.assignment_score)::numeric, 2), 0)::float AS assignment_score,
       COALESCE(ROUND(AVG(ar.quiz_score)::numeric, 2), 0)::float AS quiz_score,
       COALESCE(ROUND(AVG(ar.previous_gpa)::numeric, 2), 0)::float AS previous_gpa,
       COALESCE(ROUND(AVG(ar.missed_submissions)::numeric, 0), 0)::int AS missed_submissions,
       COALESCE(ROUND(AVG(ar.lms_activity_score)::numeric, 2), 0)::float AS lms_activity_score,
       COUNT(ar.id)::int AS record_count
     FROM enrollments e
     JOIN academic_records ar ON ar.enrollment_id = e.id
     WHERE e.student_id = $1`,
    [studentId]
  );

  return res.rows[0];
}

async function runAndStoreStudentPrediction(studentId, generatedByUserId = null) {
  const aggregated = await aggregateStudentFeatures(studentId);
  if (!aggregated || aggregated.record_count === 0) {
    const err = new Error('Student has no academic records available for risk prediction');
    err.statusCode = 400;
    throw err;
  }

  const features = {
    attendance_percentage: Number(aggregated.attendance_percentage),
    assignment_score: Number(aggregated.assignment_score),
    quiz_score: Number(aggregated.quiz_score),
    previous_gpa: Number(aggregated.previous_gpa),
    missed_submissions: Number(aggregated.missed_submissions),
    lms_activity_score: Number(aggregated.lms_activity_score),
  };

  const prediction = await predictRisk(features);

  const saved = await db.query(
    `INSERT INTO risk_predictions (
      student_id, risk_level, probability, class_probabilities,
      contributing_factors, suggested_actions, explanation_summary,
      model_name, is_demo, generated_by
    ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
    RETURNING *`,
    [
      studentId,
      prediction.risk_level,
      prediction.probability,
      JSON.stringify(prediction.class_probabilities || {}),
      JSON.stringify(prediction.contributing_factors || []),
      JSON.stringify(prediction.suggested_actions || []),
      prediction.explanation_summary || '',
      prediction.model_name || 'EduRisk ML Model',
      prediction.is_demo !== undefined ? Boolean(prediction.is_demo) : true,
      generatedByUserId,
    ]
  );

  return {
    prediction: saved.rows[0],
    features,
  };
}

module.exports = {
  checkMlHealth,
  getModelInfo,
  predictRisk,
  aggregateStudentFeatures,
  runAndStoreStudentPrediction,
};
